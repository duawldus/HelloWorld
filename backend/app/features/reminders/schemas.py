from datetime import datetime, time

from pydantic import BaseModel, Field, model_validator

from app.common.schemas import ORMModel
from app.features.gamification.schemas import XpGain
from app.features.reminders.models import ReminderCategory, RepeatType


class ReminderBase(BaseModel):
    category: ReminderCategory
    title: str = Field(min_length=1, max_length=40)
    repeat_type: RepeatType
    interval: int = Field(1, ge=1, le=12)
    weekdays: list[int] = Field(default_factory=list, description="0=월 ... 6=일")
    day_of_month: int | None = Field(None, ge=1, le=31)
    remind_time: time
    notify_before_days: int = Field(0, ge=0, le=14)


class ReminderCreate(ReminderBase):
    """[화면 7] 알림 추가."""

    @model_validator(mode="after")
    def _check_rule(self):
        validate_rule(self.repeat_type, self.weekdays, self.day_of_month)
        return self


class ReminderUpdate(BaseModel):
    """부분 수정. 토글은 {"enabled": false} 만 보내면 된다."""

    category: ReminderCategory | None = None
    title: str | None = Field(None, min_length=1, max_length=40)
    repeat_type: RepeatType | None = None
    interval: int | None = Field(None, ge=1, le=12)
    weekdays: list[int] | None = None
    day_of_month: int | None = Field(None, ge=1, le=31)
    remind_time: time | None = None
    notify_before_days: int | None = Field(None, ge=0, le=14)
    enabled: bool | None = None


def validate_rule(repeat_type: RepeatType, weekdays: list[int], day_of_month: int | None) -> None:
    if any(not 0 <= w <= 6 for w in weekdays):
        raise ValueError("weekdays는 0(월)~6(일) 사이여야 합니다.")
    if repeat_type == RepeatType.WEEKLY and not weekdays:
        raise ValueError("매주 반복은 요일을 1개 이상 선택해야 합니다.")
    if repeat_type == RepeatType.MONTHLY and day_of_month is None:
        raise ValueError("매달 반복은 day_of_month가 필요합니다.")


class ReminderRead(ORMModel):
    id: int
    category: ReminderCategory
    title: str
    repeat_type: RepeatType
    interval: int
    weekdays: list[int]
    day_of_month: int | None
    remind_time: time
    notify_before_days: int
    enabled: bool
    next_due_at: datetime | None = None  # 다음에 해야 하는 날 (목록의 '오늘', '9/26', 'D-3')
    next_notify_at: datetime | None = None  # 다음 푸시 발송 시각
    summary: str = ""  # '매주 화·금 · 오후 8:00'


class ReminderGroup(BaseModel):
    category: ReminderCategory
    items: list[ReminderRead]


class ReminderListResponse(BaseModel):
    """[화면 6] 생활 알림."""

    enabled_count: int  # '알림 5개 켜짐'
    next_reminder: ReminderRead | None  # 상단 '다음 알림' 배너
    groups: list[ReminderGroup]


class ReminderCompleteResponse(BaseModel):
    reminder: ReminderRead
    xp: XpGain
