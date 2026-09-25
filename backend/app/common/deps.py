"""라우터에서 공통으로 쓰는 의존성.

사용 예:
    @router.get("")
    def list_items(db: DbSession, user: CurrentUser): ...
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.common.db import get_db
from app.common.exceptions import UnauthorizedError
from app.common.security import decode_access_token
from app.features.users.models import User

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise UnauthorizedError("로그인이 필요합니다.")
    user_id = decode_access_token(credentials.credentials)
    user = db.get(User, user_id)
    if user is None:
        raise UnauthorizedError("존재하지 않는 사용자입니다.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
