from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base
from app.common.models import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    device_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(30), default="자취생")
    onboarded: Mapped[bool] = mapped_column(default=False)

    # 게이미피케이션 (값 변경은 gamification 도메인의 service만 담당)
    xp: Mapped[int] = mapped_column(default=0)
    level: Mapped[int] = mapped_column(default=1)
    current_streak: Mapped[int] = mapped_column(default=0)
    best_streak: Mapped[int] = mapped_column(default=0)
    last_active_date: Mapped[date | None] = mapped_column(Date, default=None)


class Seasoning(Base):
    """기본 양념 마스터 (간장, 식용유, 소금 ...). seeds에서 채운다."""

    __tablename__ = "seasonings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True)
    icon: Mapped[str | None] = mapped_column(String(16), default=None)
    sort_order: Mapped[int] = mapped_column(default=0)


class UserSeasoning(Base):
    """사용자가 보유한 기본 양념. 레시피 매칭 시 '보유 재료'로 취급한다."""

    __tablename__ = "user_seasonings"
    __table_args__ = (UniqueConstraint("user_id", "seasoning_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    seasoning_id: Mapped[int] = mapped_column(ForeignKey("seasonings.id", ondelete="CASCADE"))
