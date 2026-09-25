"""[화면 6] 생활 알림 · [화면 7] 알림 추가"""

from fastapi import APIRouter, status

from app.common.deps import CurrentUser, DbSession
from app.features.reminders import service
from app.features.reminders.schemas import (
    ReminderCompleteResponse,
    ReminderCreate,
    ReminderListResponse,
    ReminderRead,
    ReminderUpdate,
)

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=ReminderListResponse)
def list_reminders(db: DbSession, user: CurrentUser):
    """카테고리별 그룹 + 다음 알림 배너."""
    return service.list_reminders(db, user)


@router.post("", response_model=ReminderRead, status_code=status.HTTP_201_CREATED)
def create_reminder(data: ReminderCreate, db: DbSession, user: CurrentUser):
    return service.create_reminder(db, user, data)


@router.get("/{reminder_id}", response_model=ReminderRead)
def get_reminder(reminder_id: int, db: DbSession, user: CurrentUser):
    return service.to_read(service.get_owned(db, user, reminder_id))


@router.patch("/{reminder_id}", response_model=ReminderRead)
def update_reminder(reminder_id: int, data: ReminderUpdate, db: DbSession, user: CurrentUser):
    """부분 수정 / 켜고 끄기({"enabled": false})."""
    return service.update_reminder(db, user, reminder_id, data)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, db: DbSession, user: CurrentUser):
    service.delete_reminder(db, user, reminder_id)


@router.post("/{reminder_id}/complete", response_model=ReminderCompleteResponse)
def complete_reminder(reminder_id: int, db: DbSession, user: CurrentUser):
    """집안일 완료 체크 → XP 지급."""
    return service.complete_reminder(db, user, reminder_id)
