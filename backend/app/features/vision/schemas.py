from datetime import date

from pydantic import BaseModel

from app.features.ingredients.models import StorageType


class RecognizedItem(BaseModel):
    """[화면 3-2] 인식 결과 한 줄. FE는 이 값을 수정한 뒤 POST /ingredients/batch 로 등록한다."""

    name: str
    preset_id: int | None
    quantity: float
    unit: str
    storage: StorageType
    expires_on: date  # 프리셋 기반 자동 계산
    confidence: float  # 0.0 ~ 1.0
    needs_review: bool  # confidence < AI_LOW_CONFIDENCE → 경고색 표시


class RecognizeResponse(BaseModel):
    count: int
    items: list[RecognizedItem]
