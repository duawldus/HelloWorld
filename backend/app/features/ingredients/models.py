from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base
from app.common.models import TimestampMixin


class StorageType(StrEnum):
    FRIDGE = "FRIDGE"  # 냉장
    FREEZER = "FREEZER"  # 냉동
    ROOM = "ROOM"  # 실온


class IngredientStatus(StrEnum):
    ACTIVE = "ACTIVE"  # 냉장고에 있음
    CONSUMED = "CONSUMED"  # 요리로 소진
    DISCARDED = "DISCARDED"  # 삭제/폐기


class RegisterSource(StrEnum):
    PRESET = "PRESET"  # 자주 쓰는 재료 아이콘 탭
    MANUAL = "MANUAL"  # 직접 검색/입력
    PHOTO = "PHOTO"  # AI 사진 인식


class IngredientPreset(Base):
    """자취생 빈출 식재료 프리셋 (20~30종). 기본 소비기한 자동 지정에 사용. seeds에서 채운다."""

    __tablename__ = "ingredient_presets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    icon: Mapped[str | None] = mapped_column(String(16), default=None)
    default_storage: Mapped[StorageType] = mapped_column(String(10), default=StorageType.FRIDGE)
    shelf_life_days: Mapped[int]  # 예: 계란 21, 두부 7
    default_quantity: Mapped[float] = mapped_column(default=1)
    default_unit: Mapped[str] = mapped_column(String(10), default="개")
    is_frequent: Mapped[bool] = mapped_column(default=False)  # [화면 3] '자주 쓰는 재료'에 노출
    sort_order: Mapped[int] = mapped_column(default=0)


class Ingredient(TimestampMixin, Base):
    """사용자 냉장고 속 재료."""

    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    preset_id: Mapped[int | None] = mapped_column(ForeignKey("ingredient_presets.id"), default=None)
    name: Mapped[str] = mapped_column(String(30))
    quantity: Mapped[float] = mapped_column(default=1)
    unit: Mapped[str] = mapped_column(String(10), default="개")
    storage: Mapped[StorageType] = mapped_column(String(10), default=StorageType.FRIDGE)
    expires_on: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[IngredientStatus] = mapped_column(String(10), default=IngredientStatus.ACTIVE, index=True)
    source: Mapped[RegisterSource] = mapped_column(String(10), default=RegisterSource.MANUAL)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
