"""Alembic 실행 환경. 모델(app.models)과 .env 의 DATABASE_URL 을 기준으로 한다."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

import app.models  # noqa: F401 — 모든 모델을 metadata 에 등록
from app.common.config import settings
from app.common.db import Base

config = context.config
# 서버가 켜질 때(app/migrate.py) 부른 경우엔 앱의 로그 설정을 덮어쓰지 않는다
if config.config_file_name is not None and not config.attributes.get("from_app"):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        render_as_batch=True,  # SQLite 는 ALTER TABLE 이 제한적이라 '새 표로 복사' 방식으로 바꾼다
        compare_type=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    _configure(url=settings.DATABASE_URL, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:  # 테스트 등에서 연결을 직접 넘긴 경우
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = engine_from_config(
        {"sqlalchemy.url": settings.DATABASE_URL}, prefix="sqlalchemy.", poolclass=pool.NullPool
    )
    with engine.connect() as conn:
        _configure(connection=conn)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
