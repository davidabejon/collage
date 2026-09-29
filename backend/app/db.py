from collections.abc import Iterator

from sqlalchemy import event, inspect, text
from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db() -> None:
    from . import models  # noqa: F401  (registers tables)

    SQLModel.metadata.create_all(engine)
    if engine.dialect.name == "sqlite":
        book_columns = {column["name"] for column in inspect(engine).get_columns("book")}
        with engine.begin() as connection:
            for name in ("cover_image_path", "cover_thumb_path"):
                if name not in book_columns:
                    connection.execute(text(f"ALTER TABLE book ADD COLUMN {name} VARCHAR"))
        columns = {column["name"] for column in inspect(engine).get_columns("item")}
        with engine.begin() as connection:
            for name in ("span_columns", "span_rows"):
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE item ADD COLUMN {name} INTEGER NOT NULL DEFAULT 1"))
            for name, default in (("focal_x", 0.5), ("focal_y", 0.5), ("photo_zoom", 1)):
                if name not in columns:
                    connection.execute(text(f"ALTER TABLE item ADD COLUMN {name} REAL NOT NULL DEFAULT {default}"))
            if "caption_align" not in columns:
                connection.execute(text("ALTER TABLE item ADD COLUMN caption_align VARCHAR(6) NOT NULL DEFAULT 'center'"))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
