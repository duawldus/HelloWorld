from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.exceptions import NotFoundError
from app.features.notifications.models import NotificationLog, PushDevice
from app.features.notifications.schemas import DeviceRegister
from app.features.users.models import User


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
