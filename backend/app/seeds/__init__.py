"""마스터 데이터 시딩. 테이블이 비어 있을 때만 채운다 (재시작해도 중복 삽입 없음)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.gamification.models import Badge
from app.features.ingredients.models import IngredientPreset
from app.features.recipes.models import Recipe, RecipeIngredient, RecipeStep
from app.features.users.models import Seasoning
from app.seeds.data import BADGES, PRESETS, RECIPES, SEASONINGS


def _is_empty(db: Session, model) -> bool:
    return (db.scalar(select(func.count()).select_from(model)) or 0) == 0


def seed_all(db: Session) -> None:
    if _is_empty(db, Seasoning):
        db.add_all(Seasoning(name=n, icon=i, sort_order=idx) for idx, (n, i) in enumerate(SEASONINGS))

    if _is_empty(db, IngredientPreset):
        db.add_all(
            IngredientPreset(
                name=name,
                icon=icon,
                default_storage=storage,
                shelf_life_days=days,
                default_quantity=qty,
                default_unit=unit,
                is_frequent=frequent,
                sort_order=idx,
            )
            for idx, (name, icon, storage, days, qty, unit, frequent) in enumerate(PRESETS)
        )

    if _is_empty(db, Recipe):
        for r in RECIPES:
            db.add(
                Recipe(
                    title=r["title"],
                    description=r.get("description"),
                    cook_minutes=r["cook_minutes"],
                    difficulty=r["difficulty"],
                    cookware=r["cookware"],
                    servings=r.get("servings", 1),
                    ingredients=[
                        RecipeIngredient(
                            name=name,
                            quantity=qty,
                            unit=unit,
                            is_seasoning=seasoning,
                            is_optional=optional,
                            substitutes=subs,
                        )
                        for name, qty, unit, seasoning, optional, subs in r["ingredients"]
                    ],
                    steps=[RecipeStep(step_no=i + 1, description=d) for i, d in enumerate(r["steps"])],
                )
            )

    # 뱃지는 code 기준으로 맞춘다: 이름·조건을 고쳐도 DB를 지우지 않고 다음 실행 때 반영 (획득 기록 유지)
    existing = {b.code: b for b in db.scalars(select(Badge))}
    for idx, (c, n, d, i, cond, t) in enumerate(BADGES):
        badge = existing.get(c) or Badge(code=c)
        badge.name, badge.description, badge.icon = n, d, i
        badge.condition, badge.threshold, badge.sort_order = cond, t, idx
        db.add(badge)

    db.commit()
