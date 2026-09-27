"""게이미피케이션 서비스.

★ 다른 도메인은 XP를 직접 수정하지 말고 반드시 `award_xp()`를 호출한다.
   (recipes: 요리 완료, ingredients: 사진 등록, reminders: 집안일 완료)
"""

from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.time import today
from app.features.gamification.models import Badge, UserBadge, XpLog
from app.features.gamification.rules import (
    XP_TABLE,
    BadgeCondition,
    XpAction,
    ingredient_price,
    level_for_xp,
    level_hint,
    level_info,
)
from app.features.gamification.schemas import BadgeListResponse, BadgeRead, LevelSummary, StatsResponse
from app.features.recipes.models import CookLog
from app.features.users.models import User


def award_xp(
    db: Session,
    user: User,
    action: XpAction,
    description: str,
    amount: int | None = None,
    ref_id: int | None = None,
) -> tuple[XpLog, bool]:
    """XP 지급(음수면 회수) + 레벨 재계산. (로그, 레벨업 여부)를 반환. commit은 호출자가 한다."""
    amount = XP_TABLE.get(action, 0) if amount is None else amount
    log = XpLog(user_id=user.id, action=action, amount=amount, description=description, ref_id=ref_id)
    db.add(log)

    before = user.level
    user.xp = max(0, user.xp + amount)
    user.level = level_for_xp(user.xp)
    if amount > 0:
        touch_streak(user)
    return log, user.level > before


def revoke_xp(db: Session, user: User, actions: list[XpAction], ref_id: int) -> int:
    """실행 취소용: ref_id 로 지급했던 XP 로그를 지우고 그만큼 XP를 되돌린다. 회수한 XP를 반환. commit은 호출자가 한다.

    로그 자체를 지우므로 '최근 획득 XP'·'제때 소진' 통계에서도 빠진다.
    """
    cond = (XpLog.user_id == user.id, XpLog.ref_id == ref_id, XpLog.action.in_(actions))
    amount = db.scalar(select(func.coalesce(func.sum(XpLog.amount), 0)).where(*cond)) or 0
    db.execute(delete(XpLog).where(*cond))
    user.xp = max(0, user.xp - amount)
    user.level = level_for_xp(user.xp)
    return amount


def touch_streak(user: User, on: date | None = None) -> None:
    """오늘 활동 기록 → 연속 기록(streak) 갱신. XP를 얻는 활동(요리·사진 등록·집안일)마다 award_xp 가 부른다.

    마지막 활동이 어제면 +1, 오늘이면 그대로, 그 외엔 1부터 다시. 실행 취소로 XP를 회수해도 기록은 되돌리지 않는다.
    """
    on = on or today()
    if user.last_active_date == on:
        return
    user.current_streak = user.current_streak + 1 if user.last_active_date == on - timedelta(days=1) else 1
    user.best_streak = max(user.best_streak, user.current_streak)
    user.last_active_date = on


def current_streak(user: User, on: date | None = None) -> int:
    """화면에 보여 줄 연속 기록. 어제도 오늘도 활동이 없으면 이미 끊긴 것이라 0."""
    on = on or today()
    if user.last_active_date is None or user.last_active_date < on - timedelta(days=1):
        return 0
    return user.current_streak


def evaluate_badges(db: Session, user: User) -> list[Badge]:
    """조건을 새로 달성한 뱃지를 지급하고 반환. award_xp 뒤, commit 전에 호출한다.

    한 번 받은 뱃지는 실행 취소로 진행도가 내려가도 회수하지 않는다.
    """
    db.flush()  # 세션이 autoflush=False 라서, 방금 추가한 XP 로그가 집계에 잡히도록
    owned = set(db.scalars(select(UserBadge.badge_id).where(UserBadge.user_id == user.id)))
    progress: dict[BadgeCondition, int] = {}
    new_badges = []
    for badge in db.scalars(select(Badge).order_by(Badge.sort_order, Badge.id)):
        if badge.id in owned:
            continue
        if badge.condition not in progress:
            progress[badge.condition] = _badge_progress(db, user, badge.condition)
        if progress[badge.condition] >= badge.threshold:
            db.add(UserBadge(user_id=user.id, badge_id=badge.id))
            new_badges.append(badge)
    return new_badges


def _badge_progress(db: Session, user: User, condition: BadgeCondition) -> int:
    """조건별 현재 수치 (xp_logs 집계, 연속 기록은 역대 최고)."""
    if condition == BadgeCondition.STREAK_DAYS:
        return user.best_streak
    if condition == BadgeCondition.PHOTO_REGISTER_COUNT:
        return _count_actions(db, user.id, XpAction.PHOTO_REGISTER)
    if condition == BadgeCondition.COOK_COUNT:
        return _count_actions(db, user.id, XpAction.COOK_COMPLETE)
    if condition == BadgeCondition.SAVED_BEFORE_EXPIRY:
        return _count_actions(db, user.id, XpAction.EXPIRY_SAVE_BONUS)
    return 0


def _count_actions(db: Session, user_id: int, action: XpAction) -> int:
    stmt = select(func.count()).select_from(XpLog).where(XpLog.user_id == user_id, XpLog.action == action)
    return db.scalar(stmt) or 0


def get_level_summary(user: User) -> LevelSummary:
    title, min_xp, next_xp = level_info(user.level)
    to_next = (next_xp - user.xp) if next_xp is not None else None
    return LevelSummary(
        level=user.level,
        title=title,
        xp=user.xp,
        level_min_xp=min_xp,
        next_level_xp=next_xp,
        xp_to_next_level=to_next,
        level_hint=level_hint(to_next),
        current_streak=current_streak(user),
        best_streak=user.best_streak,
    )


def get_stats(db: Session, user: User) -> StatsResponse:
    saved_count = _count_actions(db, user.id, XpAction.EXPIRY_SAVE_BONUS)
    return StatsResponse(
        **get_level_summary(user).model_dump(),
        saved_count=saved_count,
        saved_money_estimate=_saved_money(db, user),
        cook_count=_count_actions(db, user.id, XpAction.COOK_COMPLETE),
    )


def _saved_money(db: Session, user: User) -> int:
    """절약 추정 식비: '유통기한 내 소진 보너스'를 받은 요리에서 임박 재료(D-0~D-3)의 재료값 합계.

    보너스 XP 로그의 ref_id 가 요리 기록(cook_logs) id 라서, 그 요리의 소진 스냅샷을 본다.
    실행 취소한 요리는 보너스 로그가 지워지므로 자동으로 빠진다.
    """
    cook_ids = select(XpLog.ref_id).where(XpLog.user_id == user.id, XpLog.action == XpAction.EXPIRY_SAVE_BONUS)
    total = 0
    for cook in db.scalars(select(CookLog).where(CookLog.id.in_(cook_ids))):
        cooked_on = cook.created_at.date()
        for snap in cook.consumed_snapshot:
            left = (date.fromisoformat(snap["expires_on"]) - cooked_on).days
            if 0 <= left <= settings.IMMINENT_DAYS:
                total += ingredient_price(snap["name"])
    return total


def list_badges(db: Session, user: User) -> BadgeListResponse:
    acquired = {ub.badge_id: ub for ub in db.scalars(select(UserBadge).where(UserBadge.user_id == user.id))}
    badges = db.scalars(select(Badge).order_by(Badge.sort_order, Badge.id)).all()
    items = [
        BadgeRead(
            id=b.id,
            code=b.code,
            name=b.name,
            description=b.description,
            icon=b.icon,
            acquired=b.id in acquired,
            acquired_at=acquired[b.id].acquired_at if b.id in acquired else None,
            progress=_badge_progress(db, user, b.condition),
            threshold=b.threshold,
        )
        for b in badges
    ]
    return BadgeListResponse(acquired_count=len(acquired), total_count=len(items), badges=items)


def list_xp_logs(db: Session, user: User, limit: int = 20) -> list[XpLog]:
    stmt = select(XpLog).where(XpLog.user_id == user.id).order_by(XpLog.created_at.desc(), XpLog.id.desc())
    return list(db.scalars(stmt.limit(limit)))
