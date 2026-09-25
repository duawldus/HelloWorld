from fastapi import APIRouter

from app.common.deps import DbSession
from app.features.auth import service
from app.features.auth.schemas import GuestLoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/guest", response_model=TokenResponse)
def guest_login(data: GuestLoginRequest, db: DbSession):
    """앱 최초 실행 시 호출. is_new_user=True 이거나 user.onboarded=False 면 온보딩 화면으로."""
    return service.guest_login(db, data.device_id)
