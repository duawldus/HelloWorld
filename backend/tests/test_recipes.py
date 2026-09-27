from datetime import timedelta

import pytest
from sqlalchemy import select

from app.common.llm import LLMError
from app.common.time import today
from app.features.recipes import service
from app.features.recipes.models import Recipe, RecipeSource
from app.main import app

API = "/api/v1/recipes"


def _add(client, headers, name, days=None):
    body = {"name": name}
    if days is not None:
        body["expires_on"] = (today() + timedelta(days=days)).isoformat()
    assert client.post("/api/v1/ingredients", json=body, headers=headers).status_code == 201


def _set_seasonings(client, headers, names):
    options = client.get("/api/v1/users/me/seasonings", headers=headers).json()
    ids = [o["id"] for o in options if o["name"] in names]
    client.put("/api/v1/users/me/seasonings", json={"seasoning_ids": ids}, headers=headers)


def _recipe_id(db, title):
    return db.scalar(select(Recipe.id).where(Recipe.title == title))


@pytest.mark.parametrize(
    ("qty", "unit", "expected"),
    [
        (0.5, "모", "1/2모"),
        (1.5, "큰술", "1과 1/2큰술"),
        (2, "개", "2개"),
        (None, "약간", "약간"),
        (0.2, "개", "0.2개"),
    ],
)
def test_format_amount(qty, unit, expected):
    assert service.format_amount(qty, unit) == expected


def test_detail_marks_owned_and_substitutes(client, db, device_headers):
    _add(client, device_headers, "두부")
    _add(client, device_headers, "양파")
    detail = client.get(f"{API}/{_recipe_id(db, '두부 계란부침')}", headers=device_headers).json()
    checklist = {c["name"]: c for c in detail["checklist"]}
    assert checklist["두부"]["owned"] is True
    assert checklist["계란"]["owned"] is False
    assert checklist["대파"]["owned_substitutes"] == ["양파"]
    assert len(detail["steps"]) == 3


def test_detail_servings_scaling(client, db, device_headers):
    rid = _recipe_id(db, "두부조림")
    one = client.get(f"{API}/{rid}", headers=device_headers).json()
    assert one["servings"] == 1 and one["base_servings"] == 1
    assert {c["name"]: c["amount"] for c in one["checklist"]}["두부"] == "1모"

    three = client.get(f"{API}/{rid}", params={"servings": 3}, headers=device_headers).json()
    amounts = {c["name"]: c["amount"] for c in three["checklist"]}
    assert amounts["두부"] == "3모"
    assert amounts["설탕"] == "1과 1/2큰술"
    assert client.get(f"{API}/{rid}", params={"servings": 0}, headers=device_headers).status_code == 422


def test_recipe_not_found(client, device_headers):
    assert client.get(f"{API}/9999", headers=device_headers).status_code == 404


def test_recommend_empty_fridge(client, device_headers):
    res = client.get(f"{API}/recommendations", headers=device_headers)
    assert res.status_code == 422
    assert res.json()["code"] == "EMPTY_FRIDGE"


def test_recommend_imminent_first(client, device_headers):
    _set_seasonings(client, device_headers, {"소금", "간장", "식용유"})
    _add(client, device_headers, "두부", days=1)  # 임박
    _add(client, device_headers, "계란")
    _add(client, device_headers, "대파")

    body = client.get(f"{API}/recommendations", headers=device_headers).json()
    assert body["basis_ingredient_count"] == 3
    assert body["ai_generated"] is False

    first = body["ready"][0]
    assert first["uses_imminent"] is True
    assert first["missing_count"] == 0
    assert {"name": "두부", "owned": True, "imminent": True} in first["tags"]
    # 바로 가능한 것 중 임박 재료(두부)를 쓰는 레시피가 먼저
    flags = [c["uses_imminent"] for c in body["ready"]]
    assert flags == sorted(flags, reverse=True)
    assert all(1 <= c["missing_count"] <= 2 for c in body["almost"])


def test_recommend_filters_and_exclude(client, device_headers):
    _set_seasonings(client, device_headers, {"소금", "간장", "식용유"})
    _add(client, device_headers, "계란")
    _add(client, device_headers, "두부")

    quick = client.get(
        f"{API}/recommendations", params={"max_minutes": 5, "allow_ai": False}, headers=device_headers
    ).json()
    assert quick["ready"] and all(c["cook_minutes"] <= 5 for c in quick["ready"] + quick["almost"])

    first = client.get(f"{API}/recommendations", params={"allow_ai": False}, headers=device_headers).json()
    shown = [c["id"] for c in first["ready"] + first["almost"]]
    params = [("exclude_ids", i) for i in shown[:2]] + [("allow_ai", False)]
    second = client.get(f"{API}/recommendations", params=params, headers=device_headers).json()
    assert not {c["id"] for c in second["ready"] + second["almost"]} & set(shown[:2])


def test_ai_generates_when_not_enough(client, db, device_headers):
    _set_seasonings(client, device_headers, {"식용유"})
    _add(client, device_headers, "고추")  # 큐레이션 레시피로는 매칭 안 되는 재료

    body = client.get(f"{API}/recommendations", headers=device_headers).json()
    assert body["ai_generated"] is True
    card = body["ready"][0]
    assert card["is_ai_generated"] is True
    saved = db.get(Recipe, card["id"])
    assert saved.source == RecipeSource.AI and saved.title == "고추 볶음"

    # 같은 레시피는 다시 만들지 않고 저장된 것을 재사용
    again = client.get(f"{API}/recommendations", headers=device_headers).json()
    assert again["ai_generated"] is False
    assert again["ready"][0]["id"] == card["id"]


def test_ai_disabled_by_param(client, device_headers):
    _add(client, device_headers, "고추")
    body = client.get(f"{API}/recommendations", params={"allow_ai": False}, headers=device_headers).json()
    assert body == {"basis_ingredient_count": 1, "ready": [], "almost": [], "ai_generated": False}


def test_ai_failure_does_not_break_recommendation(client, device_headers):
    class Broken:
        def generate(self, req):
            raise LLMError("boom")

    app.dependency_overrides[service.get_generator] = lambda: Broken()
    _add(client, device_headers, "고추")
    res = client.get(f"{API}/recommendations", headers=device_headers)
    assert res.status_code == 200
    assert res.json()["ai_generated"] is False
