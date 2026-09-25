from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.exceptions import NotFoundError, ValidationError
from app.common.time import now
from app.features.gamification import service as gamification
from app.features.gamification.rules import XpAction
from app.features.gamification.schemas import XpGain
from app.features.reminders.models import Reminder, ReminderCategory, RepeatType
from app.features.reminders.schedule import next_notify_at
from app.features.reminders.schemas import (
    ReminderCompleteResponse,
    ReminderCreate,
    ReminderGroup,
    ReminderListResponse,
    ReminderRead,
    ReminderUpdate,
    validate_rule,
)
from app.features.users.models import User

WEEKDAY_KO = "월화수목금토일"


def summarize(r: Reminder) -> str:
    """'매주 화·금 · 오후 8:00' 형태의 요약 문구."""
    hour = r.remind_time.hour
    ampm = "오전" if hour < 12 else "오후"
    t = f"{ampm} {hour % 12 or 12}:{r.remind_time.minute:02d}"
    if r.repeat_type == RepeatType.DAILY:
        rule = "매일" if r.interval == 1 else f"{r.interval}일마다"
    elif r.repeat_type == RepeatType.WEEKLY:
        days = "·".join(WEEKDAY_KO[w] for w in sorted(r.weekdays))
        rule = f"매주 {days}" if r.interval == 1 else f"{r.interval}주마다 {days}"
    else:
        rule = f"매달 {r.day_of_month}일" if r.interval == 1 else f"{r.interval}달마다 {r.day_of_month}일"
    before = f" · {r.notify_before_days}일 전 알림" if r.notify_before_days else ""
    return f"{rule} · {t}{before}"


def to_read(r: Reminder) -> ReminderRead:
    read = ReminderRead.model_validate(r)
    read.summary = summarize(r)
    if r.enabled and (nxt := next_notify_at(r, now())):
        read.next_notify_at, read.next_due_at = nxt
    return read


def list_enabled(db: Session, user_id: int) -> list[Reminder]:
    """home / notifications 도메인도 사용하는 공개 함수."""
    stmt = select(Reminder).where(Reminder.user_id == user_id, Reminder.enabled.is_(True))
    return list(db.scalars(stmt))


def list_reminders(db: Session, user: User) -> ReminderListResponse:
    reminders = db.scalars(select(Reminder).where(Reminder.user_id == user.id).order_by(Reminder.id)).all()
    reads = [to_read(r) for r in reminders]
    upcoming = [r for r in reads if r.next_notify_at]
    return ReminderListResponse(
        enabled_count=sum(r.enabled for r in reads),
        next_reminder=min(upcoming, key=lambda r: r.next_notify_at) if upcoming else None,
        groups=[
            ReminderGroup(category=c, items=[r for r in reads if r.category == c])
            for c in ReminderCategory
            if any(r.category == c for r in reads)
        ],
    )


def get_owned(db: Session, user: User, reminder_id: int) -> Reminder:
    reminder = db.get(Reminder, reminder_id)
    if reminder is None or reminder.user_id != user.id:
        raise NotFoundError("알림을 찾을 수 없습니다.")
    return reminder


def create_reminder(db: Session, user: User, data: ReminderCreate) -> ReminderRead:
    reminder = Reminder(user_id=user.id, **data.model_dump())
    db.add(reminder)
    db.commit()
    return to_read(reminder)


def update_reminder(db: Session, user: User, reminder_id: int, data: ReminderUpdate) -> ReminderRead:
    reminder = get_owned(db, user, reminder_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(reminder, key, value)
    try:
        validate_rule(reminder.repeat_type, reminder.weekdays, reminder.day_of_month)
    except ValueError as e:
        db.rollback()
        raise ValidationError(str(e)) from e
    db.commit()
    return to_read(reminder)


def delete_reminder(db: Session, user: User, reminder_id: int) -> None:
    db.delete(get_owned(db, user, reminder_id))
    db.commit()


def complete_reminder(db: Session, user: User, reminder_id: int) -> ReminderCompleteResponse:
    """집안일 완료 체크 → +5 XP.

    TODO(reminders): 같은 회차에 중복 완료 방지 (last_done_at 이 이번 회차 이후면 XP 미지급)
    """
    reminder = get_owned(db, user, reminder_id)
    reminder.last_done_at = now()
    log, level_up = gamification.award_xp(
        db, user, XpAction.CHORE_COMPLETE, f"{reminder.title} 완료", ref_id=reminder.id
    )
    new_badges = gamification.evaluate_badges(db, user)
    db.commit()
    return ReminderCompleteResponse(
        reminder=to_read(reminder),
        xp=XpGain(
            amount=log.amount,
            reasons=[log.description],
            level_up=level_up,
            new_badges=[b.name for b in new_badges],
        ),
    )
