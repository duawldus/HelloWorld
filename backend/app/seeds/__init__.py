"""마스터 데이터 시딩. 재시작해도 중복 삽입 없음.

- 양념 · 레시피 · 뱃지: 이름(뱃지는 code)으로 비교해 DB에 없는 것만 넣는다 → data.py 에 추가하면 다음 실행 때 반영
- 재료 프리셋: 테이블이 비어 있을 때만 채운다
"""

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
    seasonings = set(db.scalars(select(Seasoning.name)))
    db.add_all(
        Seasoning(name=n, icon=i, sort_order=idx) for idx, (n, i) in enumerate(SEASONINGS) if n not in seasonings
    )

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

    # AI 가 같은 이름으로 만든 레시피가 있어도 건너뛴다 (제목 중복 방지)
    titles = set(db.scalars(select(Recipe.title)))
    for r in RECIPES:
        if r["title"] not in titles:
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
