"""XP · 레벨 · 뱃지 규칙 상수. 기획이 바뀌면 이 파일만 고치면 된다."""

from enum import StrEnum


class XpAction(StrEnum):
    COOK_COMPLETE = "COOK_COMPLETE"  # 레시피 요리 완료
    EXPIRY_SAVE_BONUS = "EXPIRY_SAVE_BONUS"  # 유통기한 내 소진 보너스
    PHOTO_REGISTER = "PHOTO_REGISTER"  # 사진으로 재료 등록
    INGREDIENT_REGISTER = "INGREDIENT_REGISTER"  # 수동/프리셋 재료 등록
    CHORE_COMPLETE = "CHORE_COMPLETE"  # 생활 알림(집안일) 완료
    COOK_UNDO = "COOK_UNDO"  # 요리 완료 실행 취소 (XP 회수, 음수)


# 와이어프레임 기준: 요리+임박소진 +20, 사진 등록 +15, 집안일 +5
# TODO(gamification): 기획 확정 시 수치 조정
XP_TABLE: dict[XpAction, int] = {
    XpAction.COOK_COMPLETE: 10,
    XpAction.EXPIRY_SAVE_BONUS: 10,
    XpAction.PHOTO_REGISTER: 15,
    XpAction.INGREDIENT_REGISTER: 0,
    XpAction.CHORE_COMPLETE: 5,
}

# (레벨, 필요 누적 XP, 칭호) — 와이어프레임: Lv.3 240XP, 다음 레벨까지 150 → Lv.4 = 390
LEVELS: list[tuple[int, int, str]] = [
    (1, 0, "자취 새내기"),
    (2, 100, "냉장고 탐험가"),
    (3, 200, "알뜰 자취러"),
    (4, 390, "집밥 요리사"),
    (5, 600, "자취 고수"),
    (6, 900, "방구석 마스터"),
]


class BadgeCondition(StrEnum):
    SAVED_BEFORE_EXPIRY = "SAVED_BEFORE_EXPIRY"  # 유통기한 내 소진 횟수
    COOK_COUNT = "COOK_COUNT"  # 요리 완료 횟수
    STREAK_DAYS = "STREAK_DAYS"  # 연속 기록 일수
    PHOTO_REGISTER_COUNT = "PHOTO_REGISTER_COUNT"  # 사진 등록 횟수


def level_for_xp(xp: int) -> int:
    level = 1
    for lv, required, _ in LEVELS:
        if xp >= required:
            level = lv
    return level


def level_info(level: int) -> tuple[str, int | None]:
    """(칭호, 다음 레벨 필요 누적 XP). 만렙이면 다음 레벨 XP는 None."""
    title = next(t for lv, _, t in LEVELS if lv == level)
    next_required = next((req for lv, req, _ in LEVELS if lv == level + 1), None)
    return title, next_required
