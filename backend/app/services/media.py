import io
import uuid
import warnings
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import get_settings

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}
FULL_MAX_SIDE = 2400
THUMB_MAX_SIDE = 800
Image.MAX_IMAGE_PIXELS = 60_000_000


def _media_root() -> Path:
    root = get_settings().media_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


async def _read_limited(upload: UploadFile, limit: int) -> bytes:
    buf = io.BytesIO()
    while chunk := await upload.read(1024 * 1024):
        buf.write(chunk)
        if buf.tell() > limit:
            raise HTTPException(
                status_code=413,
                detail=f"La imagen supera el máximo de {limit // (1024 * 1024)} MB",
            )
    return buf.getvalue()


def _open_validated(data: bytes) -> Image.Image:
    invalid = HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Formato de imagen no válido")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            probe = Image.open(io.BytesIO(data))
            if probe.format not in ALLOWED_FORMATS:
                raise invalid
            probe.verify()
            img = Image.open(io.BytesIO(data))
            img.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, Image.DecompressionBombWarning, OSError, SyntaxError):
        raise invalid from None
    return img


def _normalize(img: Image.Image) -> Image.Image:
    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    return img.convert("RGBA" if has_alpha else "RGB")


def _save_webp(img: Image.Image, max_side: int, path: Path, quality: int) -> None:
    copy = img.copy()
    copy.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    # Re-encoding without passing exif/info strips all metadata (GPS, camera...).
    copy.save(path, "WEBP", quality=quality, method=4)


async def store_image(upload: UploadFile, user_id: int) -> tuple[str, str]:
    """Validates and stores an upload, returning (full_path, thumb_path) relative to the media root."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await _read_limited(upload, limit)
    img = _normalize(_open_validated(data))

    user_dir = _media_root() / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    name = uuid.uuid4().hex
    full_rel, thumb_rel = f"{user_id}/{name}.webp", f"{user_id}/{name}_thumb.webp"
    _save_webp(img, FULL_MAX_SIDE, _media_root() / full_rel, quality=88)
    _save_webp(img, THUMB_MAX_SIDE, _media_root() / thumb_rel, quality=80)
    return full_rel, thumb_rel


def resolve_media(rel_path: str) -> Path:
    root = _media_root()
    path = (root / rel_path).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")
    return path


def delete_media(*rel_paths: str | None) -> None:
    root = _media_root()
    for rel in rel_paths:
        if not rel:
            continue
        path = (root / rel).resolve()
        if path.is_relative_to(root):
            path.unlink(missing_ok=True)
