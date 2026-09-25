from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.common.config import settings
from app.common.exceptions import NotFoundError
from app.common.time import d_day
from app.features.ingredients import service as ingredients
from app.features.recipes.models import Recipe
from app.features.recipes.schemas import (
    ChecklistItem,
    CookCompleteRequest,
    CookCompleteResponse,
    CookUndoResponse,
    RecipeDetail,
    RecipeStepRead,
    RecommendQuery,
    RecommendResponse,
)
from app.features.users import service as users
from app.features.users.models import User


@dataclass
class Pantry:
    """사용자가 가진 것 = 냉장고 활성 재료 + 기본 양념. 레시피 매칭의 기준."""

    ingredient_names: set[str]
    imminent_names: set[str]
    seasoning_names: set[str]

    @property
    def owned(self) -> set[str]:
        return self.ingredient_names | self.seasoning_names


def load_pantry(db: Session, user: User) -> Pantry:
    active = ingredients.list_active(db, user.id)
    return Pantry(
        ingredient_names={i.name for i in active},
        imminent_names={i.name for i in active if d_day(i.expires_on) <= settings.IMMINENT_DAYS},
        seasoning_names=users.get_owned_seasoning_names(db, user.id),
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


def get_detail(db: Session, user: User, recipe_id: int) -> RecipeDetail:
    recipe = get_recipe(db, recipe_id)
    owned = load_pantry(db, user).owned
    return RecipeDetail(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        image_url=recipe.image_url,
        cook_minutes=recipe.cook_minutes,
        difficulty=recipe.difficulty,
        servings=recipe.servings,
        checklist=[
            ChecklistItem(
                name=ri.name,
                amount=ri.amount,
                owned=ri.name in owned,
                is_seasoning=ri.is_seasoning,
                is_optional=ri.is_optional,
                substitutes=ri.substitutes or [],
                owned_substitutes=[s for s in (ri.substitutes or []) if s in owned],
            )
            for ri in recipe.ingredients
        ],
        steps=[RecipeStepRead(step_no=s.step_no, description=s.description) for s in recipe.steps],
    )


def recommend(db: Session, user: User, query: RecommendQuery) -> RecommendResponse:
    """[화면 4] 레시피 추천.

    TODO(recipes): 추천 알고리즘 구현
      1. load_pantry() 로 보유 재료/임박 재료/양념 로드. 냉장고가 비었으면
         ValidationError("식재료를 1개 이상 등록해 주세요") (Notion 예외 흐름)
      2. 필터(max_minutes, servings, cookware) 적용해 레시피 후보 조회
      3. 레시피별 missing(부족 재료, is_optional 제외, 대체재 보유 시 보유로 간주) 계산
         → missing 0: ready / 1~2: almost / 3+: 제외
      4. 정렬: imminent_first 면 '임박 재료 사용 개수' 내림차순 → missing 오름차순 → 조리시간
      5. RecipeCard.tags 는 레시피 주재료(양념 제외)만, imminent=True 인 것 강조
      (선택) LLM 기반 실시간 레시피 생성은 별도 함수로 분리
    """
    raise NotImplementedError("레시피 추천 알고리즘 구현 예정")


def complete_cooking(db: Session, user: User, recipe_id: int, data: CookCompleteRequest) -> CookCompleteResponse:
    """[화면 5] '요리 완료 (재료 소진)'.

    TODO(recipes):
      1. 소진 대상 재료 결정 (data.ingredient_ids 또는 레시피에 매칭된 보유 재료 전부)
      2. 각 재료의 이전 상태를 CookLog.consumed_snapshot 에 저장
      3. 재료 status=CONSUMED, consumed_at=now (수량 부분 차감은 기획 확인 후)
      4. XP: gamification.award_xp(COOK_COMPLETE) + 유통기한 내 소진 재료가 있으면 EXPIRY_SAVE_BONUS
      5. gamification.evaluate_badges() 후 XpGain 구성, commit
    """
    raise NotImplementedError("요리 완료 처리 구현 예정")


def undo_cooking(db: Session, user: User, cook_log_id: int) -> CookUndoResponse:
    """요리 완료 실행 취소.

    TODO(recipes):
      1. 본인 CookLog 인지, 이미 취소(undone_at)됐는지 확인
      2. consumed_snapshot 대로 재료 상태/수량 복구
      3. 지급했던 XP 회수: award_xp(COOK_UNDO, amount=-cook_log.xp_awarded)
      4. undone_at = now, commit
    """
    raise NotImplementedError("요리 완료 실행 취소 구현 예정")
