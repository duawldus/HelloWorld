from datetime import timedelta

from app.common.time import today

API = "/api/v1/ingredients"


def test_create_from_preset_auto_expiry(client, device_headers):
    res = client.post(API, json={"name": "계란"}, headers=device_headers, params={"source": "PRESET"})
    assert res.status_code == 201
    body = res.json()
    assert body["expires_on"] == (today() + timedelta(days=21)).isoformat()
    assert body["quantity"] == 10
    assert body["d_day"] == 21


def test_list_sorted_by_expiry_and_imminent(client, device_headers):
    client.post(API, json={"name": "계란"}, headers=device_headers)
    tomorrow = (today() + timedelta(days=1)).isoformat()
    client.post(API, json={"name": "두부", "expires_on": tomorrow}, headers=device_headers)
    body = client.get(API, headers=device_headers).json()
    assert [i["name"] for i in body["items"]] == ["두부", "계란"]
    assert body["imminent_count"] == 1
    assert body["storage_counts"]["FRIDGE"] == 2


def test_rejects_past_expiry(client, device_headers):
    past = (today() - timedelta(days=1)).isoformat()
    assert client.post(API, json={"name": "우유", "expires_on": past}, headers=device_headers).status_code == 422


def test_update_and_delete(client, device_headers):
    item = client.post(API, json={"name": "양파"}, headers=device_headers).json()
    res = client.patch(f"{API}/{item['id']}", json={"quantity": 5}, headers=device_headers)
    assert res.json()["quantity"] == 5
    assert client.delete(f"{API}/{item['id']}", headers=device_headers).status_code == 204
    assert client.get(f"{API}/{item['id']}", headers=device_headers).status_code == 404


def test_photo_batch_awards_xp(client, device_headers):
    res = client.post(
        f"{API}/batch",
        json={"source": "PHOTO", "items": [{"name": "두부"}, {"name": "계란"}]},
        headers=device_headers,
    )
    assert res.status_code == 201
    assert res.json()["xp"]["amount"] == 15


def test_vision_mock(client, device_headers):
    files = {"image": ("fridge.jpg", b"fake-bytes", "image/jpeg")}
    body = client.post("/api/v1/vision/recognize", files=files, headers=device_headers).json()
    assert body["count"] == 3
    assert [i["needs_review"] for i in body["items"]] == [False, False, True]


def test_llm_vision_client_uses_common_llm(monkeypatch):
    from app.features.vision import client as vision_client

    captured = {}

    def fake_generate(output_type, prompt, *, system=None, images=None, max_tokens=4096):
        captured["images"] = images
        captured["prompt"] = prompt
        return output_type(items=[vision_client.RawDetection(name="두부", confidence=0.9)])

    monkeypatch.setattr(vision_client, "generate_structured", fake_generate)
    items = vision_client.LLMVisionClient(["두부", "계란"]).detect_ingredients(b"img", "image/png")
    assert items[0].name == "두부"
    assert captured["images"] == [(b"img", "image/png")]
    assert "두부, 계란" in captured["prompt"]


def test_find_preset_by_name_synonyms(db):
    from app.features.ingredients.service import find_preset_by_name

    def name_of(text):
        preset = find_preset_by_name(db, text)
        return preset.name if preset else None

    assert name_of("두부") == "두부"
    assert name_of("달걀") == "계란"
    assert name_of("파") == "대파"
    assert name_of("양파") == "양파"
    assert name_of("돼지고기 앞다리살") == "돼지고기"
    assert name_of("새송이 버섯") == "버섯"
    assert name_of("고추장") is None  # '고추'가 들어 있어도 다른 재료


def test_vision_merges_duplicates_and_uses_preset_names(client, device_headers):
    from app.features.vision import service as vision_service
    from app.features.vision.client import RawDetection

    class FakeClient:
        def detect_ingredients(self, image, content_type):
            return [
                RawDetection(name="달걀", quantity=6, unit="개", confidence=0.9),
                RawDetection(name="계란", quantity=4, unit="개", confidence=0.7),
                RawDetection(name="파", confidence=92),  # 퍼센트로 온 경우
                RawDetection(name="  ", confidence=0.5),  # 빈 이름은 버림
                RawDetection(name="아보카도", confidence=0.6),  # 프리셋에 없는 재료
            ]

    client.app.dependency_overrides[vision_service.get_client] = lambda: FakeClient()
    files = {"image": ("fridge.jpg", b"fake-bytes", "image/jpeg")}
    body = client.post("/api/v1/vision/recognize", files=files, headers=device_headers).json()
    del client.app.dependency_overrides[vision_service.get_client]

    items = {i["name"]: i for i in body["items"]}
    assert body["count"] == 3
    assert items["계란"]["quantity"] == 10
    assert items["계란"]["confidence"] == 0.9
    assert items["계란"]["needs_review"] is False
    assert items["대파"]["confidence"] == 0.92
    assert items["대파"]["unit"] == "단"  # 양을 모르면 프리셋 기본값
    assert items["아보카도"]["preset_id"] is None
    assert items["아보카도"]["needs_review"] is True


def test_edit_photo_registered_ingredient(client, device_headers):
    """사진으로 잘못 등록된 재료도 이름·수량·유통기한을 고칠 수 있고, 이름을 고치면 프리셋도 따라 바뀐다."""
    res = client.post(
        f"{API}/batch",
        json={"source": "PHOTO", "items": [{"name": "버섯"}, {"name": "호박잎"}]},
        headers=device_headers,
    )
    mushroom, leaf = res.json()["items"]
    assert mushroom["source"] == "PHOTO"

    body = client.patch(f"{API}/{mushroom['id']}", json={"name": "달걀", "quantity": 6}, headers=device_headers).json()
    assert body["name"] == "달걀"
    assert body["quantity"] == 6
    assert body["icon"] == "🥚"  # 버섯 아이콘이 남지 않음

    body = client.patch(
        f"{API}/{leaf['id']}", json={"name": "깻잎", "expires_on": "2099-01-01"}, headers=device_headers
    ).json()
    assert body["preset_id"] is None
    assert body["expires_on"] == "2099-01-01"


def test_consume_ingredient(client, device_headers):
    """'다 먹었어요' → 소진(CONSUMED). 냉장고에서 빠지고 XP는 없다."""
    tofu = client.post(API, json={"name": "두부"}, headers=device_headers).json()
    egg = client.post(API, json={"name": "계란"}, headers=device_headers).json()

    res = client.post(f"{API}/{tofu['id']}/consume", headers=device_headers)
    assert res.status_code == 200
    assert res.json()["status"] == "CONSUMED"

    fridge = client.get(API, headers=device_headers).json()
    assert [i["name"] for i in fridge["items"]] == ["계란"]
    assert client.get("/api/v1/gamification/stats", headers=device_headers).json()["xp"] == 0

    # 이미 소진한 재료 / 남의 재료 / 없는 재료 → 404
    assert client.post(f"{API}/{tofu['id']}/consume", headers=device_headers).status_code == 404
    other = {"X-Device-Id": "other-device-0002"}
    assert client.post(f"{API}/{egg['id']}/consume", headers=other).status_code == 404
    assert client.post(f"{API}/9999/consume", headers=device_headers).status_code == 404


def test_consume_ingredients_public_function(db):
    """recipes(요리 완료)가 쓰는 공개 함수: 여러 개를 한 번에, 중복 id는 한 번만."""
    from app.features.ingredients import service
    from app.features.ingredients.models import IngredientStatus
    from app.features.ingredients.schemas import IngredientCreate
    from app.features.users.models import User

    user = User(device_id="service-test-0001")
    db.add(user)
    db.flush()
    a = service.create_ingredient(db, user, IngredientCreate(name="두부"), "MANUAL")
    b = service.create_ingredient(db, user, IngredientCreate(name="대파"), "MANUAL")

    consumed = service.consume_ingredients(db, user, [a.id, b.id, a.id])
    db.commit()
    assert len(consumed) == 2
    assert all(i.status == IngredientStatus.CONSUMED and i.consumed_at for i in consumed)
    assert service.list_active(db, user.id) == []


def test_deduct_ingredients(client, device_headers):
    """수량 차감: 여러 개 한 번에, 0이 되면 소진, 남은 양보다 많이 빼면 남은 양까지만."""
    egg = client.post(API, json={"name": "계란", "quantity": 10}, headers=device_headers).json()
    tofu = client.post(API, json={"name": "두부", "quantity": 1}, headers=device_headers).json()
    milk = client.post(API, json={"name": "우유", "quantity": 1}, headers=device_headers).json()

    res = client.post(
        f"{API}/deduct",
        json={
            "items": [
                {"id": egg["id"], "amount": 2},
                {"id": egg["id"], "amount": 1},  # 같은 재료는 합쳐서 3개
                {"id": tofu["id"], "amount": 1},
                {"id": milk["id"], "amount": 5},  # 1개밖에 없음
            ]
        },
        headers=device_headers,
    )
    assert res.status_code == 200
    result = {r["name"]: r for r in res.json()["items"]}
    assert (result["계란"]["amount"], result["계란"]["left"], result["계란"]["status"]) == (3, 7, "ACTIVE")
    assert (result["두부"]["left"], result["두부"]["status"]) == (0, "CONSUMED")
    assert (result["우유"]["amount"], result["우유"]["left"]) == (1, 0)

    fridge = client.get(API, headers=device_headers).json()
    assert [(i["name"], i["quantity"]) for i in fridge["items"]] == [("계란", 7)]
    assert client.get("/api/v1/gamification/stats", headers=device_headers).json()["xp"] == 0


def test_deduct_is_all_or_nothing(client, device_headers):
    """하나라도 없는 재료면 404이고, 앞의 재료도 줄어들지 않는다."""
    egg = client.post(API, json={"name": "계란", "quantity": 10}, headers=device_headers).json()
    res = client.post(
        f"{API}/deduct",
        json={"items": [{"id": egg["id"], "amount": 2}, {"id": 9999, "amount": 1}]},
        headers=device_headers,
    )
    assert res.status_code == 404
    assert client.get(f"{API}/{egg['id']}", headers=device_headers).json()["quantity"] == 10

    bad = client.post(f"{API}/deduct", json={"items": [{"id": egg["id"], "amount": 0}]}, headers=device_headers)
    assert bad.status_code == 422  # 0 이하는 뺄 수 없음
    assert client.post(f"{API}/deduct", json={"items": []}, headers=device_headers).status_code == 422


def test_restore_ingredients_undo_cooking(client, db, device_headers):
    """실제 restore_ingredients 로 요리 완료 → 실행 취소 (recipes 테스트는 가짜 함수를 쓰므로 여기서 확인)."""
    from sqlalchemy import select

    from app.features.recipes.models import Recipe

    tofu = client.post(API, json={"name": "두부", "quantity": 2}, headers=device_headers).json()
    egg = client.post(API, json={"name": "계란"}, headers=device_headers).json()
    recipe_id = db.scalar(select(Recipe.id).where(Recipe.title == "두부계란찜"))
    done = client.post(f"/api/v1/recipes/{recipe_id}/complete", headers=device_headers).json()
    assert client.get(API, headers=device_headers).json()["total"] == 0

    undo = client.post(f"/api/v1/recipes/cook-logs/{done['cook_log_id']}/undo", headers=device_headers)
    assert undo.status_code == 200
    assert set(undo.json()["restored_ingredient_ids"]) == {tofu["id"], egg["id"]}

    fridge = {i["name"]: i for i in client.get(API, headers=device_headers).json()["items"]}
    assert fridge["두부"]["quantity"] == 2 and fridge["두부"]["status"] == "ACTIVE"
    assert fridge["계란"]["quantity"] == 10


def test_restore_skips_discarded_and_others(db):
    """취소 전에 '버렸어요' 한 재료와 남의 재료는 되살리지 않는다."""
    from app.features.ingredients import service
    from app.features.ingredients.models import IngredientStatus
    from app.features.ingredients.schemas import IngredientCreate
    from app.features.users.models import User

    me, other = User(device_id="restore-test-0001"), User(device_id="restore-test-0002")
    db.add_all([me, other])
    db.flush()
    a = service.create_ingredient(db, me, IngredientCreate(name="두부"), "MANUAL")
    b = service.create_ingredient(db, me, IngredientCreate(name="대파"), "MANUAL")
    c = service.create_ingredient(db, other, IngredientCreate(name="계란"), "MANUAL")
    service.consume_ingredients(db, me, [a.id, b.id])
    service.consume_ingredients(db, other, [c.id])
    db.get(service.Ingredient, b.id).status = IngredientStatus.DISCARDED

    snaps = [{"ingredient_id": i, "prev_quantity": 1, "prev_status": "ACTIVE"} for i in (a.id, b.id, c.id, 9999)]
    assert service.restore_ingredients(db, me, snaps) == [a.id]
    assert db.get(service.Ingredient, c.id).status == IngredientStatus.CONSUMED
