"""요리 완료 · 실행 취소. 재료 소진/복구는 ingredients 도메인(염지연)의 공개 함수를 그대로 쓴다."""

from datetime import timedelta

from sqlalchemy import select

from app.common.time import today
from app.features.recipes.models import Recipe

API = "/api/v1"


def _add(client, headers, name, days=None):
    body = {"name": name}
    if days is not None:
        body["expires_on"] = (today() + timedelta(days=days)).isoformat()
    return client.post(f"{API}/ingredients", json=body, headers=headers).json()["id"]


def _recipe_id(db, title):
    return db.scalar(select(Recipe.id).where(Recipe.title == title))


def test_complete_auto_selects_and_gives_bonus(client, db, device_headers):
    tofu = _add(client, device_headers, "두부", days=1)  # 임박
    egg = _add(client, device_headers, "계란")
    _add(client, device_headers, "양파")  # 두부계란찜 재료 아님

    res = client.post(f"{API}/recipes/{_recipe_id(db, '두부계란찜')}/complete", headers=device_headers)
    assert res.status_code == 200
    body = res.json()
    assert {c["ingredient_id"] for c in body["consumed"]} == {tofu, egg}
    assert {c["name"]: c["imminent"] for c in body["consumed"]} == {"두부": True, "계란": False}
    assert body["xp"]["amount"] == 20
    assert body["xp"]["reasons"] == ["두부계란찜 요리 완료", "유통기한 내 소진 보너스"]

    fridge = client.get(f"{API}/ingredients", headers=device_headers).json()
    assert [i["name"] for i in fridge["items"]] == ["양파"]
    logs = client.get(f"{API}/gamification/xp-logs", headers=device_headers).json()
    assert {log["description"] for log in logs} == {"두부계란찜 요리 완료", "유통기한 내 소진 보너스"}
    assert client.get(f"{API}/gamification/stats", headers=device_headers).json()["saved_count"] == 1


def test_complete_with_selected_ids_no_bonus(client, db, device_headers):
    egg = _add(client, device_headers, "계란")
    _add(client, device_headers, "대파")
    res = client.post(
        f"{API}/recipes/{_recipe_id(db, '계란말이')}/complete",
        json={"ingredient_ids": [egg]},
        headers=device_headers,
    ).json()
    assert [c["ingredient_id"] for c in res["consumed"]] == [egg]
    assert res["xp"]["amount"] == 10
    assert client.get(f"{API}/ingredients", headers=device_headers).json()["total"] == 1


def test_complete_errors(client, db, device_headers):
    rid = _recipe_id(db, "두부조림")
    no_match = client.post(f"{API}/recipes/{rid}/complete", headers=device_headers)
    assert no_match.status_code == 422 and no_match.json()["code"] == "NO_INGREDIENTS"

    others = _add(client, {"X-Device-Id": "someone-else-01"}, "두부")
    res = client.post(f"{API}/recipes/{rid}/complete", json={"ingredient_ids": [others]}, headers=device_headers)
    assert res.status_code == 404


def test_undo_restores_everything(client, db, device_headers):
    _add(client, device_headers, "두부", days=0)
    _add(client, device_headers, "계란")
    done = client.post(f"{API}/recipes/{_recipe_id(db, '두부계란찜')}/complete", headers=device_headers).json()

    undo = client.post(f"{API}/recipes/cook-logs/{done['cook_log_id']}/undo", headers=device_headers)
    assert undo.status_code == 200
    assert undo.json()["xp_revoked"] == 20
    assert set(undo.json()["restored_ingredient_ids"]) == {c["ingredient_id"] for c in done["consumed"]}

    assert client.get(f"{API}/ingredients", headers=device_headers).json()["total"] == 2
    stats = client.get(f"{API}/gamification/stats", headers=device_headers).json()
    assert stats["xp"] == 0 and stats["saved_count"] == 0 and stats["cook_count"] == 0
    assert client.get(f"{API}/gamification/xp-logs", headers=device_headers).json() == []

    again = client.post(f"{API}/recipes/cook-logs/{done['cook_log_id']}/undo", headers=device_headers)
    assert again.status_code == 409 and again.json()["code"] == "ALREADY_UNDONE"
    other = client.post(
        f"{API}/recipes/cook-logs/{done['cook_log_id']}/undo", headers={"X-Device-Id": "someone-else-01"}
    )
    assert other.status_code == 404
