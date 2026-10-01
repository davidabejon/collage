import io
from collections.abc import Iterator

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import models  # noqa: F401
from app.config import get_settings
from app.db import get_session
from app.main import app
from app.security import login_limiter
from app.services import media


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch) -> Iterator[None]:
    monkeypatch.setenv("MEDIA_DIR", str(tmp_path / "media"))
    monkeypatch.setenv("STORAGE_BACKEND", "local")
    get_settings.cache_clear()
    login_limiter._attempts.clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)

    def override() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    yield TestClient(app)
    app.dependency_overrides.clear()


def register(client: TestClient, username: str = "ana", password: str = "secreto123") -> None:
    res = client.post("/api/auth/register", json={"username": username, "password": password})
    assert res.status_code == 201, res.text


def png_bytes(size: tuple[int, int] = (40, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 80, 40)).save(buf, "PNG")
    return buf.getvalue()


class FakeB2:
    def __init__(self) -> None:
        self.objects: dict[tuple[str, str], bytes] = {}

    def put_object(self, Bucket: str, Key: str, Body: bytes, ContentType: str) -> None:
        self.objects[(Bucket, Key)] = Body

    def get_object(self, Bucket: str, Key: str) -> dict:
        if (Bucket, Key) not in self.objects:
            raise ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def list_object_versions(self, Bucket: str, Prefix: str) -> dict:
        keys = [key for bucket, key in self.objects if bucket == Bucket and key.startswith(Prefix)]
        return {"Versions": [{"Key": key, "VersionId": f"v-{key}"} for key in keys]}

    def delete_object(self, Bucket: str, Key: str, VersionId: str) -> None:
        assert VersionId == f"v-{Key}"
        self.objects.pop((Bucket, Key), None)


@pytest.fixture
def fake_b2(monkeypatch) -> FakeB2:
    monkeypatch.setenv("STORAGE_BACKEND", "b2")
    monkeypatch.setenv("BACKBLAZE_KEY_ID", "test-key-id")
    monkeypatch.setenv("BACKBLAZE_APPLICATION_KEY", "test-app-key")
    monkeypatch.setenv("BACKBLAZE_BUCKET", "test-bucket")
    monkeypatch.setenv("BACKBLAZE_ENDPOINT", "https://s3.eu-central-003.backblazeb2.com")
    get_settings.cache_clear()
    fake = FakeB2()
    monkeypatch.setattr(media, "_b2_client", lambda: fake)
    return fake
