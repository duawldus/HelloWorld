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
                    cook_minutes=r["cook_minutes"],
                    difficulty=r["difficulty"],
                    cookware=r["cookware"],
                    servings=r.get("servings", 1),
                    ingredients=[
                        RecipeIngredient(
                            name=name, amount=amount, is_seasoning=seasoning, is_optional=optional, substitutes=subs
                        )
                        for name, amount, seasoning, optional, subs in r["ingredients"]
                    ],
                    steps=[RecipeStep(step_no=i + 1, description=d) for i, d in enumerate(r["steps"])],
                )
            )

    if _is_empty(db, Badge):
        db.add_all(
            Badge(code=c, name=n, description=d, icon=i, condition=cond, threshold=t, sort_order=idx)
            for idx, (c, n, d, i, cond, t) in enumerate(BADGES)
        )

    db.commit()
