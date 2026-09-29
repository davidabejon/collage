from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlmodel import Session, select

from .db import get_session
from .models import Book, Item, User

SessionDep = Annotated[Session, Depends(get_session)]


def get_owned_book(session: Session, user: User, book_id: int) -> Book:
    book = session.exec(select(Book).where(Book.id == book_id, Book.owner_id == user.id)).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Libro no encontrado")
    return book


def get_owned_item(session: Session, user: User, item_id: int) -> Item:
    item = session.exec(
        select(Item).join(Book).where(Item.id == item_id, Book.owner_id == user.id)
    ).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elemento no encontrado")
    return item
