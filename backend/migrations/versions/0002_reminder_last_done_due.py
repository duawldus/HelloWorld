"""reminders.last_done_due — 마지막으로 완료한 회차('해야 하는 날')

늦게 완료한 집안일이 다음 회차로 잘못 계산되던 문제를 고치면서, 완료한 회차를 따로 저장한다.
기존에 완료 기록이 있는 알림은 완료한 날짜를 회차로 채운다 (매일 알림은 정확, 미리 완료한 경우만 근사치).

Revision ID: 0002
Revises: 0001
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("reminders") as batch_op:
        batch_op.add_column(sa.Column("last_done_due", sa.Date(), nullable=True))
    op.execute("UPDATE reminders SET last_done_due = DATE(last_done_at) WHERE last_done_at IS NOT NULL")


def downgrade() -> None:
    with op.batch_alter_table("reminders") as batch_op:
        batch_op.drop_column("last_done_due")
