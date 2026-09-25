from pydantic import BaseModel, Field

from app.features.users.schemas import UserRead


class GuestLoginRequest(BaseModel):
    device_id: str = Field(min_length=8, max_length=128, description="앱 설치 시 생성한 고유 기기 ID (UUID 권장)")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    is_new_user: bool
    user: UserRead
