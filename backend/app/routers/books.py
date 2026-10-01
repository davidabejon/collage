from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import func, or_
from sqlmodel import select

from ..deps import SessionDep, get_owned_book
from ..models import Book, BookCollaborator, Item, User, utcnow
from ..schemas import BookCreate, BookDetail, BookSummary, BookUpdate, CollaboratorAdd, ItemOut, NoteCreate, OrderUpdate, UserOut
from ..security import CurrentUser
from ..services.media import delete_media, delete_unreferenced, read_media, store_image

router = APIRouter(prefix="/api/books", tags=["books"])

MAX_FILES_PER_UPLOAD = 20


def _next_position(session: SessionDep, book_id: int) -> int:
    current = session.exec(select(func.max(Item.position)).where(Item.book_id == book_id)).one()
    return (current if current is not None else -1) + 1


def _summary(session: SessionDep, book: Book, item_count: int = 0) -> BookSummary:
    collaborators = session.exec(
        select(User).join(BookCollaborator, BookCollaborator.user_id == User.id).where(BookCollaborator.book_id == book.id)
    ).all()
    return BookSummary.model_validate({
        **book.model_dump(), "item_count": item_count, "owner_username": book.owner.username,
        "cover_image": book.cover_image_path is not None,
        "collaborators": [UserOut.model_validate(member) for member in collaborators],
    })


def _find_collaborator(session: SessionDep, username: str, owner_id: int) -> User:
    user = session.exec(select(User).where(func.lower(User.username) == username.lower())).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.id == owner_id:
        raise HTTPException(status_code=400, detail="El dueño ya tiene acceso al libro")
    return user


@router.get("", response_model=list[BookSummary])
def list_books(user: CurrentUser, session: SessionDep) -> list[BookSummary]:
    shared = select(BookCollaborator.book_id).where(BookCollaborator.user_id == user.id)
    rows = session.exec(
        select(Book, func.count(Item.id))
        .join(Item, isouter=True)
        .where(or_(Book.owner_id == user.id, Book.id.in_(shared)))
        .group_by(Book.id)
        .order_by(Book.updated_at.desc())  # type: ignore[attr-defined]
    ).all()
    return [_summary(session, book, count) for book, count in rows]


@router.post("", response_model=BookSummary, status_code=status.HTTP_201_CREATED)
def create_book(data: BookCreate, user: CurrentUser, session: SessionDep) -> BookSummary:
    collaborator = _find_collaborator(session, data.collaborator_username, user.id) if data.collaborator_username else None
    book = Book(owner_id=user.id, title=data.title, cover_color=data.cover_color)
    session.add(book)
    session.flush()
    if collaborator:
        session.add(BookCollaborator(book_id=book.id, user_id=collaborator.id))
    session.commit()
    session.refresh(book)
    return _summary(session, book)


@router.post("/{book_id}/collaborators", response_model=BookSummary)
def add_collaborator(book_id: int, data: CollaboratorAdd, user: CurrentUser, session: SessionDep) -> BookSummary:
    book = get_owned_book(session, user, book_id)
    collaborator = _find_collaborator(session, data.username, book.owner_id)
    existing = session.get(BookCollaborator, (book_id, collaborator.id))
    if existing:
        raise HTTPException(status_code=409, detail="Este usuario ya comparte el libro")
    session.add(BookCollaborator(book_id=book_id, user_id=collaborator.id))
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    return _summary(session, book, len(book.items))


@router.get("/{book_id}", response_model=BookDetail)
def get_book(book_id: int, user: CurrentUser, session: SessionDep) -> BookDetail:
    book = get_owned_book(session, user, book_id)
    items = [ItemOut.model_validate(i) for i in book.items]
    return BookDetail.model_validate({**_summary(session, book, len(items)).model_dump(), "items": items})


@router.patch("/{book_id}", response_model=BookSummary)
def update_book(book_id: int, data: BookUpdate, user: CurrentUser, session: SessionDep) -> BookSummary:
    book = get_owned_book(session, user, book_id)
    for key, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(book, key, value)
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    session.refresh(book)
    return _summary(session, book, len(book.items))


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_book(book_id: int, user: CurrentUser, session: SessionDep) -> None:
    book = get_owned_book(session, user, book_id)
    if book.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Solo el dueño puede eliminar el libro")
    paths = [p for item in book.items for p in (item.image_path, item.thumb_path)]
    paths.extend((book.cover_image_path, book.cover_thumb_path))
    for member in session.exec(select(BookCollaborator).where(BookCollaborator.book_id == book_id)).all():
        session.delete(member)
    session.delete(book)
    session.commit()
    delete_unreferenced(session, *paths)


def _save_cover(session: SessionDep, book: Book, new_paths: tuple[str, str]) -> BookSummary:
    old_paths = (book.cover_image_path, book.cover_thumb_path)
    book.cover_image_path, book.cover_thumb_path = new_paths
    book.updated_at = utcnow()
    session.add(book)
    try:
        session.commit()
        session.refresh(book)
    except Exception:
        session.rollback()
        delete_unreferenced(session, *new_paths)
        raise
    delete_unreferenced(session, *old_paths)
    return _summary(session, book, len(book.items))


@router.post("/{book_id}/cover", response_model=BookSummary)
async def upload_cover(
    book_id: int, user: CurrentUser, session: SessionDep, file: UploadFile = File(...)
) -> BookSummary:
    book = get_owned_book(session, user, book_id)
    assert user.id is not None
    new_paths = await store_image(file, user.id)
    return _save_cover(session, book, new_paths)


@router.post("/{book_id}/cover/from-item/{item_id}", response_model=BookSummary)
def use_album_photo_as_cover(book_id: int, item_id: int, user: CurrentUser, session: SessionDep) -> BookSummary:
    book = get_owned_book(session, user, book_id)
    photo = next((item for item in book.items if item.id == item_id and item.type == "photo"), None)
    if photo is None or not photo.image_path or not photo.thumb_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada en este libro")
    return _save_cover(session, book, (photo.image_path, photo.thumb_path))


@router.delete("/{book_id}/cover", response_model=BookSummary)
def remove_cover(book_id: int, user: CurrentUser, session: SessionDep) -> BookSummary:
    book = get_owned_book(session, user, book_id)
    old_paths = (book.cover_image_path, book.cover_thumb_path)
    book.cover_image_path = None
    book.cover_thumb_path = None
    book.updated_at = utcnow()
    session.add(book)
    session.commit()
    session.refresh(book)
    delete_unreferenced(session, *old_paths)
    return _summary(session, book, len(book.items))


@router.get("/{book_id}/cover")
def get_cover(
    book_id: int, user: CurrentUser, session: SessionDep, size: str = "thumb"
) -> Response:
    if size not in ("thumb", "full"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tamaño no válido")
    book = get_owned_book(session, user, book_id)
    rel = book.cover_thumb_path if size == "thumb" else book.cover_image_path
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portada no encontrada")
    return Response(
        read_media(rel),
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )


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
