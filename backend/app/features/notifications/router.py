"""[화면 9] 푸시 알림 — 기기 토큰 등록 · 알림 이력"""

from fastapi import APIRouter, Query, status

from app.common.deps import CurrentUser, DbSession
from app.features.notifications import service
from app.features.notifications.schemas import DeviceRead, DeviceRegister, NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/devices", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
def register_device(data: DeviceRegister, db: DbSession, user: CurrentUser):
    """앱 실행 시 푸시 토큰 등록/갱신."""
    return service.register_device(db, user, data)


@router.delete("/devices/{token}", status_code=status.HTTP_204_NO_CONTENT)
def unregister_device(token: str, db: DbSession, user: CurrentUser):
    service.unregister_device(db, user, token)


@router.get("", response_model=list[NotificationRead])
def list_history(db: DbSession, user: CurrentUser, limit: int = Query(30, ge=1, le=100)):
    """받은 알림 이력 (최신순)."""
    return service.list_history(db, user, limit)
