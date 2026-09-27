"""XP · 레벨 · 뱃지 규칙 상수. 기획이 바뀌면 이 파일만 고치면 된다."""

from enum import StrEnum


class XpAction(StrEnum):
    COOK_COMPLETE = "COOK_COMPLETE"  # 레시피 요리 완료
    EXPIRY_SAVE_BONUS = "EXPIRY_SAVE_BONUS"  # 유통기한 내 소진 보너스
    PHOTO_REGISTER = "PHOTO_REGISTER"  # 사진으로 재료 등록
    INGREDIENT_REGISTER = "INGREDIENT_REGISTER"  # 수동/프리셋 재료 등록
    CHORE_COMPLETE = "CHORE_COMPLETE"  # 생활 알림(집안일) 완료


# 확정(2026-09-27, 와이어프레임 기준): 요리 완료 +10, 임박 재료 소진 보너스 +10, 사진 등록 +15, 집안일 +5
XP_TABLE: dict[XpAction, int] = {
    XpAction.COOK_COMPLETE: 10,
    XpAction.EXPIRY_SAVE_BONUS: 10,
    XpAction.PHOTO_REGISTER: 15,
    XpAction.INGREDIENT_REGISTER: 0,
    XpAction.CHORE_COMPLETE: 5,
}

# 하루에 받을 수 있는 최대 횟수. 없는 행동은 무제한.
# 유통기한 보너스: 오늘 만료로 재료를 등록해 바로 요리하는 식의 XP 반복 획득을 막는다.
DAILY_LIMITS: dict[XpAction, int] = {
    XpAction.EXPIRY_SAVE_BONUS: 3,
}

# (레벨, 필요 누적 XP, 칭호) — 확정(2026-09-27). 와이어프레임: Lv.3 240XP, 다음 레벨까지 150 → Lv.4 = 390
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


# 절약 추정 식비: 임박 재료를 유통기한 안에 요리에 쓰면 그 재료값을 '버리지 않고 아낀 돈'으로 본다.
# 값은 요리 1회에 쓰는 양 기준 대략적인 마트 가격(원). 목록에 없는 재료는 DEFAULT_INGREDIENT_PRICE.
DEFAULT_INGREDIENT_PRICE = 2300
INGREDIENT_PRICES: dict[str, int] = {
    "계란": 1000,  # 2개
    "두부": 1500,
    "대파": 1000,
    "쪽파": 1000,
    "양파": 700,
    "감자": 800,
    "당근": 700,
    "애호박": 1500,
    "버섯": 1500,
    "콩나물": 1200,
    "고추": 500,
    "마늘": 500,
    "우유": 1500,
    "치즈": 1000,
    "김치": 1500,
    "어묵": 1500,
    "떡": 1500,
    "밥": 1000,
    "라면": 1000,
    "스팸": 3500,
    "햄": 2500,
    "소시지": 2500,
    "참치캔": 2500,
    "냉동만두": 3000,
    "돼지고기": 5000,
    "닭가슴살": 3000,
    "소고기": 8000,
}


def ingredient_price(name: str) -> int:
    return INGREDIENT_PRICES.get(name, DEFAULT_INGREDIENT_PRICE)


def level_for_xp(xp: int) -> int:
    level = 1
    for lv, required, _ in LEVELS:
        if xp >= required:
            level = lv
    return level


def level_info(level: int) -> tuple[str, int, int | None]:
    """(칭호, 현재 레벨 시작 누적 XP, 다음 레벨 필요 누적 XP). 만렙이면 다음 레벨 XP는 None."""
    title, min_xp = next((t, req) for lv, req, t in LEVELS if lv == level)
    next_required = next((req for lv, req, _ in LEVELS if lv == level + 1), None)
    return title, min_xp, next_required


# 레벨 힌트('임박 재료로 3번만 더 요리하면 달성!')의 기준: 임박 재료로 요리 1번에 받는 XP
XP_PER_SAVE_COOK = XP_TABLE[XpAction.COOK_COMPLETE] + XP_TABLE[XpAction.EXPIRY_SAVE_BONUS]


def level_hint(xp_to_next_level: int | None) -> str | None:
    """홈 레벨 카드 문구. 만렙이면 None."""
    if xp_to_next_level is None:
        return None
    times = max(1, -(-xp_to_next_level // XP_PER_SAVE_COOK))  # 올림
    return f"임박 재료로 {times}번만 더 요리하면 달성!"
