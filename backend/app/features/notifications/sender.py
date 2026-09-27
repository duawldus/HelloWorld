import logging
from typing import Protocol

import httpx

from app.common.config import settings
from app.features.notifications.schemas import PushMessage

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_CHUNK_SIZE = 100  # Expo 는 요청 1번에 최대 100건


class PushSender(Protocol):
    def send(self, tokens: list[str], message: PushMessage) -> list[str]:
        """발송하고, 더 이상 유효하지 않은(앱 삭제 등) 토큰 목록을 돌려준다."""
        ...


class LoggingPushSender:
    """개발용: 실제로 보내지 않고 로그만 남긴다."""

    def send(self, tokens: list[str], message: PushMessage) -> list[str]:
        logger.info("[PUSH] to=%d devices title=%s body=%s", len(tokens), message.title, message.body)
        return []


class ExpoPushSender:
    """Expo Push API 로 실제 발송. https://docs.expo.dev/push-notifications/sending-notifications/

    - 응답 티켓이 DeviceNotRegistered 면 그 토큰을 돌려줘서 호출한 쪽이 PushDevice 를 지우게 한다.
    - 네트워크 오류 등은 로그만 남기고 넘어간다 (알림 하나 때문에 잡 전체가 멈추지 않도록).
    """

    def __init__(self, access_token: str = "", client: httpx.Client | None = None):
        self.access_token = access_token
        self.client = client or httpx.Client(timeout=10)

    def _headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def send(self, tokens: list[str], message: PushMessage) -> list[str]:
        dead: list[str] = []
        for start in range(0, len(tokens), EXPO_CHUNK_SIZE):
            chunk = tokens[start : start + EXPO_CHUNK_SIZE]
            payload = [
                {
                    "to": token,
                    "title": message.title,
                    "body": message.body,
                    "sound": "default",
                    "priority": "high",  # Android: 절전 모드에서도 바로 표시
                    "channelId": message.channel,
                    "data": {"deeplink": message.deeplink},
                }
                for token in chunk
            ]
            try:
                resp = self.client.post(EXPO_PUSH_URL, json=payload, headers=self._headers())
                resp.raise_for_status()
                tickets = resp.json().get("data", [])
            except (httpx.HTTPError, ValueError):
                logger.exception("[PUSH] Expo 발송 실패 (%d devices)", len(chunk))
                continue

            for token, ticket in zip(chunk, tickets, strict=False):
                if ticket.get("status") != "error":
                    continue
                error = (ticket.get("details") or {}).get("error")
                if error == "DeviceNotRegistered":
                    dead.append(token)
                else:
                    logger.warning("[PUSH] Expo 오류 token=%s error=%s message=%s", token, error, ticket.get("message"))
        return dead


def get_sender() -> PushSender:
    if settings.PUSH_ENABLED:
        return ExpoPushSender(settings.EXPO_ACCESS_TOKEN)
    return LoggingPushSender()
