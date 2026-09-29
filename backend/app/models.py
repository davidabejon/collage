from datetime import UTC, datetime

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, max_length=32)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)

    books: list["Book"] = Relationship(
        back_populates="owner", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class Book(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    title: str = Field(max_length=80)
    bg_color: str = "#f5efe3"
    text_color: str = "#2b2622"
    cover_color: str = "#8c3b2e"
    cover_image_path: str | None = None
    cover_thumb_path: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    owner: User = Relationship(back_populates="books")
    items: list["Item"] = Relationship(
        back_populates="book",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "Item.position"},
    )

class BookCollaborator(SQLModel, table=True):
    book_id: int = Field(foreign_key="book.id", primary_key=True, ondelete="CASCADE")
    user_id: int = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")


class Item(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    book_id: int = Field(foreign_key="book.id", index=True, ondelete="CASCADE")
    type: str = Field(max_length=8)  # "photo" | "note"
    position: int = 0
    span_columns: int = Field(default=1, ge=1, le=50)
    span_rows: int = Field(default=1, ge=1, le=50)
    focal_x: float = Field(default=0.5, ge=0, le=1)
    focal_y: float = Field(default=0.5, ge=0, le=1)
    photo_zoom: float = Field(default=1, ge=1, le=4)
    caption_align: str = Field(default="center", max_length=6)
    image_path: str | None = None
    thumb_path: str | None = None
    caption: str = Field(default="", max_length=140)
    text: str = Field(default="", max_length=500)
    note_color: str = "#fff176"
    created_at: datetime = Field(default_factory=utcnow)

    book: Book = Relationship(back_populates="items")
