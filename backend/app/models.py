"""모든 도메인 모델을 한 곳에서 import → Base.metadata 에 테이블 등록.

새 도메인에 모델을 추가하면 여기에도 한 줄 추가할 것.
"""

from app.features.gamification.models import Badge, UserBadge, XpLog  # noqa: F401
from app.features.ingredients.models import Ingredient, IngredientPreset  # noqa: F401
from app.features.notifications.models import NotificationLog, PushDevice  # noqa: F401
from app.features.recipes.models import CookLog, Recipe, RecipeIngredient, RecipeStep  # noqa: F401
from app.features.reminders.models import Reminder  # noqa: F401
from app.features.users.models import Seasoning, User, UserSeasoning  # noqa: F401
