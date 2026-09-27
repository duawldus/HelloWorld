from sqlalchemy import func, select

from app.features.recipes.models import Recipe, RecipeSource
from app.seeds import seed_all
from app.seeds.data import RECIPES


def _count(db) -> int:
    return db.scalar(select(func.count()).select_from(Recipe))


def test_new_curated_recipe_is_added_even_after_ai_recipes(db):
    # AI 레시피가 저장돼 테이블이 비어 있지 않은 상태에서, data.py 에 레시피가 새로 추가된 상황
    db.add(Recipe(title="AI 볶음", cook_minutes=10, source=RecipeSource.AI))
    db.delete(db.scalar(select(Recipe).where(Recipe.title == RECIPES[0]["title"])))
    db.commit()
    assert _count(db) == len(RECIPES)

    seed_all(db)
    assert db.scalar(select(Recipe).where(Recipe.title == RECIPES[0]["title"])) is not None
    assert _count(db) == len(RECIPES) + 1

    seed_all(db)  # 다시 돌려도 중복 없음
    assert _count(db) == len(RECIPES) + 1
