"""Preserve unavailable measurements as SQL NULL."""
from alembic import op
import sqlalchemy as sa

revision = "12dfcadb8600"
down_revision = "81793dd71919"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("measurements") as batch:
        batch.alter_column("value", existing_type=sa.Float(), nullable=True)


def downgrade():
    if op.get_bind().execute(sa.text("SELECT 1 FROM measurements WHERE value IS NULL LIMIT 1")).first():
        raise RuntimeError("Restore a pre-upgrade backup: existing NULL readings must be preserved.")
    with op.batch_alter_table("measurements") as batch:
        batch.alter_column("value", existing_type=sa.Float(), nullable=False)
