API = "/api/v1"


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_guest_login_creates_then_reuses_user(client):
    first = client.post(f"{API}/auth/guest", json={"device_id": "device-abcdefgh"}).json()
    second = client.post(f"{API}/auth/guest", json={"device_id": "device-abcdefgh"}).json()
    assert first["is_new_user"] is True
    assert second["is_new_user"] is False
    assert first["user"]["id"] == second["user"]["id"]


def test_requires_token(client):
    assert client.get(f"{API}/users/me").status_code == 401


def test_onboarding_seasonings(client, auth_headers):
    options = client.get(f"{API}/users/me/seasonings", headers=auth_headers).json()
    assert not any(o["owned"] for o in options)

    picked = [options[0]["id"], options[1]["id"]]
    res = client.put(f"{API}/users/me/seasonings", json={"seasoning_ids": picked}, headers=auth_headers)
    assert sum(o["owned"] for o in res.json()) == 2
    assert client.get(f"{API}/users/me", headers=auth_headers).json()["onboarded"] is True
