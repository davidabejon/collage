from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import or_
from sqlmodel import Session, select

from .db import get_session
from .models import Book, BookCollaborator, Item, User

SessionDep = Annotated[Session, Depends(get_session)]


def get_owned_book(session: Session, user: User, book_id: int) -> Book:
    shared = select(BookCollaborator.book_id).where(BookCollaborator.user_id == user.id)
    book = session.exec(select(Book).where(Book.id == book_id, or_(Book.owner_id == user.id, Book.id.in_(shared)))).first()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Libro no encontrado")
    return book


def get_owned_item(session: Session, user: User, item_id: int) -> Item:
    shared = select(BookCollaborator.book_id).where(BookCollaborator.user_id == user.id)
    item = session.exec(
        select(Item).join(Book).where(Item.id == item_id, or_(Book.owner_id == user.id, Book.id.in_(shared)))
    ).first()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Elemento no encontrado")
    return item
