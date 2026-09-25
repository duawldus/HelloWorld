"""Claude API 공통 모듈. 기능 코드는 여기서 import만 한다.

from app.common.llm import generate_structured

class Answer(BaseModel):
    items: list[str]

answer = generate_structured(Answer, "...", images=[(image_bytes, "image/jpeg")])
"""

from app.common.llm.client import LLMError, generate_structured

__all__ = ["LLMError", "generate_structured"]
