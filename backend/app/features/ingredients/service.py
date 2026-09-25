from collections import Counter
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.exceptions import NotFoundError, ValidationError
from app.common.time import d_day, today
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


def find_preset_by_name(db: Session, name: str) -> IngredientPreset | None:
    """vision 도메인도 사용하는 공개 함수. TODO(ingredients): 동의어/유사어 매칭('파'→'대파')"""
    return db.scalar(select(IngredientPreset).where(IngredientPreset.name == name.strip()))


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
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ingredient, key, value)
    db.commit()
    return read_one(db, ingredient)


def delete_ingredient(db: Session, user: User, ingredient_id: int) -> None:
    """소프트 삭제 (DISCARDED). 폐기 통계에 쓸 수 있도록 row는 남긴다."""
    ingredient = get_owned(db, user, ingredient_id)
    ingredient.status = IngredientStatus.DISCARDED
    db.commit()
