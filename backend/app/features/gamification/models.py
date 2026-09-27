from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base
from app.common.time import now
from app.features.gamification.rules import BadgeCondition, XpAction


class XpLog(Base):
    """XP 획득/회수 이력. [화면 8] '최근 획득 XP' 목록."""

    __tablename__ = "xp_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    action: Mapped[XpAction] = mapped_column(String(30))
    amount: Mapped[int]
    description: Mapped[str] = mapped_column(String(100))
    ref_id: Mapped[int | None] = mapped_column(default=None)  # 관련 cook_log / reminder id 등
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)


class Badge(Base):
    """뱃지 마스터. seeds에서 채운다."""

    __tablename__ = "badges"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(100))
    icon: Mapped[str | None] = mapped_column(String(16), default=None)
    condition: Mapped[BadgeCondition] = mapped_column(String(30))
    threshold: Mapped[int]
    sort_order: Mapped[int] = mapped_column(default=0)


class UserBadge(Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"))
    acquired_at: Mapped[datetime] = mapped_column(DateTime, default=now)
