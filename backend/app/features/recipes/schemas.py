from pydantic import BaseModel, Field

from app.features.gamification.schemas import XpGain
from app.features.recipes.models import Cookware, Difficulty


class RecommendQuery(BaseModel):
    """[화면 4] 필터 칩."""

    imminent_first: bool = Field(True, description="임박 재료 먼저")
    max_minutes: int | None = Field(None, ge=1, description="예: 15 → 15분 이내")
    servings: int | None = Field(None, ge=1, description="인분 수")
    cookware: Cookware | None = None
    limit: int = Field(10, ge=1, le=50)


class IngredientTag(BaseModel):
    name: str
    owned: bool
    imminent: bool  # 진하게 강조되는 태그


class RecipeCard(BaseModel):
    id: int
    title: str
    image_url: str | None
    cook_minutes: int
    difficulty: Difficulty
    servings: int
    uses_imminent: bool  # '임박재료 사용' 뱃지
    imminent_count: int  # 홈: '임박재료 2개 사용'
    missing_count: int  # 0 = 바로 만들 수 있어요
    tags: list[IngredientTag]


class RecommendResponse(BaseModel):
    basis_ingredient_count: int  # '내 냉장고 재료 N개를 기준으로 추천했어요'
    ready: list[RecipeCard]  # 바로 만들 수 있어요 (missing 0)
    almost: list[RecipeCard]  # 1~2개만 더 있으면


class ChecklistItem(BaseModel):
    name: str
    amount: str | None
    owned: bool
    is_seasoning: bool
    is_optional: bool
    substitutes: list[str]
    owned_substitutes: list[str]  # 대체 재료 중 내가 가진 것


class RecipeStepRead(BaseModel):
    step_no: int
    description: str


class RecipeDetail(BaseModel):
    """[화면 5] 레시피 상세."""

    id: int
    title: str
    description: str | None
    image_url: str | None
    cook_minutes: int
    difficulty: Difficulty
    servings: int
    checklist: list[ChecklistItem]
    steps: list[RecipeStepRead]


class CookCompleteRequest(BaseModel):
    ingredient_ids: list[int] | None = Field(
        None, description="소진할 내 재료 id. 생략하면 레시피에 매칭된 보유 재료 전부"
    )


class ConsumedIngredient(BaseModel):
    ingredient_id: int
    name: str
    before_expiry: bool


class CookCompleteResponse(BaseModel):
    cook_log_id: int
    consumed: list[ConsumedIngredient]
    xp: XpGain


class CookUndoResponse(BaseModel):
    cook_log_id: int
    restored_ingredient_ids: list[int]
    xp_revoked: int
