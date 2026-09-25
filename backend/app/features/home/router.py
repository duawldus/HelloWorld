"""[화면 1] 홈 대시보드"""

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.features.home import service
from app.features.home.schemas import HomeResponse

router = APIRouter(prefix="/home", tags=["home"])


@router.get("", response_model=HomeResponse)
def get_home(db: DbSession, user: CurrentUser):
    """레벨 카드 · 임박 알림 배너 · 오늘의 집안일 · 냉장고 요약 · 오늘의 추천 레시피를 한 번에."""
    return service.get_home(db, user)
