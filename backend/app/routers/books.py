from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlmodel import select

from ..deps import SessionDep, get_owned_book
from ..models import Book, Item, utcnow
from ..schemas import BookCreate, BookDetail, BookSummary, BookUpdate, ItemOut, NoteCreate, OrderUpdate
from ..security import CurrentUser
from ..services.media import delete_media, store_image

router = APIRouter(prefix="/api/books", tags=["books"])

MAX_FILES_PER_UPLOAD = 20


def _next_position(session: SessionDep, book_id: int) -> int:
    current = session.exec(select(func.max(Item.position)).where(Item.book_id == book_id)).one()
    return (current if current is not None else -1) + 1


@router.get("", response_model=list[BookSummary])
def list_books(user: CurrentUser, session: SessionDep) -> list[BookSummary]:
    rows = session.exec(
        select(Book, func.count(Item.id))
        .join(Item, isouter=True)
        .where(Book.owner_id == user.id)
        .group_by(Book.id)
        .order_by(Book.updated_at.desc())  # type: ignore[attr-defined]
    ).all()
    return [BookSummary.model_validate(book).model_copy(update={"item_count": count}) for book, count in rows]


@router.post("", response_model=BookSummary, status_code=status.HTTP_201_CREATED)
def create_book(data: BookCreate, user: CurrentUser, session: SessionDep) -> Book:
    book = Book(owner_id=user.id, title=data.title, cover_color=data.cover_color)
    session.add(book)
    session.commit()
    session.refresh(book)
    return book


@router.get("/{book_id}", response_model=BookDetail)
def get_book(book_id: int, user: CurrentUser, session: SessionDep) -> BookDetail:
    book = get_owned_book(session, user, book_id)
    items = [ItemOut.model_validate(i) for i in book.items]
    return BookDetail.model_validate({**BookSummary.model_validate(book).model_dump(), "items": items, "item_count": len(items)})


@router.patch("/{book_id}", response_model=BookSummary)
def update_book(book_id: int, data: BookUpdate, user: CurrentUser, session: SessionDep) -> Book:
    book = get_owned_book(session, user, book_id)
    for key, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(book, key, value)
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    session.refresh(book)
    return book


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, user: CurrentUser, session: SessionDep) -> None:
    book = get_owned_book(session, user, book_id)
    paths = [p for item in book.items for p in (item.image_path, item.thumb_path)]
    session.delete(book)
    session.commit()
    delete_media(*paths)


@router.post("/{book_id}/photos", response_model=list[ItemOut], status_code=status.HTTP_201_CREATED)
async def upload_photos(
    book_id: int, user: CurrentUser, session: SessionDep, files: list[UploadFile] = File(...)
) -> list[Item]:
    book = get_owned_book(session, user, book_id)
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se ha enviado ninguna imagen")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Máximo {MAX_FILES_PER_UPLOAD} imágenes por subida"
        )
    assert user.id is not None and book.id is not None

    stored: list[tuple[str, str]] = []
    try:
        for upload in files:
            stored.append(await store_image(upload, user.id))
    except HTTPException:
        delete_media(*(p for pair in stored for p in pair))
        raise

    position = _next_position(session, book.id)
    items = [
        Item(book_id=book.id, type="photo", position=position + i, image_path=full, thumb_path=thumb)
        for i, (full, thumb) in enumerate(stored)
    ]
    session.add_all(items)
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    for item in items:
        session.refresh(item)
    return items


@router.post("/{book_id}/notes", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_note(book_id: int, data: NoteCreate, user: CurrentUser, session: SessionDep) -> Item:
    book = get_owned_book(session, user, book_id)
    assert book.id is not None
    item = Item(
        book_id=book.id,
        type="note",
        position=_next_position(session, book.id),
        text=data.text,
        note_color=data.note_color,
    )
    session.add(item)
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    session.refresh(item)
    return item


@router.put("/{book_id}/order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_items(book_id: int, data: OrderUpdate, user: CurrentUser, session: SessionDep) -> None:
    book = get_owned_book(session, user, book_id)
    by_id = {item.id: item for item in book.items}
    if len(data.item_ids) != len(by_id) or set(data.item_ids) != set(by_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La lista debe contener exactamente los elementos del libro"
        )
    for position, item_id in enumerate(data.item_ids):
        by_id[item_id].position = position
        session.add(by_id[item_id])
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
