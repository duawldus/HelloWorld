from pydantic import BaseModel, Field

from app.common.schemas import ORMModel


class UserRead(ORMModel):
    id: int
    nickname: str
    onboarded: bool
    xp: int
    level: int
    current_streak: int
    best_streak: int


class UserUpdate(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=30)


class SeasoningRead(ORMModel):
    id: int
    name: str
    icon: str | None


class SeasoningOption(SeasoningRead):
    owned: bool


class SeasoningUpdate(BaseModel):
    """보유 양념 전체 교체. 온보딩 '시작하기' 버튼과 설정 화면에서 공통 사용."""

    seasoning_ids: list[int]
