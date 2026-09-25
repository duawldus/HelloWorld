from datetime import timedelta

from app.common.time import today

API = "/api/v1/ingredients"


def test_create_from_preset_auto_expiry(client, auth_headers):
    res = client.post(API, json={"name": "계란"}, headers=auth_headers, params={"source": "PRESET"})
    assert res.status_code == 201
    body = res.json()
    assert body["expires_on"] == (today() + timedelta(days=21)).isoformat()
    assert body["quantity"] == 10
    assert body["d_day"] == 21


def test_list_sorted_by_expiry_and_imminent(client, auth_headers):
    client.post(API, json={"name": "계란"}, headers=auth_headers)
    tomorrow = (today() + timedelta(days=1)).isoformat()
    client.post(API, json={"name": "두부", "expires_on": tomorrow}, headers=auth_headers)
    body = client.get(API, headers=auth_headers).json()
    assert [i["name"] for i in body["items"]] == ["두부", "계란"]
    assert body["imminent_count"] == 1
    assert body["storage_counts"]["FRIDGE"] == 2


def test_rejects_past_expiry(client, auth_headers):
    past = (today() - timedelta(days=1)).isoformat()
    assert client.post(API, json={"name": "우유", "expires_on": past}, headers=auth_headers).status_code == 422


def test_update_and_delete(client, auth_headers):
    item = client.post(API, json={"name": "양파"}, headers=auth_headers).json()
    res = client.patch(f"{API}/{item['id']}", json={"quantity": 5}, headers=auth_headers)
    assert res.json()["quantity"] == 5
    assert client.delete(f"{API}/{item['id']}", headers=auth_headers).status_code == 204
    assert client.get(f"{API}/{item['id']}", headers=auth_headers).status_code == 404


def test_photo_batch_awards_xp(client, auth_headers):
    res = client.post(
        f"{API}/batch",
        json={"source": "PHOTO", "items": [{"name": "두부"}, {"name": "계란"}]},
        headers=auth_headers,
    )
    assert res.status_code == 201
    assert res.json()["xp"]["amount"] == 15


def test_vision_mock(client, auth_headers):
    files = {"image": ("fridge.jpg", b"fake-bytes", "image/jpeg")}
    body = client.post("/api/v1/vision/recognize", files=files, headers=auth_headers).json()
    assert body["count"] == 3
    assert [i["needs_review"] for i in body["items"]] == [False, False, True]


def test_claude_vision_client_uses_common_llm(monkeypatch):
    from app.features.vision import client as vision_client

    captured = {}

    def fake_generate(output_type, prompt, *, system=None, images=None, max_tokens=4096):
        captured["images"] = images
        captured["prompt"] = prompt
        return output_type(items=[vision_client.RawDetection(name="두부", confidence=0.9)])

    monkeypatch.setattr(vision_client, "generate_structured", fake_generate)
    items = vision_client.ClaudeVisionClient(["두부", "계란"]).detect_ingredients(b"img", "image/png")
    assert items[0].name == "두부"
    assert captured["images"] == [(b"img", "image/png")]
    assert "두부, 계란" in captured["prompt"]
