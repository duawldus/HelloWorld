"""[화면 2] 냉장고 · [화면 3] 식재료 추가"""

from fastapi import APIRouter, Query, status

from app.common.deps import CurrentUser, DbSession
from app.features.ingredients import service
from app.features.ingredients.models import RegisterSource, StorageType
from app.features.ingredients.schemas import (
    IngredientBatchCreate,
    IngredientBatchResponse,
    IngredientCreate,
    IngredientListResponse,
    IngredientRead,
    IngredientUpdate,
    PresetRead,
)

router = APIRouter(prefix="/ingredients", tags=["ingredients"])


# NOTE: /presets 가 /{ingredient_id} 보다 위에 있어야 한다


@router.get("/presets", response_model=list[PresetRead])
def list_presets(
    db: DbSession,
    _: CurrentUser,
    q: str | None = Query(None, description="재료 검색어"),
    frequent: bool = Query(False, description="True면 '자주 쓰는 재료'만"),
):
    return service.list_presets(db, q, frequent)


@router.get("", response_model=IngredientListResponse)
def list_ingredients(db: DbSession, user: CurrentUser, storage: StorageType | None = None):
    """내 냉장고. storage 필터(냉장/냉동/실온), 생략 시 전체. 항상 유통기한 임박순."""
    return service.list_ingredients(db, user, storage)


@router.post("", response_model=IngredientRead, status_code=status.HTTP_201_CREATED)
def create_ingredient(
    data: IngredientCreate,
    db: DbSession,
    user: CurrentUser,
    source: RegisterSource = RegisterSource.MANUAL,
):
    """단건 등록. 프리셋 아이콘 탭이면 source=PRESET."""
    return service.create_ingredient(db, user, data, source)


@router.post("/batch", response_model=IngredientBatchResponse, status_code=status.HTTP_201_CREATED)
def create_batch(data: IngredientBatchCreate, db: DbSession, user: CurrentUser):
    """여러 개 일괄 등록 ([화면 3-2] '재료 N개 등록하기'). source=PHOTO면 XP 지급."""
    return service.create_batch(db, user, data.items, data.source)


@router.get("/{ingredient_id}", response_model=IngredientRead)
def get_ingredient(ingredient_id: int, db: DbSession, user: CurrentUser):
    return service.read_one(db, service.get_owned(db, user, ingredient_id))


@router.patch("/{ingredient_id}", response_model=IngredientRead)
def update_ingredient(ingredient_id: int, data: IngredientUpdate, db: DbSession, user: CurrentUser):
    return service.update_ingredient(db, user, ingredient_id, data)


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingredient(ingredient_id: int, db: DbSession, user: CurrentUser):
    service.delete_ingredient(db, user, ingredient_id)
