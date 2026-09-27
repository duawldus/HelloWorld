from pydantic import BaseModel, Field

from app.features.gamification.schemas import XpGain
from app.features.recipes.models import Cookware, Difficulty


class RecommendQuery(BaseModel):
    """[화면 4] 필터 칩."""

    imminent_first: bool = Field(True, description="임박 재료 먼저")
    max_minutes: int | None = Field(None, ge=1, description="예: 15 → 15분 이내")
    cookware: Cookware | None = Field(None, description="조리도구 필터 (원팬/전자레인지/냄비)")
    servings: int = Field(1, ge=1, le=10, description="인분 수 (카드에 표시, 상세 조회 시 그대로 넘기면 됨)")
    exclude_ids: list[int] = Field([], description="'다른 레시피 추천받기' — 이미 보여준 레시피 id")
    limit: int = Field(10, ge=1, le=50, description="ready / almost 각각 최대 개수")
    allow_ai: bool = Field(True, description="결과가 부족하면 AI(Gemini)로 레시피를 새로 생성할지")


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
    is_ai_generated: bool  # AI(Gemini)가 생성한 레시피
    uses_imminent: bool  # '임박재료 사용' 뱃지
    imminent_count: int  # 홈: '임박재료 2개 사용'
    missing_count: int  # 0 = 바로 만들 수 있어요
    tags: list[IngredientTag]


class RecommendResponse(BaseModel):
    basis_ingredient_count: int  # '내 냉장고 재료 N개를 기준으로 추천했어요'
    ready: list[RecipeCard]  # 바로 만들 수 있어요 (missing 0)
    almost: list[RecipeCard]  # 1~2개만 더 있으면
    ai_generated: bool  # 이번 요청에서 AI(Gemini)가 새 레시피를 만들었는지 (FE: 'AI가 새 레시피를 만들었어요' 안내)


class ChecklistItem(BaseModel):
    name: str
    amount: str  # 요청한 인분으로 환산된 표시용 문자열 ("1과 1/2모", "약간")
    quantity: float | None  # 환산된 수량 (없으면 None)
    unit: str | None
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
    servings: int  # 요청한 인분 (기본 1)
    base_servings: int  # 레시피 원래 기준 인분
    is_ai_generated: bool
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
