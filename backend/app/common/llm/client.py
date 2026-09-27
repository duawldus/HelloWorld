"""LLM(Gemini) 공통 클라이언트.

기능 코드에서 google-genai SDK를 직접 import 하지 말고 `generate_structured()`만 사용한다.
공급자를 바꿀 때는 이 파일만 고치면 된다.
"""

import base64
import logging
from functools import lru_cache
from typing import TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.common.config import settings
from app.common.exceptions import AppError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMError(AppError):
    status_code = 502
    code = "LLM_ERROR"


@lru_cache
def _client() -> genai.Client:
    # api_key=None 이면 SDK가 환경 변수 GEMINI_API_KEY 에서 자동으로 찾는다
    # SDK 기본값은 429 에도 최대 4번 재시도해서, 무료 한도를 더 쓰고 응답이 1~2분씩 늦어진다.
    # 한도 초과(429)는 바로 LLMError 로 돌려주고, 일시적인 서버 오류(5xx)만 재시도한다.
    retry = types.HttpRetryOptions(attempts=2, http_status_codes=[500, 502, 503, 504])
    return genai.Client(
        api_key=settings.GEMINI_API_KEY or None,
        http_options=types.HttpOptions(retry_options=retry),
    )


def _schema(model: type[BaseModel]) -> dict:
    """Pydantic JSON 스키마에서 Gemini가 지원하지 않을 수 있는 키(default)를 제거한다."""

    def clean(node):
        if isinstance(node, dict):
            return {k: clean(v) for k, v in node.items() if k != "default"}
        if isinstance(node, list):
            return [clean(v) for v in node]
        return node

    return clean(model.model_json_schema())


def generate_structured(
    output_type: type[T],
    prompt: str,
    *,
    system: str | None = None,
    images: list[tuple[bytes, str]] | None = None,
) -> T:
    """Gemini에게 요청하고 응답을 output_type(Pydantic 모델) JSON으로 받아 검증해서 돌려준다.

    images: [(이미지 바이트, "image/jpeg"), ...]
    """
    content: list[dict] = [{"type": "text", "text": prompt}]
    content += [
        {"type": "image", "data": base64.b64encode(data).decode(), "mime_type": media_type}
        for data, media_type in images or []
    ]

    kwargs = {"system_instruction": system} if system else {}
    try:
        interaction = _client().interactions.create(
            model=settings.LLM_MODEL,
            input=content,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": _schema(output_type),
            },
            timeout=120,
            **kwargs,
        )
    except Exception as e:  # SDK 예외 클래스가 공개 경로로 제공되지 않아 상태 코드로 구분
        status = getattr(e, "status_code", None) or getattr(e, "code", None)
        logger.warning("LLM 호출 실패 (status=%s): %s", status, e)
        if status == 429:
            raise LLMError("AI 요청이 많아 잠시 후 다시 시도해주세요. (무료 등급 한도 초과일 수 있음)") from e
        raise LLMError(f"AI 요청 실패 ({status or '연결 오류'})") from e

    try:
        return output_type.model_validate_json(interaction.output_text or "")
    except ValidationError as e:
        logger.warning("LLM 응답 형식 오류: %s", interaction.output_text)
        raise LLMError("AI 응답을 해석하지 못했습니다.") from e
