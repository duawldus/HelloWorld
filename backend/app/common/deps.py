"""라우터에서 공통으로 쓰는 의존성.

사용 예:
    @router.get("")
    def list_items(db: DbSession, user: CurrentUser): ...

로그인은 없다. 앱이 설치 시 만든 기기 고유 ID(UUID)를 모든 요청의 `X-Device-Id` 헤더로 보내면,
처음 보는 ID는 사용자를 자동으로 만들고 이후에는 같은 사용자로 취급한다.
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.common.db import get_db
from app.common.exceptions import UnauthorizedError
from app.features.users import service as users
from app.features.users.models import User

# Swagger 의 Authorize 버튼으로 헤더를 넣을 수 있게 security scheme 으로 선언
_device_id_header = APIKeyHeader(name="X-Device-Id", auto_error=False, description="기기 고유 ID (UUID 권장)")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, device_id: Annotated[str | None, Depends(_device_id_header)]) -> User:
    if not device_id or not 8 <= len(device_id) <= 128:
        raise UnauthorizedError("X-Device-Id 헤더(8~128자)가 필요합니다.")
    return users.get_or_create_by_device(db, device_id)


CurrentUser = Annotated[User, Depends(get_current_user)]
