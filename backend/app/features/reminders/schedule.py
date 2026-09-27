"""반복 규칙 → 다음 발생 시각 계산 (순수 함수, DB 의존 없음 → 단위 테스트 쉬움)."""

import calendar
from datetime import date, datetime, time, timedelta

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


def next_due_date(r: Reminder, on: date) -> date | None:
    """on 다음 날부터 가장 가까운 '해야 하는 날'."""
    due = next_occurrence(r, datetime.combine(on, time.max))
    return due.date() if due else None


def prev_due_date(r: Reminder, on: date) -> date | None:
    """on 당일을 포함해 가장 최근의 '해야 하는 날'. 알림을 만들기 전(anchor_date 이전) 날짜는 없는 것으로 본다."""
    interval = max(r.interval, 1)
    span = {RepeatType.DAILY: interval, RepeatType.WEEKLY: 7 * interval}.get(r.repeat_type, 31 * interval + 1)
    probe = datetime.combine(on - timedelta(days=span), time.min) - timedelta(microseconds=1)
    last = None
    while (due := next_occurrence(r, probe)) and due.date() <= on:
        last, probe = due.date(), due
    return last if last and last >= r.anchor_date else None


def cycle_due_date(r: Reminder, at: datetime, last_done_due: date | None) -> date:
    """at 에 완료하면 어느 회차(해야 하는 날)로 칠지. last_done_due = 마지막으로 완료한 회차.

    1. 오늘이 해야 하는 날이면 → 오늘 회차
    2. 다음 회차의 'N일 전 알림' 기간에 들어왔으면 → 다음 회차 (예: 25일 납부, 3일 전 알림 → 22일부터는 이번 달 회차)
    3. 지난 회차를 아직 안 했으면 → 지난 회차 (늦게 한 것. 예: 화요일 빨래를 수요일에 → 화요일 회차)
    4. 그 외 → 다음 회차 (미리 한 것)
    규칙이 잘못돼 날짜를 못 구하면 at 의 날짜(= 하루 1번)로 본다.
    """
    on = at.date()
    prev, nxt = prev_due_date(r, on), next_due_date(r, on)
    if prev == on:
        return on
    if nxt and on >= nxt - timedelta(days=r.notify_before_days):
        return nxt
    if prev and prev != last_done_due:
        return prev
    return nxt or on
