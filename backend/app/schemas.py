from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Username = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_.-]+$")
]


class Credentials(BaseModel):
    username: Username
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str


class BookCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    cover_color: HexColor = "#8c3b2e"
    collaborator_username: Username | None = None


class CollaboratorAdd(BaseModel):
    username: Username


class BookUpdate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    bg_color: HexColor | None = None
    text_color: HexColor | None = None
    cover_color: HexColor | None = None


class BookSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    bg_color: str
    text_color: str
    cover_color: str
    created_at: datetime
    updated_at: datetime
    item_count: int = 0
    owner_id: int
    owner_username: str
    collaborators: list[UserOut] = []


class ItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    type: Literal["photo", "note"]
    position: int
    caption: str
    text: str
    note_color: str


class BookDetail(BookSummary):
    items: list[ItemOut]


class NoteCreate(BaseModel):
    text: str = Field(default="", max_length=500)
    note_color: HexColor = "#fff176"


class ItemUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=140)
    text: str | None = Field(default=None, max_length=500)
    note_color: HexColor | None = None


class OrderUpdate(BaseModel):
    item_ids: list[int] = Field(max_length=5000)
