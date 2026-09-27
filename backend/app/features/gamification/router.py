"""[화면 8] 성과 · 뱃지"""

from fastapi import APIRouter, Query

from app.common.deps import CurrentUser, DbSession
from app.features.gamification import service
from app.features.gamification.schemas import BadgeListResponse, StatsResponse, XpLogRead

router = APIRouter(prefix="/gamification", tags=["gamification"])


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: DbSession, user: CurrentUser):
    """레벨 · XP · 연속 기록 · 제때 소진 횟수 · 절약 추정 식비."""
    return service.get_stats(db, user)


@router.get("/badges", response_model=BadgeListResponse)
def list_badges(db: DbSession, user: CurrentUser):
    """전체 뱃지 + 획득 여부 + 진행도."""
    return service.list_badges(db, user)


@router.get("/xp-logs", response_model=list[XpLogRead])
def list_xp_logs(db: DbSession, user: CurrentUser, limit: int = Query(20, ge=1, le=100)):
    """최근 획득 XP 로그 (최신순)."""
    return service.list_xp_logs(db, user, limit)
