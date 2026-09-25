"""반복 규칙 → 다음 발생 시각 계산 (순수 함수, DB 의존 없음 → 단위 테스트 쉬움)."""

import calendar
from datetime import date, datetime, timedelta

from app.features.reminders.models import Reminder, RepeatType


def _monthly_date(year: int, month: int, day: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def next_occurrence(r: Reminder, after: datetime) -> datetime | None:
    """after 이후(초과) 가장 가까운 '해야 하는 날' 시각. 규칙이 잘못됐으면 None."""
    interval = max(r.interval, 1)

    if r.repeat_type == RepeatType.DAILY:
        d = max(after.date(), r.anchor_date)
        offset = (d - r.anchor_date).days % interval
        if offset:
            d += timedelta(days=interval - offset)
        while datetime.combine(d, r.remind_time) <= after:
            d += timedelta(days=interval)
        return datetime.combine(d, r.remind_time)

    if r.repeat_type == RepeatType.WEEKLY:
        if not r.weekdays:
            return None
        anchor_monday = r.anchor_date - timedelta(days=r.anchor_date.weekday())
        d = max(after.date(), r.anchor_date)
        for _ in range(7 * interval + 7):
            week_idx = (d - anchor_monday).days // 7
            candidate = datetime.combine(d, r.remind_time)
            if d.weekday() in r.weekdays and week_idx % interval == 0 and candidate > after:
                return candidate
            d += timedelta(days=1)
        return None

    if r.repeat_type == RepeatType.MONTHLY:
        if not r.day_of_month:
            return None
        y, m = after.year, after.month
        for _ in range(24 * interval):
            months_from_anchor = (y - r.anchor_date.year) * 12 + (m - r.anchor_date.month)
            if months_from_anchor >= 0 and months_from_anchor % interval == 0:
                candidate = datetime.combine(_monthly_date(y, m, r.day_of_month), r.remind_time)
                if candidate > after:
                    return candidate
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
        return None

    return None


def next_notify_at(r: Reminder, after: datetime) -> tuple[datetime, datetime] | None:
    """(알림 보낼 시각, 해야 하는 날) — '3일 전 알림'을 반영. 이미 지난 알림 시각은 건너뛴다."""
    probe = after
    for _ in range(60):
        due = next_occurrence(r, probe)
        if due is None:
            return None
        notify = due - timedelta(days=r.notify_before_days)
        if notify > after:
            return notify, due
        probe = due
    return None
