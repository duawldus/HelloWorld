import logging
from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.exceptions import NotFoundError
from app.features.notifications.models import NotificationLog, NotificationType, PushDevice
from app.features.notifications.schemas import DeviceRegister, PushMessage
from app.features.notifications.sender import PushSender
from app.features.users.models import User

logger = logging.getLogger(__name__)


def register_device(db: Session, user: User, data: DeviceRegister) -> PushDevice:
    """같은 토큰이 이미 있으면 소유자를 현재 사용자로 갱신 (기기 재설치 대응)."""
    device = db.scalar(select(PushDevice).where(PushDevice.token == data.token))
    if device is None:
        device = PushDevice(user_id=user.id, token=data.token, platform=data.platform)
        db.add(device)
    else:
        device.user_id = user.id
        device.platform = data.platform
    db.commit()
    return device


def unregister_device(db: Session, user: User, token: str) -> None:
    device = db.scalar(select(PushDevice).where(PushDevice.token == token, PushDevice.user_id == user.id))
    if device is None:
        raise NotFoundError("등록되지 않은 기기입니다.")
    db.delete(device)
    db.commit()


def list_history(db: Session, user: User, limit: int = 30) -> list[NotificationLog]:
    """놓친 알림 다시 보기용 발송 이력."""
    stmt = (
        select(NotificationLog)
        .where(NotificationLog.user_id == user.id)
        .order_by(NotificationLog.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt))


# ---------- 발송 (jobs.py 에서 사용) ----------


def already_sent(db: Session, user_id: int, type_: NotificationType, on: date, ref_id: int | None = None) -> bool:
    """그 날 이미 보냈는지. ref_id=None 이면 같은 종류 알림을 하나라도 보냈는지 본다."""
    stmt = select(NotificationLog.id).where(
        NotificationLog.user_id == user_id, NotificationLog.type == type_, NotificationLog.sent_on == on
    )
    if ref_id is not None:
        stmt = stmt.where(NotificationLog.ref_id == ref_id)
    return db.scalar(stmt.limit(1)) is not None


def deliver(
    db: Session,
    sender: PushSender,
    user_id: int,
    type_: NotificationType,
    ref_id: int | None,
    message: PushMessage,
    on: date,
) -> bool:
    """이력을 먼저 저장(=발송권 확보)한 뒤 사용자의 모든 기기로 보낸다. 이미 보낸 알림이면 False.

    - 유니크 제약 (user, type, ref_id, sent_on) 에 걸리면 다른 잡이 먼저 보낸 것 → 보내지 않는다.
    - 기기가 없어도 이력은 남긴다 → 앱을 열면 '받은 알림'에서 볼 수 있다.
    - Expo 가 DeviceNotRegistered 라고 한 토큰은 지운다.
    """
    log = NotificationLog(
        user_id=user_id, type=type_, ref_id=ref_id, title=message.title, body=message.body, sent_on=on
    )
    db.add(log)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return False

    tokens = list(db.scalars(select(PushDevice.token).where(PushDevice.user_id == user_id)))
    if not tokens:
        return True
    dead = sender.send(tokens, message)
    if dead:
        db.execute(delete(PushDevice).where(PushDevice.token.in_(dead)))
        db.commit()
        logger.info("[PUSH] 만료된 토큰 %d개 삭제", len(dead))
    return True
