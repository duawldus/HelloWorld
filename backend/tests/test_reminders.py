from datetime import date, datetime, time

from app.features.reminders import service
from app.features.reminders.models import Reminder, ReminderCategory, RepeatType
from app.features.reminders.schedule import cycle_due_date, next_notify_at, next_occurrence

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


def test_crud_and_toggle(client, device_headers):
    payload = {
        "category": "LAUNDRY",
        "title": "빨래하기",
        "repeat_type": "WEEKLY",
        "weekdays": [1, 4],
        "remind_time": "20:00",
    }
    created = client.post(API, json=payload, headers=device_headers).json()
    assert created["summary"] == "매주 화·금 · 오후 8:00"

    body = client.get(API, headers=device_headers).json()
    assert body["enabled_count"] == 1
    assert body["groups"][0]["category"] == "LAUNDRY"

    toggled = client.patch(f"{API}/{created['id']}", json={"enabled": False}, headers=device_headers).json()
    assert toggled["enabled"] is False
    assert toggled["next_notify_at"] is None


def test_weekly_requires_weekdays(client, device_headers):
    payload = {"category": "CLEANING", "title": "청소", "repeat_type": "WEEKLY", "remind_time": "09:00"}
    assert client.post(API, json=payload, headers=device_headers).status_code == 422


def test_complete_awards_xp(client, device_headers):
    payload = {"category": "CLEANING", "title": "분리수거", "repeat_type": "DAILY", "remind_time": "21:00"}
    rid = client.post(API, json=payload, headers=device_headers).json()["id"]
    first = client.post(f"{API}/{rid}/complete", headers=device_headers).json()
    assert first["xp"]["amount"] == 5
    assert first["reminder"]["last_done_at"] is not None
    assert first["reminder"]["done_this_cycle"] is True
    logs = client.get("/api/v1/gamification/xp-logs", headers=device_headers).json()
    assert logs[0]["description"] == "분리수거 완료"


def test_cycle_due_date_weekly():
    r = _reminder()  # 매주 화·금 20:00
    # 화요일은 시각과 무관하게 화요일 회차
    assert cycle_due_date(r, datetime(2026, 9, 22, 7, 0)) == date(2026, 9, 22)
    assert cycle_due_date(r, datetime(2026, 9, 22, 23, 0)) == date(2026, 9, 22)
    # 수·목·금 → 금요일 회차
    assert cycle_due_date(r, datetime(2026, 9, 23, 12, 0)) == date(2026, 9, 25)
    assert cycle_due_date(r, datetime(2026, 9, 25, 21, 0)) == date(2026, 9, 25)


def test_cycle_due_date_monthly_notify_before():
    r = _reminder(repeat_type=RepeatType.MONTHLY, weekdays=[], day_of_month=25, notify_before_days=3)
    # 3일 전 알림 받고 22일에 납부해도 25일 회차
    assert cycle_due_date(r, datetime(2026, 9, 22, 20, 0)) == date(2026, 9, 25)
    assert cycle_due_date(r, datetime(2026, 9, 26, 9, 0)) == date(2026, 10, 25)


def test_complete_twice_in_same_cycle_gives_no_xp(client, db, device_headers, monkeypatch):
    payload = {
        "category": "LAUNDRY",
        "title": "빨래하기",
        "repeat_type": "WEEKLY",
        "weekdays": [1, 4],
        "remind_time": "20:00",
    }
    rid = client.post(API, json=payload, headers=device_headers).json()["id"]
    db.get(Reminder, rid).anchor_date = date(2026, 9, 21)  # 기본값은 실제 오늘이라 아래 시각보다 뒤일 수 있음
    db.commit()
    url = f"{API}/{rid}/complete"

    monkeypatch.setattr(service, "now", lambda: datetime(2026, 9, 23, 10, 0))  # 수 → 금 회차
    assert client.post(url, headers=device_headers).json()["xp"]["amount"] == 5

    monkeypatch.setattr(service, "now", lambda: datetime(2026, 9, 25, 21, 0))  # 금 (같은 회차)
    dup = client.post(url, headers=device_headers).json()
    assert dup["xp"] == {"amount": 0, "reasons": ["이미 완료한 집안일이에요"], "level_up": False, "new_badges": []}
    assert dup["reminder"]["last_done_at"].startswith("2026-09-23")  # 첫 완료 시각 유지

    monkeypatch.setattr(service, "now", lambda: datetime(2026, 9, 26, 9, 0))  # 토 → 다음 화 회차
    assert client.post(url, headers=device_headers).json()["xp"]["amount"] == 5

    logs = client.get("/api/v1/gamification/xp-logs", headers=device_headers).json()
    assert sum(log["description"] == "빨래하기 완료" for log in logs) == 2
