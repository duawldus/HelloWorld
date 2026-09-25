"""[화면 0] 온보딩 · 기본 양념 설정 / 내 정보"""

from fastapi import APIRouter

from app.common.deps import CurrentUser, DbSession
from app.features.users import service
from app.features.users.schemas import SeasoningOption, SeasoningUpdate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
def get_me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserRead)
def update_me(data: UserUpdate, db: DbSession, user: CurrentUser):
    return service.update_me(db, user, data)


@router.get("/me/seasonings", response_model=list[SeasoningOption])
def list_my_seasonings(db: DbSession, user: CurrentUser):
    """전체 기본 양념 목록 + 내가 보유 중인지(owned) 여부."""
    return service.list_seasoning_options(db, user)


@router.put("/me/seasonings", response_model=list[SeasoningOption])
def replace_my_seasonings(data: SeasoningUpdate, db: DbSession, user: CurrentUser):
    """보유 양념 전체 교체. 처음 호출 시 온보딩 완료(onboarded=True) 처리."""
    return service.replace_seasonings(db, user, data.seasoning_ids)
