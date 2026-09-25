API = "/api/v1"


def test_recipe_detail_marks_owned(client, auth_headers):
    client.post(f"{API}/ingredients", json={"name": "두부"}, headers=auth_headers)
    client.post(f"{API}/ingredients", json={"name": "양파"}, headers=auth_headers)

    detail = client.get(f"{API}/recipes/2", headers=auth_headers).json()  # 두부 계란부침
    checklist = {c["name"]: c for c in detail["checklist"]}
    assert checklist["두부"]["owned"] is True
    assert checklist["계란"]["owned"] is False
    assert checklist["대파"]["owned_substitutes"] == ["양파"]
    assert len(detail["steps"]) == 3


def test_recipe_not_found(client, auth_headers):
    assert client.get(f"{API}/recipes/9999", headers=auth_headers).status_code == 404


def test_todo_endpoints_return_501(client, auth_headers):
    """구현 전 TODO 엔드포인트는 501. 구현하면 이 테스트를 실제 테스트로 교체할 것."""
    assert client.get(f"{API}/recipes/recommendations", headers=auth_headers).status_code == 501
    assert client.post(f"{API}/recipes/1/complete", headers=auth_headers).status_code == 501


def test_home(client, auth_headers):
    client.post(f"{API}/ingredients", json={"name": "두부"}, headers=auth_headers)
    body = client.get(f"{API}/home", headers=auth_headers).json()
    assert body["fridge"] == {"total": 1, "imminent": 0}
    assert body["level"]["title"] == "자취 새내기"


def test_stats_and_badges(client, auth_headers):
    stats = client.get(f"{API}/gamification/stats", headers=auth_headers).json()
    assert stats["level"] == 1 and stats["next_level_xp"] == 100
    badges = client.get(f"{API}/gamification/badges", headers=auth_headers).json()
    assert badges["total_count"] == 6 and badges["acquired_count"] == 0
