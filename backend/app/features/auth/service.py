from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.security import create_access_token
from app.features.auth.schemas import TokenResponse
from app.features.users.models import User
from app.features.users.schemas import UserRead


def guest_login(db: Session, device_id: str) -> TokenResponse:
    """MVP는 회원가입 없이 기기 ID 기반 게스트 로그인. 없으면 생성, 있으면 토큰 재발급.

    TODO(auth): 소셜 로그인(카카오 등)이 필요해지면 이 도메인에 추가한다.
    """
    user = db.scalar(select(User).where(User.device_id == device_id))
    is_new = user is None
    if is_new:
        user = User(device_id=device_id)
        db.add(user)
        db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id),
        is_new_user=is_new,
        user=UserRead.model_validate(user),
    )
