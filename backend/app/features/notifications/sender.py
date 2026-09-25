import logging
from typing import Protocol

from app.features.notifications.schemas import PushMessage

logger = logging.getLogger(__name__)


class PushSender(Protocol):
    def send(self, tokens: list[str], message: PushMessage) -> None: ...


class LoggingPushSender:
    """개발용: 실제로 보내지 않고 로그만 남긴다."""

    def send(self, tokens: list[str], message: PushMessage) -> None:
        logger.info("[PUSH] to=%d devices title=%s body=%s", len(tokens), message.title, message.body)


class ExpoPushSender:
    """TODO(notifications): Expo Push 연동.

    - POST https://exp.host/--/api/v2/push/send
    - body: [{"to": "ExponentPushToken[...]", "title": ..., "body": ..., "data": {"deeplink": ...}}]
    - 응답의 DeviceNotRegistered 에러가 오면 해당 PushDevice 삭제
    """

    def send(self, tokens: list[str], message: PushMessage) -> None:
        raise NotImplementedError("Expo Push 연동 예정")


def get_sender() -> PushSender:
    return LoggingPushSender()
