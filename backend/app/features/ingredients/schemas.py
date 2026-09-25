from datetime import date

from pydantic import BaseModel, Field

from app.common.schemas import ORMModel
from app.features.gamification.schemas import XpGain
from app.features.ingredients.models import IngredientStatus, RegisterSource, StorageType


class PresetRead(ORMModel):
    id: int
    name: str
    icon: str | None
    default_storage: StorageType
    shelf_life_days: int
    default_quantity: float
    default_unit: str


class IngredientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    preset_id: int | None = None
    quantity: float | None = Field(default=None, gt=0, description="생략 시 프리셋 기본값 또는 1")
    unit: str | None = Field(default=None, max_length=10)
    storage: StorageType | None = None
    expires_on: date | None = Field(default=None, description="생략 시 프리셋 기본 소비기한으로 자동 계산")


class IngredientBatchCreate(BaseModel):
    """[화면 3-2] AI 인식 결과 일괄 등록 등."""

    source: RegisterSource = RegisterSource.PHOTO
    items: list[IngredientCreate] = Field(min_length=1, max_length=50)


class IngredientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=30)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=10)
    storage: StorageType | None = None
    expires_on: date | None = None


class IngredientRead(ORMModel):
    id: int
    preset_id: int | None
    name: str
    icon: str | None = None
    quantity: float
    unit: str
    storage: StorageType
    expires_on: date
    d_day: int
    is_imminent: bool  # D-3 이하
    status: IngredientStatus
    source: RegisterSource


class IngredientListResponse(BaseModel):
    """[화면 2] 냉장고. items는 유통기한 임박순.

    FE는 is_imminent로 '3일 안에 먹어야 해요' / '여유 있어요' 섹션을 나눈다.
    """

    total: int
    imminent_count: int
    storage_counts: dict[StorageType, int]
    items: list[IngredientRead]


class IngredientBatchResponse(BaseModel):
    items: list[IngredientRead]
    xp: XpGain | None = None
