import io
import logging
import uuid
import warnings
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import or_
from sqlmodel import Session, select

from ..config import get_settings
from ..models import Book, Item

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "MPO"}
FULL_MAX_SIDE = 2400
THUMB_MAX_SIDE = 800
Image.MAX_IMAGE_PIXELS = 60_000_000
B2_PREFIX = "b2://"

logger = logging.getLogger(__name__)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Imagen no encontrada")


def _media_root() -> Path:
    root = get_settings().media_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _local_path(rel_path: str) -> Path:
    root = _media_root()
    path = (root / rel_path).resolve()
    if not path.is_relative_to(root):
        raise _not_found()
    return path


@lru_cache
def _cached_b2_client(key_id: str, application_key: str, endpoint: str):
    host = urlparse(endpoint).hostname or ""
    parts = host.split(".")
    region = parts[1] if len(parts) > 2 and parts[0] == "s3" else "us-east-1"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=key_id,
        aws_secret_access_key=application_key,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
    )


def _b2_client():
    s = get_settings()
    return _cached_b2_client(s.backblaze_key_id, s.backblaze_application_key.get_secret_value(), s.backblaze_endpoint)


def _b2_location(ref: str) -> tuple[str, str]:
    bucket, _, key = ref.removeprefix(B2_PREFIX).partition("/")
    if not key or bucket != get_settings().backblaze_bucket:
        raise _not_found()
    return bucket, key


def _save(key: str, data: bytes) -> str:
    """Stores data under key in the configured backend and returns the reference to persist."""
    settings = get_settings()
    if settings.storage_backend == "b2":
        _b2_client().put_object(Bucket=settings.backblaze_bucket, Key=key, Body=data, ContentType="image/webp")
        return f"{B2_PREFIX}{settings.backblaze_bucket}/{key}"
    path = _local_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def read_media(ref: str) -> bytes:
    if ref.startswith(B2_PREFIX):
        bucket, key = _b2_location(ref)
        try:
            return _b2_client().get_object(Bucket=bucket, Key=key)["Body"].read()
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("NoSuchKey", "404"):
                raise _not_found() from None
            raise
    path = _local_path(ref)
    if not path.is_file():
        raise _not_found()
    return path.read_bytes()


def _delete(ref: str) -> None:
    if ref.startswith(B2_PREFIX):
        try:
            bucket, key = _b2_location(ref)
            client = _b2_client()
            # B2 keeps versions: a plain delete only hides the file, so remove every version.
            listing = client.list_object_versions(Bucket=bucket, Prefix=key)
            for version in listing.get("Versions", []) + listing.get("DeleteMarkers", []):
                if version["Key"] == key:
                    client.delete_object(Bucket=bucket, Key=key, VersionId=version["VersionId"])
        except (HTTPException, ClientError, BotoCoreError):
            logger.exception("No se pudo borrar %s de Backblaze", ref)
        return
    try:
        _local_path(ref).unlink(missing_ok=True)
    except HTTPException:
        pass


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


def _encode_webp(img: Image.Image, max_side: int, quality: int) -> bytes:
    copy = img.copy()
    copy.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    # Re-encoding without passing exif/info strips all metadata (GPS, camera...).
    copy.save(buf, "WEBP", quality=quality, method=4)
    return buf.getvalue()


def _save_pair(user_id: int, full: bytes, thumb: bytes) -> tuple[str, str]:
    name = uuid.uuid4().hex
    full_ref = _save(f"{user_id}/{name}.webp", full)
    try:
        thumb_ref = _save(f"{user_id}/{name}_thumb.webp", thumb)
    except Exception:
        _delete(full_ref)
        raise
    return full_ref, thumb_ref


async def store_image(upload: UploadFile, user_id: int) -> tuple[str, str]:
    """Validates and stores an upload, returning the (full, thumb) references to persist."""
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await _read_limited(upload, limit)
    img = _normalize(_open_validated(data))
    full = _encode_webp(img, FULL_MAX_SIDE, quality=88)
    thumb = _encode_webp(img, THUMB_MAX_SIDE, quality=80)
    return await run_in_threadpool(_save_pair, user_id, full, thumb)


def delete_media(*refs: str | None) -> None:
    for ref in refs:
        if ref:
            _delete(ref)


def delete_unreferenced(session: Session, *refs: str | None) -> None:
    """Deletes stored files that no item or book cover references anymore. Call after committing."""
    for ref in {r for r in refs if r}:
        in_items = session.exec(
            select(Item.id).where(or_(Item.image_path == ref, Item.thumb_path == ref)).limit(1)
        ).first()
        in_covers = session.exec(
            select(Book.id).where(or_(Book.cover_image_path == ref, Book.cover_thumb_path == ref)).limit(1)
        ).first()
        if in_items is None and in_covers is None:
            _delete(ref)
