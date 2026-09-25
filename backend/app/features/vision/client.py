"""사진 인식 클라이언트. Claude 호출은 반드시 app.common.llm 을 통한다."""

from typing import Protocol

from pydantic import BaseModel, Field

from app.common.llm import generate_structured


class RawDetection(BaseModel):
    """AI가 돌려준 원시 인식 결과."""

    name: str = Field(description="식재료 한국어 일반명 (예: 두부, 계란, 대파)")
    quantity: float | None = Field(default=None, description="보이는 개수/양. 모르면 null")
    unit: str | None = Field(default=None, description="단위 (개, 모, 단, g 등). 모르면 null")
    confidence: float = Field(description="0.0~1.0 사이 확신도")


class DetectionResult(BaseModel):
    items: list[RawDetection]


class VisionClient(Protocol):
    def detect_ingredients(self, image: bytes, content_type: str) -> list[RawDetection]: ...


class MockVisionClient:
    """AI_MOCK=True 일 때 사용. 와이어프레임 [화면 3-2] 예시와 같은 결과를 돌려준다."""

    def detect_ingredients(self, image: bytes, content_type: str) -> list[RawDetection]:
        return [
            RawDetection(name="두부", quantity=1, unit="모", confidence=0.98),
            RawDetection(name="계란", quantity=10, unit="개", confidence=0.95),
            RawDetection(name="대파", quantity=1, unit="단", confidence=0.72),
        ]


SYSTEM_PROMPT = (
    "너는 자취생 냉장고 관리 앱의 식재료 인식기다. "
    "사진 속에서 먹을 수 있는 식재료와 식품만 찾아 목록으로 돌려준다. "
    "그릇, 포장재 브랜드명, 가전제품은 제외한다."
)


class ClaudeVisionClient:
    """Claude 멀티모달로 사진 속 재료 인식.

    TODO(vision): 실제 사진으로 프롬프트 튜닝 (프리셋 이름 목록을 프롬프트에 넣어 이름 통일 등)
    """

    def __init__(self, preset_names: list[str]):
        self.preset_names = preset_names

    def detect_ingredients(self, image: bytes, content_type: str) -> list[RawDetection]:
        prompt = (
            "이 사진에 있는 식재료를 모두 찾아줘. "
            f"가능하면 다음 이름 중 하나로 불러줘: {', '.join(self.preset_names)}. "
            "목록에 없는 재료는 한국어 일반명으로 적어줘. "
            "confidence 는 그 재료가 맞다고 확신하는 정도야."
        )
        result = generate_structured(DetectionResult, prompt, system=SYSTEM_PROMPT, images=[(image, content_type)])
        return result.items
