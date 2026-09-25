from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base
from app.common.models import TimestampMixin
from app.common.time import now


class Platform(StrEnum):
    IOS = "IOS"
    ANDROID = "ANDROID"
    WEB = "WEB"


class NotificationType(StrEnum):
    EXPIRY = "EXPIRY"  # 유통기한 임박 → 딥링크: 레시피 추천[4]
    REMINDER = "REMINDER"  # 생활 알림 → 딥링크: 생활 알림[6]


class PushDevice(TimestampMixin, Base):
    """Expo 푸시 토큰 (ExponentPushToken[...])."""

    __tablename__ = "push_devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(300), unique=True)
    platform: Mapped[Platform] = mapped_column(String(10))


class NotificationLog(Base):
    """발송 이력. (user, type, ref_id, sent_on) 유니크 → 같은 날 중복 발송 방지."""

    __tablename__ = "notification_logs"
    __table_args__ = (UniqueConstraint("user_id", "type", "ref_id", "sent_on"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    type: Mapped[NotificationType] = mapped_column(String(10))
    ref_id: Mapped[int | None] = mapped_column(default=None)  # ingredient_id / reminder_id
    title: Mapped[str] = mapped_column(String(100))
    body: Mapped[str] = mapped_column(String(200))
    sent_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
