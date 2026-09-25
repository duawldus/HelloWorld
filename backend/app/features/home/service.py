"""홈 대시보드 = 다른 도메인의 공개 함수를 모아 보여주는 조합(aggregation) 계층. 자체 모델 없음."""

from datetime import datetime, time, timedelta

from sqlalchemy.orm import Session

from app.common.config import settings
from app.common.time import d_day, now
from app.features.gamification import service as gamification
from app.features.home.schemas import FridgeSummary, HomeResponse, ImminentAlert, TodayChore
from app.features.ingredients import service as ingredients
from app.features.recipes import service as recipes
from app.features.recipes.schemas import RecipeCard, RecommendQuery
from app.features.reminders import service as reminders
from app.features.reminders.schedule import next_occurrence
from app.features.users.models import User

CHORE_WINDOW_DAYS = 1  # 오늘/내일(D-0, D-1) 해야 할 일만 노출


def _today_recipe(db: Session, user: User) -> RecipeCard | None:
    try:
        result = recipes.recommend(db, user, RecommendQuery(limit=1))
    except NotImplementedError:
        return None  # TODO(home): recipes.recommend 구현되면 이 try 제거
    return next(iter(result.ready + result.almost), None)


def get_home(db: Session, user: User) -> HomeResponse:
    active = ingredients.list_active(db, user.id)  # 이미 유통기한 임박순
    imminent = [i for i in active if d_day(i.expires_on) <= settings.IMMINENT_DAYS]

    current = now()
    start_of_today = datetime.combine(current.date(), time.min) - timedelta(seconds=1)
    horizon = current.date() + timedelta(days=CHORE_WINDOW_DAYS)
    chores = []
    for r in reminders.list_enabled(db, user.id):
        due = next_occurrence(r, start_of_today)
        if due and due.date() <= horizon:
            chores.append(
                TodayChore(
                    reminder_id=r.id,
                    category=r.category,
                    title=r.title,
                    due_at=due,
                    d_day=d_day(due.date(), current.date()),
                )
            )

    return HomeResponse(
        level=gamification.get_level_summary(user),
        imminent_alert=ImminentAlert(first_name=imminent[0].name, others_count=len(imminent) - 1) if imminent else None,
        today_chores=sorted(chores, key=lambda c: c.due_at),
        fridge=FridgeSummary(total=len(active), imminent=len(imminent)),
        today_recipe=_today_recipe(db, user),
    )
