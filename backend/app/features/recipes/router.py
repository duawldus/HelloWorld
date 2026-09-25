"""[화면 4] 레시피 추천 · [화면 5] 레시피 상세"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.common.deps import CurrentUser, DbSession
from app.features.recipes import service
from app.features.recipes.schemas import (
    CookCompleteRequest,
    CookCompleteResponse,
    CookUndoResponse,
    RecipeDetail,
    RecommendQuery,
    RecommendResponse,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("/recommendations", response_model=RecommendResponse)
def recommend(db: DbSession, user: CurrentUser, query: Annotated[RecommendQuery, Depends()]):
    """내 냉장고 + 기본 양념 기준 추천. ready(바로 가능) / almost(1~2개 부족)."""
    return service.recommend(db, user, query)


@router.get("/{recipe_id}", response_model=RecipeDetail)
def get_detail(recipe_id: int, db: DbSession, user: CurrentUser):
    """재료 체크리스트(보유/부족/대체재) + 조리 순서."""
    return service.get_detail(db, user, recipe_id)


@router.post("/{recipe_id}/complete", response_model=CookCompleteResponse)
def complete_cooking(
    recipe_id: int,
    db: DbSession,
    user: CurrentUser,
    data: CookCompleteRequest | None = None,
):
    """요리 완료 → 사용 재료 소진 + XP 지급."""
    return service.complete_cooking(db, user, recipe_id, data or CookCompleteRequest())


@router.post("/cook-logs/{cook_log_id}/undo", response_model=CookUndoResponse)
def undo_cooking(cook_log_id: int, db: DbSession, user: CurrentUser):
    """요리 완료 실행 취소 → 재료 복구 + XP 회수."""
    return service.undo_cooking(db, user, cook_log_id)
