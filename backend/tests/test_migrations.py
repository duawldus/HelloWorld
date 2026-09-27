"""마이그레이션이 모델과 맞는지, 옛 DB(Alembic 도입 전)를 데이터 그대로 올리는지 확인한다."""

from datetime import date

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text

from app.common.db import Base
from app.migrate import run_migrations


def _engine(tmp_path):
    return create_engine(f"sqlite:///{tmp_path / 'test.db'}")


def test_migrations_match_models(tmp_path):
    # 모델을 바꾸고 마이그레이션 파일을 안 만들면 여기서 실패한다
    engine = _engine(tmp_path)
    run_migrations(engine)
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == []


def test_legacy_db_is_stamped_and_upgraded_keeping_data(tmp_path):
    engine = _engine(tmp_path)
    run_migrations(engine, "0001")
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE alembic_version"))  # Alembic 도입 전 create_all 로 만든 DB 흉내
        conn.execute(
            text(
                "INSERT INTO users (id, device_id, nickname, onboarded, xp, level, current_streak, best_streak,"
                " created_at, updated_at) VALUES (1, 'old-device-01', '자취생', 1, 30, 1, 0, 0, :t, :t)"
            ),
            {"t": "2026-09-01 00:00:00"},
        )
        conn.execute(
            text(
                "INSERT INTO reminders (user_id, category, title, repeat_type, interval, weekdays, remind_time,"
                " notify_before_days, anchor_date, enabled, last_done_at, created_at, updated_at)"
                " VALUES (1, 'LAUNDRY', '빨래', 'DAILY', 1, '[]', '20:00:00', 0, '2026-09-01', 1, :done, :t, :t)"
            ),
            {"done": "2026-09-27 21:00:00.000000", "t": "2026-09-01 00:00:00"},
        )

    run_migrations(engine)

    with engine.connect() as conn:
        assert conn.scalar(text("SELECT xp FROM users WHERE device_id = 'old-device-01'")) == 30
        assert conn.scalar(text("SELECT last_done_due FROM reminders")) == date(2026, 9, 27).isoformat()
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "0002"
