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
