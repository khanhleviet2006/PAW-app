from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def uid() -> str:
    return str(uuid4())


def now() -> datetime:
    return datetime.now(UTC)


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def iso(value: datetime | None) -> str | None:
    return utc(value).isoformat() if value else None


def database(settings):
    url = settings.database_url
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False, "timeout": 15}
        if ":memory:" in url:
            kwargs["poolclass"] = StaticPool
    else:
        kwargs.update(
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_timeout=settings.db_pool_timeout,
            pool_recycle=settings.db_pool_recycle,
            connect_args={"connect_timeout": settings.db_connect_timeout},
        )
    engine = create_engine(url, pool_pre_ping=True, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def pragmas(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    return engine, sessionmaker(engine, expire_on_commit=False)


@lru_cache(maxsize=1)
def schema_head():
    return ScriptDirectory(
        str(Path(__file__).resolve().parents[1] / "migrations")
    ).get_current_head()


def schema_current(connection):
    return MigrationContext.configure(connection).get_current_revision() == schema_head()
