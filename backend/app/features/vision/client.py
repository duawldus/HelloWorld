"""사진 인식 클라이언트. LLM 호출은 반드시 app.common.llm 을 통한다."""

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
    "너는 자취생 냉장고 관리 앱의 식재료 인식기다. 사진 속에서 먹을 수 있는 식재료와 식품만 찾아 목록으로 돌려준다.\n"
    "규칙:\n"
    "- 같은 재료는 한 번만 적고, 보이는 개수를 모두 더해 quantity 에 적는다.\n"
    "- name 은 브랜드명이 아닌 한국어 일반명으로 적는다. (예: '서울우유' → '우유')\n"
    "- unit 은 개, 모, 단, 봉, 팩, 캔, 통, g 중 알맞은 것을 쓴다. 양을 알 수 없으면 quantity 와 unit 을 null 로 둔다.\n"
    "- 간장, 고추장, 케첩 같은 양념·소스는 앱에서 따로 관리하므로 제외한다.\n"
    "- 그릇, 포장재, 가전제품 등 먹을 수 없는 것은 제외한다.\n"
    "- 확실히 보이는 것만 적고 추측해서 지어내지 않는다.\n"
    "- confidence 는 0.0~1.0 사이 소수다. 가려져 있거나 포장 때문에 확실하지 않으면 0.8 미만으로 낮게 준다."
)


class LLMVisionClient:
    """Gemini 멀티모달로 사진 속 재료 인식.

    TODO(vision): 실제 사진으로 결과를 확인하며 SYSTEM_PROMPT 조정
    """

    def __init__(self, preset_names: list[str]):
        self.preset_names = preset_names

    def detect_ingredients(self, image: bytes, content_type: str) -> list[RawDetection]:
        prompt = (
            "이 사진에 있는 식재료를 모두 찾아줘. "
            f"다음 목록에 있는 재료는 반드시 목록의 이름 그대로 적어줘: {', '.join(self.preset_names)}. "
            "목록에 없는 재료는 한국어 일반명으로 적어줘."
        )
        result = generate_structured(DetectionResult, prompt, system=SYSTEM_PROMPT, images=[(image, content_type)])
        return result.items
