"""AI 레시피 프롬프트 튜닝용: 여러 냉장고 상황으로 실제 Gemini 를 호출하고 결과를 자동 점검한다.

    cd backend
    GEMINI_API_KEY=... python -m scripts.eval_recipe_prompt            # 전체 시나리오
    GEMINI_API_KEY=... python -m scripts.eval_recipe_prompt 1 3        # 1, 3번만

무료 한도를 쓰니 필요한 시나리오만 돌리자. 결과는 scripts/out/ 에 JSON 으로도 저장된다 (git 제외).
"""

import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from app.common.config import settings
from app.common.llm import LLMError
from app.features.recipes.generator import GeneratedRecipe, GenerationRequest, LLMRecipeGenerator
from app.features.recipes.models import Cookware
from app.features.recipes.service import MAX_MISSING

ALL_SEASONINGS = [
    "간장",
    "식용유",
    "소금",
    "후추",
    "설탕",
    "고추장",
    "된장",
    "참기름",
    "고춧가루",
    "다진마늘",
    "마요네즈",
    "케첩",
]
MAX_STEP_CHARS = 60


@dataclass
class Scenario:
    name: str
    req: GenerationRequest


SCENARIOS = [
    Scenario(
        "기본: 흔한 재료 + 양념 전부",
        GenerationRequest(
            ingredients=[("두부", 1), ("대파", 2), ("계란", 5), ("양파", 10)],
            seasonings=ALL_SEASONINGS,
        ),
    ),
    Scenario(
        "애매한 조합",
        GenerationRequest(
            ingredients=[("우유", 0), ("브로콜리", 2), ("닭가슴살", 3), ("식빵", 4)],
            seasonings=ALL_SEASONINGS,
        ),
    ),
    Scenario(
        "10분 + 전자레인지",
        GenerationRequest(
            ingredients=[("계란", 1), ("스팸", 3), ("밥", 1), ("김치", 20)],
            seasonings=ALL_SEASONINGS,
            max_minutes=10,
            cookware=Cookware.MICROWAVE,
        ),
    ),
    Scenario(
        "양념 거의 없음",
        GenerationRequest(
            ingredients=[("감자", 3), ("양파", 5), ("베이컨", 2)],
            seasonings=["소금"],
        ),
    ),
    Scenario(
        "재료 1개 + 냄비",
        GenerationRequest(
            ingredients=[("애호박", 0)],
            seasonings=ALL_SEASONINGS,
            cookware=Cookware.POT,
        ),
    ),
    Scenario(
        "기존 레시피와 겹치기 쉬움",
        GenerationRequest(
            ingredients=[("김치", 2), ("돼지고기", 1), ("두부", 3)],
            seasonings=ALL_SEASONINGS,
            avoid_titles=["김치찌개", "김치볶음밥", "두부김치", "제육볶음", "김치전"],
        ),
    ),
]


@dataclass
class Report:
    problems: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def check(r: GeneratedRecipe, req: GenerationRequest) -> Report:
    """service.match_recipe 와 같은 기준으로 '추천에 실제로 뜰지'를 포함해 점검."""
    rep = Report()
    fridge = {n for n, _ in req.ingredients}
    imminent = {n for n, d in req.ingredients if d <= settings.IMMINENT_DAYS}
    owned = fridge | set(req.seasonings)

    used = [i.name for i in r.ingredients if i.name in fridge]
    missing = [
        i.name
        for i in r.ingredients
        if not i.is_optional and i.name not in owned and not any(s in owned for s in i.substitutes)
    ]
    if not used:
        rep.problems.append("냉장고 재료를 하나도 안 씀 (이름 불일치?) → 추천에서 제외됨")
    if len(missing) > MAX_MISSING:
        rep.problems.append(f"부족 재료 {len(missing)}개 {missing} → 추천에서 제외됨")
    elif missing:
        rep.notes.append(f"부족 {missing}")
    if imminent and not imminent & set(used):
        rep.problems.append(f"임박 재료 {sorted(imminent)} 를 안 씀")

    for i in r.ingredients:
        if not i.is_seasoning and not i.is_optional and i.quantity is None:
            rep.problems.append(f"주재료 수량 없음: {i.name}")
        if i.is_seasoning and i.name not in req.seasonings and not i.is_optional:
            rep.problems.append(f"없는 양념을 필수로: {i.name}")
        if not i.is_seasoning and i.name in req.seasonings:
            rep.notes.append(f"양념인데 is_seasoning=false: {i.name}")

    if not 3 <= len(r.steps) <= 6:
        rep.problems.append(f"조리 단계 {len(r.steps)}개 (3~6)")
    long_steps = [s for s in r.steps if len(s) > MAX_STEP_CHARS]
    if long_steps:
        rep.problems.append(f"긴 단계 {len(long_steps)}개 (>{MAX_STEP_CHARS}자)")
    if req.max_minutes and r.cook_minutes > req.max_minutes:
        rep.problems.append(f"조리 시간 {r.cook_minutes}분 > {req.max_minutes}분")
    if req.cookware and r.cookware != req.cookware:
        rep.problems.append(f"조리도구 {r.cookware.value} ≠ {req.cookware.value}")
    if r.title in req.avoid_titles:
        rep.problems.append("기존 레시피와 제목 중복")
    if len(r.title) > 20:
        rep.problems.append(f"제목 {len(r.title)}자")
    if len(r.description) > 40:
        rep.notes.append(f"소개 {len(r.description)}자")
    return rep


def show(r: GeneratedRecipe, rep: Report) -> None:
    print(f"\n  ■ {r.title}  ({r.cook_minutes}분 · {r.difficulty.value} · {r.cookware.value})")
    print(f"    {r.description}")
    for i in r.ingredients:
        amount = "약간" if i.quantity is None else f"{i.quantity:g}{i.unit or ''}"
        flags = ("양념 " if i.is_seasoning else "") + ("선택 " if i.is_optional else "")
        subs = f" (대체: {', '.join(i.substitutes)})" if i.substitutes else ""
        print(f"    - {i.name} {amount} {flags}{subs}")
    for n, s in enumerate(r.steps, 1):
        print(f"    {n}. {s}")
    for p in rep.problems:
        print(f"    ❌ {p}")
    for n in rep.notes:
        print(f"    ⚠️  {n}")
    if not rep.problems:
        print("    ✅ 자동 점검 통과")


def main(selected: list[int]) -> None:
    if not settings.GEMINI_API_KEY:
        sys.exit("GEMINI_API_KEY 가 없어요. backend/.env 에 넣거나 환경 변수로 주세요.")
    out_dir = Path(__file__).parent / "out"
    out_dir.mkdir(exist_ok=True)
    gen = LLMRecipeGenerator()
    total = failed = 0
    dump = []
    for idx, sc in enumerate(SCENARIOS, 1):
        if selected and idx not in selected:
            continue
        print(f"\n===== {idx}. {sc.name} =====")
        start = time.monotonic()
        try:
            recipes = gen.generate(sc.req)
        except LLMError as e:
            print(f"  ❌ {e.message} → 여기서 멈춤 (무료 등급은 하루 요청 수 제한이 있음)")
            break
        print(f"  ({time.monotonic() - start:.1f}초, {len(recipes)}개)")
        for r in recipes:
            rep = check(r, sc.req)
            show(r, rep)
            total += 1
            failed += bool(rep.problems)
            dump.append({"scenario": sc.name, "recipe": r.model_dump(mode="json"), "problems": rep.problems})
    path = out_dir / f"{time.strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(dump, ensure_ascii=False, indent=2))
    print(f"\n합계: {total}개 중 문제 있음 {failed}개 → {path}")


if __name__ == "__main__":
    main([int(a) for a in sys.argv[1:]])
