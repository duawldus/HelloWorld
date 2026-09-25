from datetime import date, datetime, time

from app.features.reminders.models import Reminder, ReminderCategory, RepeatType
from app.features.reminders.schedule import next_notify_at, next_occurrence

API = "/api/v1/reminders"


def _reminder(**kw) -> Reminder:
    base = dict(
        category=ReminderCategory.LAUNDRY,
        title="빨래하기",
        repeat_type=RepeatType.WEEKLY,
        interval=1,
        weekdays=[1, 4],  # 화, 금
        day_of_month=None,
        remind_time=time(20, 0),
        notify_before_days=0,
        anchor_date=date(2026, 9, 21),  # 월요일
    )
    base.update(kw)
    return Reminder(**base)


def test_weekly_next_occurrence():
    r = _reminder()
    # 2026-09-25(금) 19:00 → 같은 날 20:00
    assert next_occurrence(r, datetime(2026, 9, 25, 19, 0)) == datetime(2026, 9, 25, 20, 0)
    # 20:00 이후 → 다음 주 화요일
    assert next_occurrence(r, datetime(2026, 9, 25, 21, 0)) == datetime(2026, 9, 29, 20, 0)


def test_biweekly_skips_off_week():
    r = _reminder(interval=2, weekdays=[5], remind_time=time(10, 0))  # 2주마다 토
    assert next_occurrence(r, datetime(2026, 9, 21, 0, 0)) == datetime(2026, 9, 26, 10, 0)
    assert next_occurrence(r, datetime(2026, 9, 27, 0, 0)) == datetime(2026, 10, 10, 10, 0)


def test_monthly_with_notify_before():
    r = _reminder(repeat_type=RepeatType.MONTHLY, weekdays=[], day_of_month=25, notify_before_days=3)
    notify, due = next_notify_at(r, datetime(2026, 9, 21, 0, 0))
    assert due == datetime(2026, 9, 25, 20, 0)
    assert notify == datetime(2026, 9, 22, 20, 0)


def test_monthly_clamps_to_last_day():
    r = _reminder(repeat_type=RepeatType.MONTHLY, weekdays=[], day_of_month=31, anchor_date=date(2026, 1, 1))
    assert next_occurrence(r, datetime(2026, 2, 1)) == datetime(2026, 2, 28, 20, 0)


def test_crud_and_toggle(client, auth_headers):
    payload = {
        "category": "LAUNDRY",
        "title": "빨래하기",
        "repeat_type": "WEEKLY",
        "weekdays": [1, 4],
        "remind_time": "20:00",
    }
    created = client.post(API, json=payload, headers=auth_headers).json()
    assert created["summary"] == "매주 화·금 · 오후 8:00"

    body = client.get(API, headers=auth_headers).json()
    assert body["enabled_count"] == 1
    assert body["groups"][0]["category"] == "LAUNDRY"

    toggled = client.patch(f"{API}/{created['id']}", json={"enabled": False}, headers=auth_headers).json()
    assert toggled["enabled"] is False
    assert toggled["next_notify_at"] is None


def test_weekly_requires_weekdays(client, auth_headers):
    payload = {"category": "CLEANING", "title": "청소", "repeat_type": "WEEKLY", "remind_time": "09:00"}
    assert client.post(API, json=payload, headers=auth_headers).status_code == 422


def test_complete_awards_xp(client, auth_headers):
    payload = {"category": "CLEANING", "title": "분리수거", "repeat_type": "DAILY", "remind_time": "21:00"}
    rid = client.post(API, json=payload, headers=auth_headers).json()["id"]
    assert client.post(f"{API}/{rid}/complete", headers=auth_headers).json()["xp"]["amount"] == 5
    logs = client.get("/api/v1/gamification/xp-logs", headers=auth_headers).json()
    assert logs[0]["description"] == "분리수거 완료"
