"""게이미피케이션 서비스.

★ 다른 도메인은 XP를 직접 수정하지 말고 반드시 `award_xp()`를 호출한다.
   (recipes: 요리 완료, ingredients: 사진 등록, reminders: 집안일 완료)
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.gamification.models import Badge, UserBadge, XpLog
from app.features.gamification.rules import XP_TABLE, BadgeCondition, XpAction, level_for_xp, level_info
from app.features.gamification.schemas import BadgeListResponse, BadgeRead, LevelSummary, StatsResponse
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
    touch_streak(db, user)
    return log, user.level > before


def touch_streak(db: Session, user: User) -> None:
    """오늘 활동 기록 → 연속 기록(streak) 갱신.

    TODO(gamification):
      - user.last_active_date 가 어제면 current_streak += 1, 오늘이면 유지, 그 외엔 1로 리셋
      - best_streak 갱신
      - '연속 기록'의 기준 행동이 무엇인지(요리만? 모든 활동?) 기획 확인 필요
    """


def evaluate_badges(db: Session, user: User) -> list[Badge]:
    """조건을 새로 달성한 뱃지를 지급하고 반환.

    TODO(gamification): 각 BadgeCondition 별 progress 계산 → threshold 이상이고 미획득이면 UserBadge 생성
    """
    return []


def _badge_progress(db: Session, user: User, condition: BadgeCondition) -> int:
    """TODO(gamification): 조건별 현재 수치 계산 (cook_logs, xp_logs 집계 등)"""
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
    title, next_xp = level_info(user.level)
    return LevelSummary(
        level=user.level,
        title=title,
        xp=user.xp,
        next_level_xp=next_xp,
        xp_to_next_level=(next_xp - user.xp) if next_xp is not None else None,
        current_streak=user.current_streak,
        best_streak=user.best_streak,
    )


def get_stats(db: Session, user: User) -> StatsResponse:
    saved_count = _count_actions(db, user.id, XpAction.EXPIRY_SAVE_BONUS)
    return StatsResponse(
        **get_level_summary(user).model_dump(),
        saved_count=saved_count,
        # TODO(gamification): 재료별 평균 단가 기반으로 계산. 지금은 1회당 2,300원 가정
        saved_money_estimate=saved_count * 2300,
        cook_count=_count_actions(db, user.id, XpAction.COOK_COMPLETE),
    )


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
