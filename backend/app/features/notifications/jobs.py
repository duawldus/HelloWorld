"""주기 실행 잡. app/scheduler.py 가 등록한다 (SCHEDULER_ENABLED=true 일 때).

[화면 9] 푸시 알림 시나리오
  - 유통기한 알림: 매일 오전 9시, 임박 재료가 있는 사용자에게 → 탭하면 레시피 추천
    예) "두부 유통기한이 내일까지예요" / "냉장고에 두부 1모 있어요. 두부계란찜은 어때요?"
  - 생활 알림: 사용자가 설정한 요일·시각(및 N일 전)에 → 탭하면 생활 알림
    예) "지금 빨래하기 시간이에요" / "전기요금 납부까지 3일 남았어요"
  - 같은 날 같은 대상은 한 번만 (service.already_sent + NotificationLog 유니크 제약)

run_* 함수는 db · sender · 기준 시각을 받아서 테스트에서 바로 호출할 수 있다.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.db import SessionLocal
from app.common.exceptions import ValidationError
from app.common.time import d_day, now
from app.features.ingredients import service as ingredients
from app.features.ingredients.models import Ingredient, IngredientStatus
from app.features.notifications import service
from app.features.notifications.models import NotificationType
from app.features.notifications.schemas import PushMessage
from app.features.notifications.sender import PushSender, get_sender
from app.features.recipes import service as recipes
from app.features.recipes.schemas import RecommendQuery
from app.features.reminders.models import Reminder
from app.features.reminders.schedule import next_notify_at
from app.features.users.models import User

logger = logging.getLogger(__name__)

EXPIRY_DEEPLINK = "bangguseok://recipes"
REMINDER_DEEPLINK = "bangguseok://reminders"
# Android 알림 채널 — 앱(frontend/src/notifications/index.js 의 CHANNELS)이 만든 id 와 같아야 한다
EXPIRY_CHANNEL = "expiry"
REMINDER_CHANNEL = "reminders"


# ---------- 유통기한 알림 ----------


def _left_text(days: int) -> str:
    if days == 0:
        return "오늘까지예요"
    if days == 1:
        return "내일까지예요"
    return f"{days}일 남았어요"


def _eun_neun(word: str) -> str:
    """받침 있으면 '은', 없으면 '는' (한글이 아니면 '은(는)')."""
    last = word[-1] if word else ""
    if not "가" <= last <= "힣":
        return "은(는)"
    return "은" if (ord(last) - ord("가")) % 28 else "는"


def _suggest_recipe_title(db: Session, user: User) -> str | None:
    """임박 재료를 쓰는 추천 레시피 1개. AI 생성은 하지 않는다 (잡에서 LLM 호출 X)."""
    try:
        res = recipes.recommend(db, user, RecommendQuery(limit=1, allow_ai=False), generator=None)
    except ValidationError:
        return None
    card = next((c for c in res.ready + res.almost if c.uses_imminent), None)
    return card.title if card else None


def build_expiry_message(db: Session, user: User, imminent: list[Ingredient], today) -> PushMessage:
    first = imminent[0]
    name = first.name if len(imminent) == 1 else f"{first.name} 외 {len(imminent) - 1}개"
    title = f"{name} 유통기한이 {_left_text(d_day(first.expires_on, today))}"
    body = f"냉장고에 {first.name} {recipes.format_amount(first.quantity, first.unit)} 있어요."
    recipe_title = _suggest_recipe_title(db, user)
    body += f" {recipe_title}{_eun_neun(recipe_title)} 어때요?" if recipe_title else " 오늘 요리해 보세요!"
    return PushMessage(title=title, body=body, deeplink=EXPIRY_DEEPLINK, channel=EXPIRY_CHANNEL)


def run_expiry_alerts(db: Session, sender: PushSender, at: datetime) -> int:
    """오늘 ~ D-IMMINENT_DAYS 재료가 있는 사용자에게 하루 1번. 이미 지난 재료는 알리지 않는다. 보낸 수 반환."""
    today = at.date()
    last_day = today + timedelta(days=settings.IMMINENT_DAYS)
    user_ids = db.scalars(
        select(Ingredient.user_id)
        .where(
            Ingredient.status == IngredientStatus.ACTIVE,
            Ingredient.expires_on >= today,
            Ingredient.expires_on <= last_day,
        )
        .distinct()
    ).all()

    sent = 0
    for user_id in user_ids:
        if service.already_sent(db, user_id, NotificationType.EXPIRY, today):
            continue
        user = db.get(User, user_id)
        imminent = [i for i in ingredients.list_active(db, user_id) if today <= i.expires_on <= last_day]
        if user is None or not imminent:
            continue
        message = build_expiry_message(db, user, imminent, today)
        # ref_id = 가장 급한 재료. 중복 판단은 already_sent 로 '사용자당 하루 1번'
        if service.deliver(db, sender, user_id, NotificationType.EXPIRY, imminent[0].id, message, today):
            sent += 1
    logger.info("[PUSH] 유통기한 알림 %d명 발송", sent)
    return sent


def send_expiry_alerts() -> None:
    with SessionLocal() as db:
        run_expiry_alerts(db, get_sender(), now())


# ---------- 생활 알림 ----------


def build_reminder_message(r: Reminder, due: datetime) -> PushMessage:
    if r.notify_before_days > 0:
        body = f"{r.title}까지 {r.notify_before_days}일 남았어요 ({due.month}월 {due.day}일)"
    else:
        body = f"지금 {r.title} 시간이에요"
    return PushMessage(title=r.title, body=body, deeplink=REMINDER_DEEPLINK, channel=REMINDER_CHANNEL)


def run_reminder_alerts(db: Session, sender: PushSender, at: datetime) -> int:
    """알림 시각이 (at-1분, at] 에 들어오는 활성 생활 알림을 보낸다. 보낸 수 반환."""
    at = at.replace(second=0, microsecond=0)
    window_start = at - timedelta(minutes=1)
    sent = 0
    for r in db.scalars(select(Reminder).where(Reminder.enabled.is_(True))).all():
        nxt = next_notify_at(r, window_start)
        if nxt is None or nxt[0] > at:
            continue
        notify_at, due = nxt
        on = notify_at.date()
        if service.already_sent(db, r.user_id, NotificationType.REMINDER, on, ref_id=r.id):
            continue
        message = build_reminder_message(r, due)
        if service.deliver(db, sender, r.user_id, NotificationType.REMINDER, r.id, message, on):
            sent += 1
    if sent:
        logger.info("[PUSH] 생활 알림 %d건 발송", sent)
    return sent


def send_reminder_alerts() -> None:
    """매 분 실행."""
    with SessionLocal() as db:
        run_reminder_alerts(db, get_sender(), now())
