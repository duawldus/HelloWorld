import os

# 앱 import 전에 설정: 테스트가 로컬 bangguseok.db 를 건드리지 않도록
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["SCHEDULER_ENABLED"] = "false"
os.environ["AI_MOCK"] = "true"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: E402, F401
from app.common.db import Base, get_db
from app.main import app
from app.seeds import seed_all

# 테스트마다 새 인메모리 DB
engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def db():
    Base.metadata.create_all(engine)
    session = TestingSession()
    seed_all(session)
    yield session
    session.close()
    Base.metadata.drop_all(engine)


@pytest.fixture()
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client) -> dict[str, str]:
    res = client.post("/api/v1/auth/guest", json={"device_id": "test-device-0001"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
