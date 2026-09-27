API = "/api/v1"


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_device_id_creates_then_reuses_user(client):
    headers = {"X-Device-Id": "device-abcdefgh"}
    first = client.get(f"{API}/users/me", headers=headers).json()
    second = client.get(f"{API}/users/me", headers=headers).json()
    other = client.get(f"{API}/users/me", headers={"X-Device-Id": "device-zzzzzzzz"}).json()
    assert first["id"] == second["id"]
    assert first["id"] != other["id"]
    assert first["onboarded"] is False


def test_requires_device_id(client):
    assert client.get(f"{API}/users/me").status_code == 401
    assert client.get(f"{API}/users/me", headers={"X-Device-Id": "short"}).status_code == 401


def test_onboarding_seasonings(client, device_headers):
    options = client.get(f"{API}/users/me/seasonings", headers=device_headers).json()
    assert not any(o["owned"] for o in options)

    picked = [options[0]["id"], options[1]["id"]]
    res = client.put(f"{API}/users/me/seasonings", json={"seasoning_ids": picked}, headers=device_headers)
    assert sum(o["owned"] for o in res.json()) == 2
    assert client.get(f"{API}/users/me", headers=device_headers).json()["onboarded"] is True


def test_error_responses_share_one_shape(client, device_headers):
    bad = client.patch(f"{API}/users/me", json={"nickname": ""}, headers=device_headers)
    body = bad.json()
    assert bad.status_code == 422 and body["code"] == "VALIDATION_ERROR"
    assert body["message"].startswith("nickname: ")
    assert body["errors"][0]["field"] == "nickname"

    rule = client.post(
        f"{API}/reminders",
        json={"category": "CLEANING", "title": "청소", "repeat_type": "WEEKLY", "remind_time": "09:00"},
        headers=device_headers,
    ).json()
    assert rule["message"] == "매주 반복은 요일을 1개 이상 선택해야 합니다."  # 'Value error, ' 접두어 제거

    missing = client.get(f"{API}/no-such-path", headers=device_headers)
    assert missing.status_code == 404 and missing.json()["code"] == "NOT_FOUND"


def test_patch_null_means_no_change(client, device_headers):
    client.patch(f"{API}/users/me", json={"nickname": "시연"}, headers=device_headers)
    res = client.patch(f"{API}/users/me", json={"nickname": None}, headers=device_headers)
    assert res.status_code == 200 and res.json()["nickname"] == "시연"

    payload = {"category": "LAUNDRY", "title": "빨래", "repeat_type": "DAILY", "remind_time": "20:00"}
    rid = client.post(f"{API}/reminders", json=payload, headers=device_headers).json()["id"]
    res = client.patch(f"{API}/reminders/{rid}", json={"remind_time": None, "title": None}, headers=device_headers)
    assert res.status_code == 200
    assert (res.json()["remind_time"], res.json()["title"]) == ("20:00:00", "빨래")
