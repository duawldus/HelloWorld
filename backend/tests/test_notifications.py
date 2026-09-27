from datetime import date, datetime, time, timedelta

import httpx
import pytest
from sqlalchemy import select

from app.common.time import today
from app.features.ingredients.models import Ingredient, IngredientStatus
from app.features.notifications import jobs
from app.features.notifications.models import NotificationLog, NotificationType, Platform, PushDevice
from app.features.notifications.schemas import PushMessage
from app.features.notifications.sender import EXPO_PUSH_URL, ExpoPushSender
from app.features.reminders.models import Reminder, ReminderCategory, RepeatType
from app.features.users.models import User

# 유통기한 알림은 레시피 추천(실제 오늘 기준 d_day)을 함께 쓰므로 실제 오늘로 맞춘다
TODAY = today()
MORNING = datetime.combine(TODAY, time(9, 0, 3))


class FakeSender:
    def __init__(self, dead: list[str] | None = None):
        self.sent: list[tuple[list[str], PushMessage]] = []
        self.dead = dead or []

    def send(self, tokens: list[str], message: PushMessage) -> list[str]:
        self.sent.append((tokens, message))
        return self.dead


@pytest.fixture()
def user(db) -> User:
    u = User(device_id="notify-device-0001")
    db.add(u)
    db.flush()
    db.add(PushDevice(user_id=u.id, token="ExponentPushToken[aaa]", platform=Platform.IOS))
    db.commit()
    return u


def _ingredient(db, user, name, days, quantity=1, unit="모", status=IngredientStatus.ACTIVE):
    db.add(
        Ingredient(
            user_id=user.id,
            name=name,
            quantity=quantity,
            unit=unit,
            expires_on=TODAY + timedelta(days=days),
            status=status,
        )
    )
    db.commit()


def _logs(db) -> list[NotificationLog]:
    return list(db.scalars(select(NotificationLog).order_by(NotificationLog.id)))


# ---------- 유통기한 알림 ----------


def test_expiry_alert_uses_most_imminent_and_suggests_recipe(db, user):
    _ingredient(db, user, "계란", 3, quantity=10, unit="개")
    _ingredient(db, user, "두부", 1)
    _ingredient(db, user, "우유", 10, unit="팩")  # 임박 아님

    sender = FakeSender()
    assert jobs.run_expiry_alerts(db, sender, MORNING) == 1

    tokens, msg = sender.sent[0]
    assert tokens == ["ExponentPushToken[aaa]"]
    assert msg.title == "두부 외 1개 유통기한이 내일까지예요"
    assert msg.body.startswith("냉장고에 두부 1모 있어요.")
    assert "어때요?" in msg.body  # 시드 레시피 중 두부를 쓰는 레시피 추천
    assert (msg.deeplink, msg.channel) == (jobs.EXPIRY_DEEPLINK, "expiry")

    [log] = _logs(db)
    assert (log.type, log.sent_on, log.title) == (NotificationType.EXPIRY, TODAY, msg.title)


def test_expiry_alert_once_per_day(db, user):
    _ingredient(db, user, "두부", 0)
    sender = FakeSender()
    assert jobs.run_expiry_alerts(db, sender, MORNING) == 1
    _ingredient(db, user, "대파", 1)  # 재료가 바뀌어도 같은 날엔 다시 안 보낸다
    assert jobs.run_expiry_alerts(db, sender, MORNING + timedelta(hours=1)) == 0
    assert len(sender.sent) == 1
    # 다음 날은 다시 보낸다 (대파가 오늘까지)
    assert jobs.run_expiry_alerts(db, sender, MORNING + timedelta(days=1)) == 1


def test_expiry_alert_skips_expired_consumed_and_far(db, user):
    _ingredient(db, user, "두부", -1)  # 이미 지남
    _ingredient(db, user, "계란", 1, status=IngredientStatus.CONSUMED)
    _ingredient(db, user, "우유", 4)
    assert jobs.run_expiry_alerts(db, FakeSender(), MORNING) == 0
    assert _logs(db) == []


def test_expiry_alert_logged_even_without_device(db, user):
    db.query(PushDevice).delete()
    db.commit()
    _ingredient(db, user, "두부", 2)
    sender = FakeSender()
    assert jobs.run_expiry_alerts(db, sender, MORNING) == 1
    assert sender.sent == []  # 보낼 기기는 없지만
    assert len(_logs(db)) == 1  # '받은 알림' 이력에는 남는다


def test_dead_token_is_removed(db, user):
    _ingredient(db, user, "두부", 2)
    jobs.run_expiry_alerts(db, FakeSender(dead=["ExponentPushToken[aaa]"]), MORNING)
    assert db.scalars(select(PushDevice)).all() == []


def test_eun_neun():
    assert jobs._eun_neun("두부계란찜") == "은"
    assert jobs._eun_neun("두부 계란부침") == "은"
    assert jobs._eun_neun("김치찌개") == "는"
    assert jobs._eun_neun("BLT") == "은(는)"


# ---------- 생활 알림 ----------


def _reminder(db, user, **kw) -> Reminder:
    base = dict(
        user_id=user.id,
        category=ReminderCategory.LAUNDRY,
        title="빨래하기",
        repeat_type=RepeatType.WEEKLY,
        weekdays=[4],  # 금
        remind_time=time(20, 0),
        anchor_date=date(2026, 9, 21),
    )
    base.update(kw)
    r = Reminder(**base)
    db.add(r)
    db.commit()
    return r


def test_reminder_alert_fires_only_in_its_minute(db, user):
    r = _reminder(db, user)
    sender = FakeSender()
    assert jobs.run_reminder_alerts(db, sender, datetime(2026, 9, 25, 19, 59, 0, 500)) == 0
    assert jobs.run_reminder_alerts(db, sender, datetime(2026, 9, 25, 20, 0, 0, 800)) == 1
    assert jobs.run_reminder_alerts(db, sender, datetime(2026, 9, 25, 20, 1, 0, 100)) == 0

    [(_, msg)] = sender.sent
    assert (msg.title, msg.body) == ("빨래하기", "지금 빨래하기 시간이에요")
    assert (msg.deeplink, msg.channel) == (jobs.REMINDER_DEEPLINK, "reminders")
    [log] = _logs(db)
    assert (log.type, log.ref_id, log.sent_on) == (NotificationType.REMINDER, r.id, date(2026, 9, 25))


def test_reminder_alert_not_sent_twice_same_day(db, user):
    _reminder(db, user)
    sender = FakeSender()
    at = datetime(2026, 9, 25, 20, 0, 1)
    assert jobs.run_reminder_alerts(db, sender, at) == 1
    assert jobs.run_reminder_alerts(db, sender, at) == 0  # 잡이 두 번 돌아도 한 번만
    assert len(sender.sent) == 1


def test_reminder_alert_days_before(db, user):
    _reminder(
        db,
        user,
        category=ReminderCategory.BILL,
        title="전기요금 납부",
        repeat_type=RepeatType.MONTHLY,
        weekdays=[],
        day_of_month=28,
        remind_time=time(10, 0),
        notify_before_days=3,
    )
    sender = FakeSender()
    assert jobs.run_reminder_alerts(db, sender, datetime(2026, 9, 25, 10, 0)) == 1
    assert sender.sent[0][1].body == "전기요금 납부까지 3일 남았어요 (9월 28일)"


def test_reminder_alert_skipped_when_cycle_already_done(db, user):
    r = _reminder(
        db,
        user,
        category=ReminderCategory.BILL,
        title="전기요금 납부",
        repeat_type=RepeatType.MONTHLY,
        weekdays=[],
        day_of_month=28,
        remind_time=time(10, 0),
        notify_before_days=3,
        anchor_date=date(2026, 8, 1),
        last_done_due=date(2026, 8, 28),  # 지난달 회차 완료 → 이번 회차 알림은 보낸다
    )
    at = datetime(2026, 9, 25, 10, 0)
    assert jobs.run_reminder_alerts(db, FakeSender(), at) == 1

    db.query(NotificationLog).delete()
    r.last_done_due = date(2026, 9, 28)  # 이번 회차를 미리 완료 → 보내지 않는다
    db.commit()
    assert jobs.run_reminder_alerts(db, FakeSender(), at) == 0


def test_disabled_reminder_is_skipped(db, user):
    _reminder(db, user, enabled=False)
    assert jobs.run_reminder_alerts(db, FakeSender(), datetime(2026, 9, 25, 20, 0)) == 0


# ---------- Expo Push ----------


def test_expo_sender_payload_and_dead_tokens():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "data": [
                    {"status": "ok", "id": "ticket-1"},
                    {"status": "error", "message": "not registered", "details": {"error": "DeviceNotRegistered"}},
                ]
            },
        )

    sender = ExpoPushSender("secret", client=httpx.Client(transport=httpx.MockTransport(handler)))
    msg = PushMessage(title="t", body="b", deeplink="bangguseok://recipes", channel="expiry")
    dead = sender.send(["ExponentPushToken[ok]", "ExponentPushToken[gone]"], msg)

    assert dead == ["ExponentPushToken[gone]"]
    [req] = requests
    assert str(req.url) == EXPO_PUSH_URL
    assert req.headers["Authorization"] == "Bearer secret"
    body = httpx.Response(200, content=req.content).json()
    assert body[0] == {
        "to": "ExponentPushToken[ok]",
        "title": "t",
        "body": "b",
        "sound": "default",
        "priority": "high",
        "channelId": "expiry",
        "data": {"deeplink": "bangguseok://recipes"},
    }


def test_expo_sender_survives_http_error():
    sender = ExpoPushSender(client=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(500))))
    assert sender.send(["ExponentPushToken[x]"], PushMessage(title="t", body="b", deeplink="d", channel="expiry")) == []


def test_register_and_unregister_device(client, db, device_headers):
    token = "ExponentPushToken[abc-123]"
    api = "/api/v1/notifications/devices"
    assert client.post(api, json={"token": token, "platform": "ANDROID"}, headers=device_headers).status_code == 201

    res = client.post(f"{api}/unregister", json={"token": token}, headers=device_headers)
    assert res.status_code == 204
    assert db.scalar(select(PushDevice).where(PushDevice.token == token)) is None
    again = client.post(f"{api}/unregister", json={"token": token}, headers=device_headers)
    assert again.status_code == 404 and again.json()["code"] == "NOT_FOUND"
