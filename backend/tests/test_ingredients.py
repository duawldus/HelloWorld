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
