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
from app.features.vision.client import ClaudeVisionClient, MockVisionClient, VisionClient
from app.features.vision.schemas import RecognizedItem, RecognizeResponse

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024


def get_client(db: Annotated[Session, Depends(get_db)]) -> VisionClient:
    if settings.AI_MOCK:
        return MockVisionClient()
    return ClaudeVisionClient([p.name for p in ingredients.list_presets(db)])


def recognize(db: Session, image: bytes, content_type: str, client: VisionClient) -> RecognizeResponse:
    """사진 → 재료 후보 목록. DB에 저장하지 않는다 (사용자 확인 후 /ingredients/batch 로 저장)."""
    if content_type not in ALLOWED_TYPES:
        raise ValidationError("지원하지 않는 이미지 형식입니다.")
    if len(image) > MAX_IMAGE_BYTES:
        raise ValidationError("이미지는 10MB 이하만 업로드할 수 있습니다.")

    detections = client.detect_ingredients(image, content_type)

    items = []
    for d in detections:
        preset = ingredients.find_preset_by_name(db, d.name)
        shelf_days = preset.shelf_life_days if preset else ingredients.DEFAULT_SHELF_LIFE_DAYS
        items.append(
            RecognizedItem(
                name=d.name,
                preset_id=preset.id if preset else None,
                quantity=d.quantity or (preset.default_quantity if preset else 1),
                unit=d.unit or (preset.default_unit if preset else "개"),
                storage=preset.default_storage if preset else StorageType.FRIDGE,
                expires_on=today() + timedelta(days=shelf_days),
                confidence=d.confidence,
                needs_review=d.confidence < settings.AI_LOW_CONFIDENCE,
            )
        )
    # TODO(vision): 같은 재료가 여러 번 인식되면 합치기
    return RecognizeResponse(count=len(items), items=items)
