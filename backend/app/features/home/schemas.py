from datetime import datetime

from pydantic import BaseModel

from app.features.gamification.schemas import LevelSummary
from app.features.recipes.schemas import RecipeCard
from app.features.reminders.models import ReminderCategory


class ImminentAlert(BaseModel):
    """'두부 외 1개, 유통기한이 얼마 안 남았어요' 배너."""

    first_name: str
    others_count: int


class TodayChore(BaseModel):
    """'오늘의 집안일' — 세탁 D-1, 화장실 청소 D-0."""

    reminder_id: int
    category: ReminderCategory
    title: str
    due_at: datetime
    d_day: int


class FridgeSummary(BaseModel):
    total: int
    imminent: int


class HomeResponse(BaseModel):
    """[화면 1] 홈 대시보드."""

    level: LevelSummary
    imminent_alert: ImminentAlert | None
    today_chores: list[TodayChore]
    fridge: FridgeSummary
    today_recipe: RecipeCard | None
