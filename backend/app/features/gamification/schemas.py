from datetime import datetime

from pydantic import BaseModel

from app.common.schemas import ORMModel
from app.features.gamification.rules import XpAction


class LevelSummary(BaseModel):
    """홈[1]·성과[8] 상단 레벨 카드."""

    level: int
    title: str  # 예: "알뜰 자취러"
    xp: int
    next_level_xp: int | None  # 만렙이면 None
    xp_to_next_level: int | None
    current_streak: int
    best_streak: int


class StatsResponse(LevelSummary):
    saved_count: int  # 제때 소진 횟수
    saved_money_estimate: int  # 절약 추정 식비(원) — 참고용
    cook_count: int


class BadgeRead(BaseModel):
    id: int
    code: str
    name: str
    description: str
    icon: str | None
    acquired: bool
    acquired_at: datetime | None
    progress: int  # 현재 달성 수치
    threshold: int


class BadgeListResponse(BaseModel):
    acquired_count: int
    total_count: int
    badges: list[BadgeRead]


class XpLogRead(ORMModel):
    id: int
    action: XpAction
    amount: int
    description: str
    created_at: datetime


class XpGain(BaseModel):
    """다른 도메인 응답에 포함되는 'XP 획득 토스트' 정보."""

    amount: int
    reasons: list[str]
    level_up: bool = False
    new_badges: list[str] = []
