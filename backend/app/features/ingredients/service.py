from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.exceptions import NotFoundError, ValidationError
from app.common.time import d_day, now, today
from app.features.gamification import service as gamification
from app.features.gamification.rules import XpAction
from app.features.gamification.schemas import XpGain
from app.features.ingredients.models import (
    Ingredient,
    IngredientPreset,
    IngredientStatus,
    RegisterSource,
    StorageType,
)
from app.features.ingredients.schemas import (
    IngredientBatchResponse,
    IngredientCreate,
    IngredientListResponse,
    IngredientRead,
    IngredientUpdate,
)
from app.features.users.models import User

DEFAULT_SHELF_LIFE_DAYS = 7


# ---------- 프리셋 ----------


def list_presets(db: Session, q: str | None = None, frequent_only: bool = False) -> list[IngredientPreset]:
    stmt = select(IngredientPreset).order_by(IngredientPreset.sort_order, IngredientPreset.id)
    if frequent_only:
        stmt = stmt.where(IngredientPreset.is_frequent.is_(True))
    if q:
        stmt = stmt.where(IngredientPreset.name.contains(q))
    return list(db.scalars(stmt))


# 사진 인식·직접 입력에서 자주 나오는 다른 이름 → 프리셋 이름 (키는 띄어쓰기 없이)
PRESET_ALIASES = {
    "달걀": "계란",
    "파": "대파",
    "쇠고기": "소고기",
    "참치": "참치캔",
    "만두": "냉동만두",
    "소세지": "소시지",
    "햇반": "밥",
    "즉석밥": "밥",
    "흰쌀밥": "밥",
    "흰우유": "우유",
    "배추김치": "김치",
    "포기김치": "김치",
    "청양고추": "고추",
    "풋고추": "고추",
    "깐마늘": "마늘",
    "다진마늘": "마늘",
    "새송이버섯": "버섯",
    "팽이버섯": "버섯",
    "표고버섯": "버섯",
    "양송이버섯": "버섯",
    "느타리버섯": "버섯",
    "떡볶이떡": "떡",
    "가래떡": "떡",
    "슬라이스치즈": "치즈",
}


def find_preset_by_name(db: Session, name: str) -> IngredientPreset | None:
    """이름으로 프리셋 찾기. vision 도메인도 사용하는 공개 함수.

    1) 이름 그대로 2) 동의어 사전('달걀'→'계란') 3) 띄어쓴 단어 중 프리셋 이름('돼지고기 앞다리살'→'돼지고기')
    """
    presets = {p.name: p for p in list_presets(db)}
    compact = name.replace(" ", "")
    for word in (compact, *name.split()):
        word = PRESET_ALIASES.get(word, word)
        if word in presets:
            return presets[word]
    return None


# ---------- 조회 ----------


def to_read(ingredient: Ingredient, preset: IngredientPreset | None = None) -> IngredientRead:
    remain = d_day(ingredient.expires_on)
    return IngredientRead.model_validate(
        {
            **{c: getattr(ingredient, c) for c in IngredientRead.model_fields if hasattr(ingredient, c)},
            "icon": preset.icon if preset else None,
            "d_day": remain,
            "is_imminent": remain <= settings.IMMINENT_DAYS,
        }
    )


def read_one(db: Session, ingredient: Ingredient) -> IngredientRead:
    return to_read(ingredient, db.get(IngredientPreset, ingredient.preset_id) if ingredient.preset_id else None)


def list_active(db: Session, user_id: int) -> list[Ingredient]:
    """유통기한 임박순 활성 재료. recipes/home/notifications 도메인도 사용하는 공개 함수."""
    stmt = (
        select(Ingredient)
        .where(Ingredient.user_id == user_id, Ingredient.status == IngredientStatus.ACTIVE)
        .order_by(Ingredient.expires_on, Ingredient.id)
    )
    return list(db.scalars(stmt))


def list_ingredients(db: Session, user: User, storage: StorageType | None = None) -> IngredientListResponse:
    all_items = list_active(db, user.id)
    presets = {p.id: p for p in db.scalars(select(IngredientPreset))}
    reads = [to_read(i, presets.get(i.preset_id)) for i in all_items]

    filtered = [r for r in reads if storage is None or r.storage == storage]
    counts = Counter(r.storage for r in reads)
    return IngredientListResponse(
        total=len(reads),
        imminent_count=sum(r.is_imminent for r in reads),
        storage_counts={s: counts.get(s, 0) for s in StorageType},
        items=filtered,
    )


def get_owned(db: Session, user: User, ingredient_id: int) -> Ingredient:
    ingredient = db.get(Ingredient, ingredient_id)
    if ingredient is None or ingredient.user_id != user.id or ingredient.status != IngredientStatus.ACTIVE:
        raise NotFoundError("재료를 찾을 수 없습니다.")
    return ingredient


# ---------- 등록/수정/삭제 ----------


def _build(db: Session, user: User, data: IngredientCreate, source: RegisterSource) -> Ingredient:
    preset = db.get(IngredientPreset, data.preset_id) if data.preset_id else find_preset_by_name(db, data.name)
    if data.expires_on is not None and data.expires_on < today():
        raise ValidationError(f"'{data.name}'의 유통기한이 이미 지났습니다.")

    shelf_days = preset.shelf_life_days if preset else DEFAULT_SHELF_LIFE_DAYS
    return Ingredient(
        user_id=user.id,
        preset_id=preset.id if preset else None,
        name=data.name,
        quantity=data.quantity or (preset.default_quantity if preset else 1),
        unit=data.unit or (preset.default_unit if preset else "개"),
        storage=data.storage or (preset.default_storage if preset else StorageType.FRIDGE),
        expires_on=data.expires_on or today() + timedelta(days=shelf_days),
        source=source,
    )


def create_ingredient(db: Session, user: User, data: IngredientCreate, source: RegisterSource) -> IngredientRead:
    ingredient = _build(db, user, data, source)
    db.add(ingredient)
    db.commit()
    return read_one(db, ingredient)


def create_batch(
    db: Session, user: User, items: list[IngredientCreate], source: RegisterSource
) -> IngredientBatchResponse:
    ingredients = [_build(db, user, item, source) for item in items]
    db.add_all(ingredients)
    db.flush()

    xp = None
    if source == RegisterSource.PHOTO:
        log, level_up = gamification.award_xp(
            db, user, XpAction.PHOTO_REGISTER, f"사진으로 재료 {len(ingredients)}개 등록"
        )
        new_badges = gamification.evaluate_badges(db, user)
        xp = XpGain(
            amount=log.amount,
            reasons=[log.description],
            level_up=level_up,
            new_badges=[b.name for b in new_badges],
        )
    db.commit()

    presets = {p.id: p for p in db.scalars(select(IngredientPreset))}
    return IngredientBatchResponse(items=[to_read(i, presets.get(i.preset_id)) for i in ingredients], xp=xp)


def update_ingredient(db: Session, user: User, ingredient_id: int, data: IngredientUpdate) -> IngredientRead:
    ingredient = get_owned(db, user, ingredient_id)
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(ingredient, key, value)
    if "name" in changes:
        # 사진 인식이 틀려 이름을 고친 경우: 아이콘·레시피 매칭이 새 이름을 따르도록 프리셋도 다시 찾는다
        preset = find_preset_by_name(db, ingredient.name)
        ingredient.preset_id = preset.id if preset else None
    db.commit()
    return read_one(db, ingredient)


def consume_ingredients(db: Session, user: User, ingredient_ids: list[int]) -> list[Ingredient]:
    """재료를 소진(CONSUMED) 처리한다. recipes 도메인(요리 완료)도 사용하는 공개 함수.

    XP는 주지 않고 commit 하지 않는다. 호출한 쪽에서 XP 지급 등 나머지 처리를 한 뒤 commit 한다.
    하나라도 없는 재료·남의 재료·이미 빠진 재료면 NotFoundError.
    """
    ingredients = [get_owned(db, user, i) for i in dict.fromkeys(ingredient_ids)]
    consumed_at = now()
    for ingredient in ingredients:
        ingredient.status = IngredientStatus.CONSUMED
        ingredient.consumed_at = consumed_at
    return ingredients


def consume_ingredient(db: Session, user: User, ingredient_id: int) -> IngredientRead:
    """[화면 2] '다 먹었어요'. 폐기와 구분해서 소진으로 기록한다 (XP 없음)."""
    (ingredient,) = consume_ingredients(db, user, [ingredient_id])
    db.commit()
    return read_one(db, ingredient)


def delete_ingredient(db: Session, user: User, ingredient_id: int) -> None:
    """소프트 삭제 (DISCARDED). 폐기 통계에 쓸 수 있도록 row는 남긴다."""
    ingredient = get_owned(db, user, ingredient_id)
    ingredient.status = IngredientStatus.DISCARDED
    db.commit()
