from datetime import date, timedelta

from sqlalchemy import select

from app.common.time import today
from app.features.gamification import service as gamification
from app.features.gamification.rules import XpAction
from app.features.recipes.models import Recipe
from app.features.users.models import User

API = "/api/v1"


def test_home(client, device_headers):
    empty = client.get(f"{API}/home", headers=device_headers).json()
    assert empty["today_recipe"] is None

    client.post(f"{API}/ingredients", json={"name": "두부"}, headers=device_headers)
    client.post(f"{API}/ingredients", json={"name": "계란"}, headers=device_headers)
    body = client.get(f"{API}/home", headers=device_headers).json()
    assert body["fridge"] == {"total": 2, "imminent": 0}
    assert body["level"]["title"] == "자취 새내기"
    assert body["today_recipe"] is not None


def test_home_chore_done_this_cycle(client, device_headers):
    payload = {"category": "CLEANING", "title": "설거지", "repeat_type": "DAILY", "remind_time": "23:59"}
    rid = client.post(f"{API}/reminders", json=payload, headers=device_headers).json()["id"]
    [chore] = client.get(f"{API}/home", headers=device_headers).json()["today_chores"]
    assert (chore["reminder_id"], chore["done_this_cycle"]) == (rid, False)

    client.post(f"{API}/reminders/{rid}/complete", headers=device_headers)
    [chore] = client.get(f"{API}/home", headers=device_headers).json()["today_chores"]
    assert chore["done_this_cycle"] is True


def test_stats_and_badges(client, device_headers):
    stats = client.get(f"{API}/gamification/stats", headers=device_headers).json()
    assert stats["level"] == 1 and stats["next_level_xp"] == 100
    badges = client.get(f"{API}/gamification/badges", headers=device_headers).json()
    assert badges["total_count"] == 6 and badges["acquired_count"] == 0


# ---------- 연속 기록 · 뱃지 · 레벨 · 절약 식비 ----------


def _user(db) -> User:
    user = User(device_id="unit-test-device")
    db.add(user)
    db.flush()
    return user


def test_touch_streak(db):
    user, d = _user(db), date(2026, 9, 1)
    gamification.touch_streak(user, d)
    assert (user.current_streak, user.best_streak) == (1, 1)
    gamification.touch_streak(user, d)  # 같은 날 두 번 → 그대로
    assert user.current_streak == 1
    gamification.touch_streak(user, d + timedelta(days=1))
    gamification.touch_streak(user, d + timedelta(days=2))
    assert (user.current_streak, user.best_streak) == (3, 3)
    gamification.touch_streak(user, d + timedelta(days=5))  # 끊김 → 1부터, 최고 기록은 유지
    assert (user.current_streak, user.best_streak) == (1, 3)


def test_current_streak_shows_zero_once_broken(db):
    user = _user(db)
    user.current_streak, user.last_active_date = 5, today() - timedelta(days=1)
    assert gamification.current_streak(user) == 5  # 어제까지 했으면 오늘은 아직 유지
    user.last_active_date = today() - timedelta(days=2)
    assert gamification.current_streak(user) == 0


def test_award_xp_touches_streak_but_revoke_does_not(db):
    user = _user(db)
    gamification.award_xp(db, user, XpAction.CHORE_COMPLETE, "세탁 완료")
    assert (user.current_streak, user.last_active_date) == (1, today())
    user.last_active_date = None
    gamification.award_xp(db, user, XpAction.CHORE_COMPLETE, "회수", amount=-5)
    assert user.last_active_date is None


def test_evaluate_badges_awards_once(db):
    user = _user(db)
    for _ in range(9):
        gamification.award_xp(db, user, XpAction.COOK_COMPLETE, "요리 완료")
    assert gamification.evaluate_badges(db, user) == []
    gamification.award_xp(db, user, XpAction.COOK_COMPLETE, "요리 완료")
    assert [b.code for b in gamification.evaluate_badges(db, user)] == ["HOME_COOK_MASTER"]
    assert gamification.evaluate_badges(db, user) == []  # 이미 받은 뱃지는 다시 안 줌

    badges = {b.code: b for b in gamification.list_badges(db, user).badges}
    assert badges["HOME_COOK_MASTER"].acquired and badges["HOME_COOK_MASTER"].acquired_at is not None
    assert not badges["RECIPE_20"].acquired


def test_level_summary_fields(db):
    user = _user(db)
    gamification.award_xp(db, user, XpAction.CHORE_COMPLETE, "보정", amount=240)
    s = gamification.get_level_summary(user)
    assert (s.level, s.level_min_xp, s.next_level_xp, s.xp_to_next_level) == (3, 200, 390, 150)
    assert s.level_hint == "임박 재료로 8번만 더 요리하면 달성!"  # 150 / 20 → 올림 8

    gamification.award_xp(db, user, XpAction.CHORE_COMPLETE, "보정", amount=1000)
    s = gamification.get_level_summary(user)
    assert s.next_level_xp is None and s.level_hint is None


def test_cook_complete_updates_streak_and_saved_money(client, db, device_headers):
    def add(name, days):
        body = {"name": name, "expires_on": (today() + timedelta(days=days)).isoformat()}
        return client.post(f"{API}/ingredients", json=body, headers=device_headers)

    add("두부", 1)  # 임박 → 1,500원
    add("계란", 10)  # 임박 아님 → 제외
    recipe_id = db.scalar(select(Recipe.id).where(Recipe.title == "두부계란찜"))
    assert client.post(f"{API}/recipes/{recipe_id}/complete", headers=device_headers).status_code == 200

    stats = client.get(f"{API}/gamification/stats", headers=device_headers).json()
    assert stats["current_streak"] == 1 and stats["best_streak"] == 1
    assert stats["saved_count"] == 1 and stats["saved_money_estimate"] == 1500
