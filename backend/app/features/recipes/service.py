import logging
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.common.config import settings
from app.common.exceptions import ConflictError, NotFoundError, ValidationError
from app.common.llm import LLMError
from app.common.time import d_day, now
from app.features.gamification import service as gamification
from app.features.gamification.rules import XpAction
from app.features.gamification.schemas import XpGain
from app.features.ingredients import service as ingredients
from app.features.ingredients.models import IngredientStatus
from app.features.recipes.generator import (
    GeneratedRecipe,
    GenerationRequest,
    LLMRecipeGenerator,
    MockRecipeGenerator,
    RecipeGenerator,
)
from app.features.recipes.models import CookLog, Recipe, RecipeIngredient, RecipeSource, RecipeStep
from app.features.recipes.schemas import (
    ChecklistItem,
    ConsumedIngredient,
    CookCompleteRequest,
    CookCompleteResponse,
    CookUndoResponse,
    IngredientTag,
    RecipeCard,
    RecipeDetail,
    RecipeStepRead,
    RecommendQuery,
    RecommendResponse,
)
from app.features.users import service as users
from app.features.users.models import User

logger = logging.getLogger(__name__)

MAX_MISSING = 2  # 부족 재료가 이보다 많으면 추천하지 않는다


# ---------- 사용자가 가진 것 ----------


@dataclass
class Pantry:
    """사용자가 가진 것 = 냉장고 활성 재료 + 기본 양념. 레시피 매칭의 기준."""

    ingredient_days: dict[str, int]  # 재료 이름 → 남은 일수 (같은 재료가 여러 개면 가장 급한 것)
    seasoning_names: set[str]

    @property
    def ingredient_names(self) -> set[str]:
        return set(self.ingredient_days)

    @property
    def imminent_names(self) -> set[str]:
        return {n for n, d in self.ingredient_days.items() if d <= settings.IMMINENT_DAYS}

    @property
    def owned(self) -> set[str]:
        return self.ingredient_names | self.seasoning_names


def load_pantry(db: Session, user: User) -> Pantry:
    days: dict[str, int] = {}
    for i in ingredients.list_active(db, user.id):
        days[i.name] = min(days.get(i.name, 10**6), d_day(i.expires_on))
    return Pantry(ingredient_days=days, seasoning_names=users.get_owned_seasoning_names(db, user.id))


def _have(ri: RecipeIngredient, owned: set[str]) -> str | None:
    """레시피 재료를 가지고 있으면 (본인 또는 대체재 중) 가진 재료 이름, 없으면 None."""
    if ri.name in owned:
        return ri.name
    return next((s for s in ri.substitutes or [] if s in owned), None)


# ---------- 매칭 ----------


@dataclass
class Match:
    recipe: Recipe
    missing: list[str] = field(default_factory=list)  # 없는 필수 재료/양념
    used: list[str] = field(default_factory=list)  # 쓰게 되는 내 냉장고 재료 (양념 제외)
    imminent_used: list[str] = field(default_factory=list)
    min_d_day: int = 10**6  # 쓰게 되는 재료 중 가장 급한 남은 일수


def match_recipe(recipe: Recipe, pantry: Pantry) -> Match:
    m = Match(recipe=recipe)
    owned, imminent = pantry.owned, pantry.imminent_names
    for ri in recipe.ingredients:
        have = _have(ri, owned)
        if have is None:
            if not ri.is_optional:
                m.missing.append(ri.name)
            continue
        if have in pantry.ingredient_days:
            m.used.append(have)
            m.min_d_day = min(m.min_d_day, pantry.ingredient_days[have])
            if have in imminent:
                m.imminent_used.append(have)
    return m


def _sort_key(m: Match, imminent_first: bool):
    if imminent_first:
        # 임박 재료를 많이 쓸수록 → 더 급한 재료를 쓸수록 → 부족 재료가 적을수록 → 빨리 만들수록
        return (-len(m.imminent_used), m.min_d_day, len(m.missing), -len(m.used), m.recipe.cook_minutes, m.recipe.id)
    return (len(m.missing), -len(m.used), m.recipe.cook_minutes, m.recipe.id)


def _rank(db: Session, pantry: Pantry, query: RecommendQuery) -> list[Match]:
    stmt = select(Recipe).options(selectinload(Recipe.ingredients))
    if query.max_minutes:
        stmt = stmt.where(Recipe.cook_minutes <= query.max_minutes)
    if query.cookware:
        stmt = stmt.where(Recipe.cookware == query.cookware)
    if query.exclude_ids:
        stmt = stmt.where(Recipe.id.not_in(query.exclude_ids))

    matches = [match_recipe(r, pantry) for r in db.scalars(stmt)]
    # 내 냉장고 재료를 1개 이상 쓰고, 부족한 게 2개 이하인 레시피만
    matches = [m for m in matches if m.used and len(m.missing) <= MAX_MISSING]
    return sorted(matches, key=lambda m: _sort_key(m, query.imminent_first))


def _to_card(m: Match, pantry: Pantry, servings: int) -> RecipeCard:
    owned, imminent = pantry.owned, pantry.imminent_names
    tags = []
    for ri in m.recipe.ingredients:
        if ri.is_seasoning:
            continue
        have = _have(ri, owned)
        if have is None and ri.is_optional:
            continue
        tags.append(IngredientTag(name=ri.name, owned=have is not None, imminent=have in imminent))
    r = m.recipe
    return RecipeCard(
        id=r.id,
        title=r.title,
        image_url=r.image_url,
        cook_minutes=r.cook_minutes,
        difficulty=r.difficulty,
        servings=servings,
        is_ai_generated=r.source == RecipeSource.AI,
        uses_imminent=bool(m.imminent_used),
        imminent_count=len(m.imminent_used),
        missing_count=len(m.missing),
        tags=tags,
    )


# ---------- AI 생성 ----------


def get_generator() -> RecipeGenerator:
    return MockRecipeGenerator() if settings.AI_MOCK else LLMRecipeGenerator()


def _save_generated(db: Session, user: User, generated: list[GeneratedRecipe]) -> list[Recipe]:
    existing = set(db.scalars(select(Recipe.title)))
    saved = []
    for g in generated:
        title = g.title.strip()[:50]
        if not title or title in existing or not g.ingredients or not g.steps:
            continue
        recipe = Recipe(
            title=title,
            description=g.description[:200],
            cook_minutes=max(1, g.cook_minutes),
            difficulty=g.difficulty,
            cookware=g.cookware,
            servings=1,
            source=RecipeSource.AI,
            created_by_user_id=user.id,
            ingredients=[
                RecipeIngredient(
                    name=i.name.strip()[:30],
                    quantity=i.quantity,
                    unit=i.unit[:10] if i.unit else None,
                    is_seasoning=i.is_seasoning,
                    is_optional=i.is_optional,
                    substitutes=i.substitutes,
                )
                for i in g.ingredients
            ],
            steps=[RecipeStep(step_no=n, description=text) for n, text in enumerate(g.steps, start=1)],
        )
        db.add(recipe)
        existing.add(title)
        saved.append(recipe)
    db.commit()
    return saved


def _generate(db: Session, user: User, pantry: Pantry, query: RecommendQuery, generator: RecipeGenerator) -> bool:
    """AI(Gemini)로 레시피를 만들어 DB에 저장한다. 실패해도 추천 자체는 실패시키지 않는다."""
    req = GenerationRequest(
        ingredients=sorted(pantry.ingredient_days.items(), key=lambda kv: kv[1]),
        seasonings=sorted(pantry.seasoning_names),
        max_minutes=query.max_minutes,
        cookware=query.cookware,
        avoid_titles=list(db.scalars(select(Recipe.title))),
        count=settings.AI_RECIPE_COUNT,
    )
    try:
        generated = generator.generate(req)
    except LLMError as e:
        logger.warning("AI 레시피 생성 실패: %s", e.message)
        return False
    return bool(_save_generated(db, user, generated))


# ---------- 공개 API ----------


def recommend(
    db: Session, user: User, query: RecommendQuery, generator: RecipeGenerator | None = None
) -> RecommendResponse:
    """[화면 4] 레시피 추천.

    1. 내 냉장고 재료 + 기본 양념으로 레시피별 부족 재료 계산 (대체재 보유 시 보유로 간주, 선택 재료 제외)
    2. 부족 0개 → ready, 1~2개 → almost, 3개 이상 또는 내 재료를 하나도 안 쓰면 제외
    3. 정렬: 임박 재료 사용 개수 → 가장 급한 재료 → 부족 개수 → 조리 시간
    4. 결과가 AI_RECIPE_MIN_RESULTS 보다 적으면 AI(Gemini)가 내 재료로 레시피를 생성·저장한 뒤 다시 추천
       (generator=None 이면 생성하지 않음 — 홈 화면처럼 빨리 응답해야 하는 곳)
    """
    pantry = load_pantry(db, user)
    if not pantry.ingredient_days:
        raise ValidationError("식재료를 1개 이상 등록해 주세요.", code="EMPTY_FRIDGE")

    matches = _rank(db, pantry, query)
    ai_generated = False
    can_generate = generator is not None and query.allow_ai and settings.AI_RECIPE_ENABLED
    if can_generate and len(matches) < settings.AI_RECIPE_MIN_RESULTS:
        ai_generated = _generate(db, user, pantry, query, generator)
        if ai_generated:
            matches = _rank(db, pantry, query)

    ready = [m for m in matches if not m.missing][: query.limit]
    almost = [m for m in matches if m.missing][: query.limit]
    return RecommendResponse(
        basis_ingredient_count=len(pantry.ingredient_days),
        ready=[_to_card(m, pantry, query.servings) for m in ready],
        almost=[_to_card(m, pantry, query.servings) for m in almost],
        ai_generated=ai_generated,
    )


def get_recipe(db: Session, recipe_id: int) -> Recipe:
    stmt = (
        select(Recipe)
        .where(Recipe.id == recipe_id)
        .options(selectinload(Recipe.ingredients), selectinload(Recipe.steps))
    )
    recipe = db.scalar(stmt)
    if recipe is None:
        raise NotFoundError("레시피를 찾을 수 없습니다.")
    return recipe


_FRACTIONS = [(0.25, "1/4"), (1 / 3, "1/3"), (0.5, "1/2"), (2 / 3, "2/3"), (0.75, "3/4")]


def format_amount(quantity: float | None, unit: str | None) -> str:
    """0.5, "모" → "1/2모" / 1.5, "큰술" → "1과 1/2큰술" / None, "약간" → "약간"."""
    unit = unit or ""
    if quantity is None:
        return unit or "적당량"
    whole, frac = int(quantity), quantity - int(quantity)
    if frac < 0.04:
        num = str(whole)
    elif frac > 0.96:
        num = str(whole + 1)
    elif frac_str := next((s for v, s in _FRACTIONS if abs(frac - v) < 0.04), None):
        num = frac_str if whole == 0 else f"{whole}과 {frac_str}"
    else:
        num = f"{quantity:.1f}".rstrip("0").rstrip(".")
    return f"{num}{unit}"


def get_detail(db: Session, user: User, recipe_id: int, servings: int = 1) -> RecipeDetail:
    """[화면 5] 레시피 상세. 재료 양을 servings 인분으로 환산한다 (기본 1인분)."""
    recipe = get_recipe(db, recipe_id)
    owned = load_pantry(db, user).owned
    factor = servings / (recipe.servings or 1)

    checklist = []
    for ri in recipe.ingredients:
        qty = round(ri.quantity * factor, 2) if ri.quantity is not None else None
        subs = ri.substitutes or []
        checklist.append(
            ChecklistItem(
                name=ri.name,
                amount=format_amount(qty, ri.unit),
                quantity=qty,
                unit=ri.unit,
                owned=ri.name in owned,
                is_seasoning=ri.is_seasoning,
                is_optional=ri.is_optional,
                substitutes=subs,
                owned_substitutes=[s for s in subs if s in owned],
            )
        )
    return RecipeDetail(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        image_url=recipe.image_url,
        cook_minutes=recipe.cook_minutes,
        difficulty=recipe.difficulty,
        servings=servings,
        base_servings=recipe.servings,
        is_ai_generated=recipe.source == RecipeSource.AI,
        checklist=checklist,
        steps=[RecipeStepRead(step_no=s.step_no, description=s.description) for s in recipe.steps],
    )


# ---------- 요리 완료 · 실행 취소 ----------

COOK_XP_ACTIONS = [XpAction.COOK_COMPLETE, XpAction.EXPIRY_SAVE_BONUS]


def _consume(db: Session, user: User, ingredient_ids: list[int]) -> list[dict]:
    """ingredients 도메인(염지연)의 소진 함수 호출 → 실행 취소용 스냅샷을 만들어 반환."""
    consumed = ingredients.consume_ingredients(db, user, ingredient_ids)
    # consume_ingredients 는 ACTIVE 재료만 받고 수량은 건드리지 않으므로 이전 상태는 ACTIVE·현재 수량
    return [
        {
            "ingredient_id": i.id,
            "name": i.name,
            "expires_on": i.expires_on.isoformat(),
            "prev_quantity": i.quantity,
            "prev_status": IngredientStatus.ACTIVE,
        }
        for i in consumed
    ]


def _auto_targets(db: Session, user: User, recipe: Recipe) -> list[int]:
    """레시피 재료(양념 제외)마다 내 냉장고에서 가장 급한 재료 하나씩 고른다 (대체재 포함)."""
    active = ingredients.list_active(db, user.id)  # 유통기한 임박순
    chosen: list[int] = []
    for ri in recipe.ingredients:
        if ri.is_seasoning:
            continue
        names = [ri.name, *(ri.substitutes or [])]
        match = next((i for i in active if i.name in names and i.id not in chosen), None)
        if match:
            chosen.append(match.id)
    return chosen


def complete_cooking(db: Session, user: User, recipe_id: int, data: CookCompleteRequest) -> CookCompleteResponse:
    """[화면 5] '요리 완료 (재료 소진)'.

    1. 소진할 재료: 요청의 ingredient_ids, 없으면 레시피 재료마다 가장 급한 내 재료를 자동 선택
    2. 재료를 통째로 소진 (ingredients.consume_ingredients) — 스냅샷은 실행 취소용으로 CookLog 에 저장
    3. XP: 요리 완료 + 임박 재료(D-0 ~ D-3)를 유통기한 안에 쓰면 '유통기한 내 소진 보너스'
    """
    recipe = get_recipe(db, recipe_id)
    target_ids = data.ingredient_ids or _auto_targets(db, user, recipe)
    if not target_ids:
        raise ValidationError("이 레시피에 쓸 수 있는 재료가 냉장고에 없어요.", code="NO_INGREDIENTS")

    snapshots = _consume(db, user, target_ids)
    cook_log = CookLog(user_id=user.id, recipe_id=recipe.id, consumed_snapshot=snapshots)
    db.add(cook_log)
    db.flush()  # cook_log.id 확보

    consumed = []
    for snap in snapshots:
        left = d_day(date.fromisoformat(snap["expires_on"]))
        consumed.append(
            ConsumedIngredient(
                ingredient_id=snap["ingredient_id"],
                name=snap["name"],
                before_expiry=left >= 0,
                imminent=0 <= left <= settings.IMMINENT_DAYS,
            )
        )

    log, level_up = gamification.award_xp(
        db, user, XpAction.COOK_COMPLETE, f"{recipe.title} 요리 완료", ref_id=cook_log.id
    )
    reasons, total = [log.description], log.amount
    if any(c.imminent for c in consumed):
        bonus, bonus_level_up = gamification.award_xp(
            db, user, XpAction.EXPIRY_SAVE_BONUS, "유통기한 내 소진 보너스", ref_id=cook_log.id
        )
        reasons.append(bonus.description)
        total += bonus.amount
        level_up = level_up or bonus_level_up

    cook_log.xp_awarded = total
    new_badges = gamification.evaluate_badges(db, user)
    db.commit()
    return CookCompleteResponse(
        cook_log_id=cook_log.id,
        consumed=consumed,
        xp=XpGain(amount=total, reasons=reasons, level_up=level_up, new_badges=[b.name for b in new_badges]),
    )


def undo_cooking(db: Session, user: User, cook_log_id: int) -> CookUndoResponse:
    """요리 완료 실행 취소 — 재료 복구 + 지급했던 XP 로그 삭제·회수."""
    cook_log = db.get(CookLog, cook_log_id)
    if cook_log is None or cook_log.user_id != user.id:
        raise NotFoundError("요리 기록을 찾을 수 없습니다.")
    if cook_log.undone_at is not None:
        raise ConflictError("이미 취소된 요리예요.", code="ALREADY_UNDONE")

    restored = ingredients.restore_ingredients(db, user, cook_log.consumed_snapshot)
    revoked = gamification.revoke_xp(db, user, COOK_XP_ACTIONS, ref_id=cook_log.id)
    cook_log.undone_at = now()
    db.commit()
    return CookUndoResponse(cook_log_id=cook_log.id, restored_ingredient_ids=restored, xp_revoked=revoked)
