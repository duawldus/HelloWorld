"""추천할 레시피가 부족할 때 AI(Gemini)로 레시피를 실시간 생성한다. LLM 호출은 app.common.llm 을 통한다."""

from typing import Protocol

from pydantic import BaseModel, Field

from app.common.llm import generate_structured
from app.features.recipes.models import Cookware, Difficulty


class GeneratedIngredient(BaseModel):
    name: str = Field(description="재료 이름. 사용자가 가진 재료/양념 이름과 글자 그대로 똑같이")
    quantity: float | None = Field(
        description="1인분 기준 수량. 정수 또는 1/4·1/3·1/2 단위(0.25, 0.33, 0.5). '약간'처럼 수량이 없으면 null"
    )
    unit: str | None = Field(description="단위 (개, 모, 큰술, 작은술, g, 컵, 약간 등)")
    is_seasoning: bool = Field(description="양념이면 true")
    is_optional: bool = Field(description="없어도 되는 재료면 true")
    substitutes: list[str] = Field(description="대체 가능한 재료 이름. 없으면 빈 배열")


class GeneratedRecipe(BaseModel):
    title: str = Field(description="요리 이름 (20자 이내)")
    description: str = Field(description="한 줄 소개 (40자 이내)")
    cook_minutes: int = Field(description="총 조리 시간(분)")
    difficulty: Difficulty
    cookware: Cookware = Field(description="주 조리도구. ONE_PAN=프라이팬 하나, MICROWAVE=전자레인지, POT=냄비")
    ingredients: list[GeneratedIngredient]
    steps: list[str] = Field(description="조리 순서. 3~6단계, 각 단계는 50자 안팎의 한 문장")


class GeneratedRecipes(BaseModel):
    recipes: list[GeneratedRecipe]


class GenerationRequest(BaseModel):
    """생성 조건. service 가 사용자의 냉장고 상태로 채운다."""

    ingredients: list[tuple[str, int]]  # (재료 이름, 남은 일수) — 임박순
    seasonings: list[str]
    max_minutes: int | None = None
    cookware: Cookware | None = None
    avoid_titles: list[str] = []  # 이미 있는 레시피와 겹치지 않게
    count: int = 2


class RecipeGenerator(Protocol):
    def generate(self, req: GenerationRequest) -> list[GeneratedRecipe]: ...


class MockRecipeGenerator:
    """AI_MOCK=true 일 때. 가장 임박한 재료 두 개로 간단한 볶음 레시피를 만든다 (비용 0, 테스트/프론트 개발용)."""

    def generate(self, req: GenerationRequest) -> list[GeneratedRecipe]:
        mains = [name for name, _ in req.ingredients[:2]]
        if not mains:
            return []
        title = f"{' '.join(mains)} 볶음"
        if title in req.avoid_titles:
            return []
        oil = "식용유" if "식용유" in req.seasonings else None
        seasoning = (
            [
                GeneratedIngredient(
                    name=oil, quantity=1, unit="큰술", is_seasoning=True, is_optional=False, substitutes=[]
                )
            ]
            if oil
            else []
        )
        return [
            GeneratedRecipe(
                title=title,
                description="냉장고 속 임박 재료를 빠르게 소진하는 볶음",
                cook_minutes=10,
                difficulty=Difficulty.EASY,
                cookware=Cookware.ONE_PAN,
                ingredients=[
                    GeneratedIngredient(
                        name=m, quantity=1, unit="개", is_seasoning=False, is_optional=False, substitutes=[]
                    )
                    for m in mains
                ]
                + seasoning,
                steps=[
                    f"{', '.join(mains)}을(를) 한입 크기로 썰어요.",
                    "달군 팬에 넣고 5분간 볶아요.",
                    "간을 맞추면 완성!",
                ],
            )
        ]


SYSTEM_PROMPT = (
    "너는 자취하는 대학생을 위한 레시피 작성자다. "
    "1인분 기준으로, 자취방 주방(프라이팬 하나, 냄비 하나, 전자레인지)에서 30분 안에 만들 수 있는 "
    "현실적이고 맛있는 한국 가정식 위주의 레시피를 만든다. 실제로 존재하는 요리법만 쓴다."
)


COOKWARE_KO = {Cookware.ONE_PAN: "프라이팬 하나", Cookware.MICROWAVE: "전자레인지만", Cookware.POT: "냄비 하나"}


class LLMRecipeGenerator:
    """프롬프트는 scripts/eval_recipe_prompt.py 로 실제 결과를 보며 조정한다."""

    def generate(self, req: GenerationRequest) -> list[GeneratedRecipe]:
        ingredient_lines = "\n".join(
            f"- {name} (유통기한 {'오늘까지' if d <= 0 else f'{d}일 남음'})" for name, d in req.ingredients
        )
        conditions = []
        if req.max_minutes:
            conditions.append(f"- 조리 시간 {req.max_minutes}분 이내")
        if req.cookware:
            conditions.append(f"- 조리도구: {COOKWARE_KO[req.cookware]} (cookware={req.cookware.value})")
        if req.avoid_titles:
            conditions.append(f"- 다음 요리와 겹치지 않게: {', '.join(req.avoid_titles[:50])}")

        prompt = f"""내 냉장고 재료로 만들 수 있는 레시피 {req.count}개를 만들어줘.

[냉장고 재료 — 위에 있을수록 유통기한이 급함]
{ingredient_lines}

[가지고 있는 양념]
{", ".join(req.seasonings) or "없음"}

[규칙]
- 유통기한이 급한 재료를 최대한 많이 쓸 것
- 주재료는 위 냉장고 재료에서만 고를 것. 없는 재료가 꼭 필요하면 1개까지만 허용
- 양념은 가지고 있는 양념 위주로. 없는 양념은 is_optional=true
- 재료 이름은 위 목록의 이름을 글자 그대로 쓸 것
- 수량은 1인분 기준. 정수나 1/4·1/3·1/2 단위로만 쓰고, 그보다 적은 양념은 '약간'(quantity=null)
- 물은 재료 목록에 넣지 말고 조리 순서에만 쓸 것 (예: "물 1컵을 붓고")
- 조리 순서의 각 단계는 50자 안팎의 한 문장. 동작은 한 단계에 1~2개만
{chr(10).join(conditions)}"""

        result = generate_structured(GeneratedRecipes, prompt, system=SYSTEM_PROMPT)
        return result.recipes[: req.count]
