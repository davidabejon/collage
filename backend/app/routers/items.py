from typing import Literal

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from ..deps import SessionDep, get_owned_item
from ..models import Item, utcnow
from ..schemas import ItemOut, ItemUpdate
from ..security import CurrentUser
from ..services.media import delete_media, resolve_media

router = APIRouter(prefix="/api", tags=["items"])


@router.patch("/items/{item_id}", response_model=ItemOut)
def update_item(item_id: int, data: ItemUpdate, user: CurrentUser, session: SessionDep) -> Item:
    item = get_owned_item(session, user, item_id)
    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if item.type == "photo":
        changes = {k: v for k, v in changes.items() if k in ("caption", "caption_align", "span_columns", "span_rows", "focal_x", "focal_y", "photo_zoom")}
    else:
        changes.pop("caption", None)
        changes.pop("caption_align", None)
        changes.pop("focal_x", None)
        changes.pop("focal_y", None)
        changes.pop("photo_zoom", None)
    for key, value in changes.items():
        setattr(item, key, value)
    item.book.updated_at = utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: CurrentUser, session: SessionDep) -> None:
    item = get_owned_item(session, user, item_id)
    paths = (item.image_path, item.thumb_path)
    item.book.updated_at = utcnow()
    session.delete(item)
    session.commit()
    delete_media(*paths)


@router.get("/media/{item_id}")
def get_media(
    item_id: int, user: CurrentUser, session: SessionDep, size: Literal["thumb", "full"] = "thumb"
) -> FileResponse:
    item = get_owned_item(session, user, item_id)
    rel = item.thumb_path if size == "thumb" else item.image_path
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")
    return FileResponse(
        resolve_media(rel),
        media_type="image/webp",
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
