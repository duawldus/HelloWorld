from datetime import timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.db import get_db
from app.common.exceptions import ValidationError
from app.common.time import today
from app.features.ingredients import service as ingredients
from app.features.ingredients.models import StorageType
from app.features.vision.client import LLMVisionClient, MockVisionClient, VisionClient
from app.features.vision.schemas import RecognizedItem, RecognizeResponse

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def get_client(db: Annotated[Session, Depends(get_db)]) -> VisionClient:
    if settings.AI_MOCK:
        return MockVisionClient()
    return LLMVisionClient([p.name for p in ingredients.list_presets(db)])


def recognize(db: Session, image: bytes, content_type: str, client: VisionClient) -> RecognizeResponse:
    """사진 → 재료 후보 목록. DB에 저장하지 않는다 (사용자 확인 후 /ingredients/batch 로 저장)."""
    if content_type not in ALLOWED_TYPES:
        raise ValidationError("지원하지 않는 이미지 형식입니다.")
    if len(image) > MAX_IMAGE_BYTES:
        raise ValidationError("이미지는 10MB 이하만 업로드할 수 있습니다.")

    detections = client.detect_ingredients(image, content_type)

    merged: dict[str, RecognizedItem] = {}
    for d in detections:
        if not d.name.strip():
            continue
        preset = ingredients.find_preset_by_name(db, d.name)
        name = preset.name if preset else d.name.strip()  # '달걀' → '계란'처럼 프리셋 이름으로 통일
        shelf_days = preset.shelf_life_days if preset else ingredients.DEFAULT_SHELF_LIFE_DAYS
        confidence = _confidence(d.confidence)
        item = RecognizedItem(
            name=name,
            preset_id=preset.id if preset else None,
            quantity=d.quantity or (preset.default_quantity if preset else 1),
            unit=d.unit or (preset.default_unit if preset else "개"),
            storage=preset.default_storage if preset else StorageType.FRIDGE,
            expires_on=today() + timedelta(days=shelf_days),
            confidence=confidence,
            needs_review=confidence < settings.AI_LOW_CONFIDENCE,
        )

        same = merged.get(name)
        if same is None:
            merged[name] = item
            continue
        # 같은 재료가 여러 번 인식되면 한 줄로 합친다 (단위가 같을 때만 수량을 더함)
        if same.unit == item.unit:
            same.quantity += item.quantity
        same.confidence = max(same.confidence, item.confidence)
        same.needs_review = same.confidence < settings.AI_LOW_CONFIDENCE

    items = list(merged.values())
    return RecognizeResponse(count=len(items), items=items)


def _confidence(value: float) -> float:
    """AI가 0~100(%)으로 돌려주는 경우도 있어 0.0~1.0으로 맞춘다."""
    if value > 1:
        value /= 100
    return min(max(value, 0.0), 1.0)
