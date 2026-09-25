"""Claude API 공통 클라이언트.

기능 코드에서 anthropic SDK를 직접 import 하지 말고 `generate_structured()`만 사용한다.
"""

import base64
from functools import lru_cache
from typing import TypeVar

import anthropic
from pydantic import BaseModel

from app.common.config import settings
from app.common.exceptions import AppError

T = TypeVar("T", bound=BaseModel)


class LLMError(AppError):
    status_code = 502
    code = "LLM_ERROR"


@lru_cache
def _client() -> anthropic.Anthropic:
    # api_key=None 이면 SDK가 환경 변수 ANTHROPIC_API_KEY 등에서 자동으로 찾는다
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY or None, timeout=60.0)


def image_block(data: bytes, media_type: str) -> dict:
    """이미지 바이트 → Claude 메시지 content 블록."""
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": base64.standard_b64encode(data).decode()},
    }


def generate_structured(
    output_type: type[T],
    prompt: str,
    *,
    system: str | None = None,
    images: list[tuple[bytes, str]] | None = None,
    max_tokens: int = 4096,
) -> T:
    """Claude에게 요청하고 응답을 output_type(Pydantic 모델)으로 검증해서 돌려준다.

    images: [(이미지 바이트, "image/jpeg"), ...] — 이미지는 텍스트 앞에 배치한다.
    """
    content: list[dict] = [image_block(data, media_type) for data, media_type in images or []]
    content.append({"type": "text", "text": prompt})

    kwargs = {"system": system} if system else {}
    try:
        response = _client().messages.parse(
            model=settings.LLM_MODEL,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content}],
            output_format=output_type,
            # 안전 분류기가 요청을 거절하면 서버가 다른 모델로 자동 재시도
            extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
            extra_body={"fallbacks": "default"},
            **kwargs,
        )
    except anthropic.RateLimitError as e:
        raise LLMError("AI 요청이 많아 잠시 후 다시 시도해주세요.") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("AI 서버에 연결할 수 없습니다.") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"AI 요청 실패 ({e.status_code})") from e

    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise LLMError("AI가 이 요청을 처리하지 못했습니다.")
    return response.parsed_output
