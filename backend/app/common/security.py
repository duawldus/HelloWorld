from datetime import UTC, datetime, timedelta

import jwt

from app.common.config import settings
from app.common.exceptions import UnauthorizedError


def create_access_token(user_id: int) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> int:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as e:
        raise UnauthorizedError("유효하지 않은 토큰입니다.") from e
