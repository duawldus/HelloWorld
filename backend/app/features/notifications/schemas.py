from datetime import datetime

from pydantic import BaseModel, Field

from app.common.schemas import ORMModel
from app.features.notifications.models import NotificationType, Platform


class DeviceRegister(BaseModel):
    token: str = Field(min_length=10, max_length=300, description="Expo 푸시 토큰 (ExponentPushToken[...])")
    platform: Platform


class DeviceRead(ORMModel):
    id: int
    platform: Platform


class NotificationRead(ORMModel):
    id: int
    type: NotificationType
    ref_id: int | None
    title: str
    body: str
    created_at: datetime


class PushMessage(BaseModel):
    title: str
    body: str
    deeplink: str  # 예: "bangguseok://recipes", "bangguseok://reminders"
