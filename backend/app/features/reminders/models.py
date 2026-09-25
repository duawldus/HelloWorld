from datetime import date, datetime, time
from enum import StrEnum

from sqlalchemy import JSON, Date, DateTime, ForeignKey, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.common.db import Base
from app.common.models import TimestampMixin
from app.common.time import today


class ReminderCategory(StrEnum):
    LAUNDRY = "LAUNDRY"  # 세탁
    CLEANING = "CLEANING"  # 청소
    BILL = "BILL"  # 공과금
    ETC = "ETC"  # 직접 입력


class RepeatType(StrEnum):
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"


class Reminder(TimestampMixin, Base):
    """생활 알림. 예) 매주 화·금 20:00 빨래하기 / 2주마다 토 10:00 / 매달 25일, 3일 전 알림."""

    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category: Mapped[ReminderCategory] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(String(40))
    repeat_type: Mapped[RepeatType] = mapped_column(String(10))
    interval: Mapped[int] = mapped_column(default=1)  # N일/N주/N달마다 (2주마다 → 2)
    weekdays: Mapped[list[int]] = mapped_column(JSON, default=list)  # WEEKLY: 0=월 ... 6=일
    day_of_month: Mapped[int | None] = mapped_column(default=None)  # MONTHLY: 1~31 (말일 초과 시 말일)
    remind_time: Mapped[time] = mapped_column(Time)
    notify_before_days: Mapped[int] = mapped_column(default=0)  # 0 = 당일, 3 = 3일 전
    anchor_date: Mapped[date] = mapped_column(Date, default=today)  # interval 계산 기준일
    enabled: Mapped[bool] = mapped_column(default=True)
    last_done_at: Mapped[datetime | None] = mapped_column(DateTime, default=None)
