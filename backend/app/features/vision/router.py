"""[화면 3-1] AI 사진 촬영 → [화면 3-2] 인식 결과 확인"""

from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from app.common.deps import CurrentUser, DbSession
from app.features.vision import service
from app.features.vision.client import VisionClient
from app.features.vision.schemas import RecognizeResponse

router = APIRouter(prefix="/vision", tags=["vision"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(
    db: DbSession,
    _: CurrentUser,
    client: Annotated[VisionClient, Depends(service.get_client)],
    image: UploadFile = File(..., description="촬영/앨범 사진"),
):
    """사진 속 재료 인식. 결과는 저장되지 않으며, 확인 후 POST /ingredients/batch (source=PHOTO) 로 등록."""
    data = await image.read()
    return service.recognize(db, data, image.content_type or "", client)
