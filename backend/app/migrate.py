"""서버가 켜질 때 DB를 최신 구조로 올린다 (Alembic). 새 칸·표가 생겨도 DB를 지울 필요가 없다.

모델을 바꿨다면 마이그레이션 파일을 만들어야 한다 → README '마이그레이션' 참고.
"""

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect

from app.common.db import engine as app_engine

logger = logging.getLogger(__name__)

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
BASELINE = "0001"  # Alembic 도입 전 create_all 로 만들던 구조


def run_migrations(engine: Engine = app_engine, revision: str = "head") -> None:
    with engine.begin() as conn:
        cfg = Config(str(ALEMBIC_INI))
        cfg.attributes.update(from_app=True, connection=conn)
        tables = set(inspect(conn).get_table_names())
        if "users" in tables and "alembic_version" not in tables:
            # Alembic 도입 전에 만든 로컬 DB: 이미 0001 구조이므로 표시만 하고 그 다음부터 적용
            logger.info("기존 DB를 마이그레이션 %s 로 표시합니다.", BASELINE)
            command.stamp(cfg, BASELINE)
        command.upgrade(cfg, revision)
