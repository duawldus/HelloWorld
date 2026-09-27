API = "/api/v1"


def test_todo_endpoints_return_501(client, device_headers):
    """구현 전 TODO 엔드포인트는 501. 구현하면 이 테스트를 실제 테스트로 교체할 것."""
    assert client.post(f"{API}/recipes/1/complete", headers=device_headers).status_code == 501


def test_home(client, device_headers):
    empty = client.get(f"{API}/home", headers=device_headers).json()
    assert empty["today_recipe"] is None

    client.post(f"{API}/ingredients", json={"name": "두부"}, headers=device_headers)
    client.post(f"{API}/ingredients", json={"name": "계란"}, headers=device_headers)
    body = client.get(f"{API}/home", headers=device_headers).json()
    assert body["fridge"] == {"total": 2, "imminent": 0}
    assert body["level"]["title"] == "자취 새내기"
    assert body["today_recipe"] is not None


def test_stats_and_badges(client, device_headers):
    stats = client.get(f"{API}/gamification/stats", headers=device_headers).json()
    assert stats["level"] == 1 and stats["next_level_xp"] == 100
    badges = client.get(f"{API}/gamification/badges", headers=device_headers).json()
    assert badges["total_count"] == 6 and badges["acquired_count"] == 0
