from pathlib import Path

from conftest import png_bytes, register
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlmodel import create_engine

from app import db
from app.config import get_settings


def test_register_login_me_logout(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401
    register(client)
    assert client.get("/api/auth/me").json()["username"] == "ana"
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"username": "ana", "password": "incorrecta"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "ANA", "password": "secreto123"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_duplicate_and_weak_password(client: TestClient) -> None:
    register(client)
    assert client.post("/api/auth/register", json={"username": "ana", "password": "otraclave1"}).status_code == 409
    assert client.post("/api/auth/register", json={"username": "bob", "password": "corta"}).status_code == 422


def test_login_rate_limit(client: TestClient) -> None:
    register(client)
    client.post("/api/auth/logout")
    codes = [
        client.post("/api/auth/login", json={"username": "ana", "password": "incorrecta"}).status_code
        for _ in range(11)
    ]
    assert codes[-1] == 429


def test_tampered_token_rejected(client: TestClient) -> None:
    register(client)
    client.cookies.set(get_settings().cookie_name, "not-a-jwt")
    assert client.get("/api/auth/me").status_code == 401


def test_book_crud_and_colors(client: TestClient) -> None:
    register(client)
    book = client.post("/api/books", json={"title": "Verano"}).json()
    res = client.patch(f"/api/books/{book['id']}", json={"bg_color": "#112233", "text_color": "#ffffff"})
    assert res.json()["bg_color"] == "#112233"
    assert client.patch(f"/api/books/{book['id']}", json={"bg_color": "red"}).status_code == 422
    assert [b["title"] for b in client.get("/api/books").json()] == ["Verano"]
    assert client.delete(f"/api/books/{book['id']}").status_code == 204
    assert client.get("/api/books").json() == []


def test_book_cover_upload_replace_and_delete(client: TestClient) -> None:
    register(client)
    book = client.post("/api/books", json={"title": "Portada"}).json()
    cover_url = f"/api/books/{book['id']}/cover"

    uploaded = client.post(cover_url, files={"file": ("cover.png", png_bytes(), "image/png")})
    assert uploaded.status_code == 200
    assert uploaded.json()["cover_image"] is True
    assert client.get("/api/books").json()[0]["cover_image"] is True
    first_image = client.get(cover_url)
    assert first_image.status_code == 200
    assert first_image.headers["content-type"] == "image/webp"

    replaced = client.post(
        cover_url, files={"file": ("replacement.png", png_bytes((32, 32)), "image/png")}
    )
    assert replaced.status_code == 200
    assert client.get(cover_url).content != first_image.content
    assert len(list(Path(get_settings().media_dir).rglob("*.webp"))) == 2

    removed = client.delete(cover_url)
    assert removed.status_code == 200
    assert removed.json()["cover_image"] is False
    assert client.get(cover_url).status_code == 404
    assert list(Path(get_settings().media_dir).rglob("*.webp")) == []

    assert client.delete(f"/api/books/{book['id']}").status_code == 204
    assert list(Path(get_settings().media_dir).rglob("*.webp")) == []


def test_book_cover_can_use_photo_from_same_album(client: TestClient) -> None:
    register(client)
    book = client.post("/api/books", json={"title": "Recuerdos"}).json()
    photo = client.post(
        f"/api/books/{book['id']}/photos", files=[("files", ("photo.png", png_bytes(), "image/png"))]
    ).json()[0]
    original = client.get(f"/api/media/{photo['id']}?size=full").content

    selected = client.post(f"/api/books/{book['id']}/cover/from-item/{photo['id']}")
    assert selected.status_code == 200
    assert selected.json()["cover_image"] is True
    assert client.get(f"/api/books/{book['id']}/cover?size=full").content == original

    assert client.delete(f"/api/items/{photo['id']}").status_code == 204
    assert client.get(f"/api/books/{book['id']}/cover?size=full").content == original
    assert client.post(f"/api/books/{book['id']}/cover/from-item/{photo['id']}").status_code == 404


def test_book_cover_cannot_use_photo_from_another_album(client: TestClient) -> None:
    register(client)
    first = client.post("/api/books", json={"title": "Uno"}).json()
    second = client.post("/api/books", json={"title": "Dos"}).json()
    photo = client.post(
        f"/api/books/{first['id']}/photos", files=[("files", ("photo.png", png_bytes(), "image/png"))]
    ).json()[0]
    result = client.post(f"/api/books/{second['id']}/cover/from-item/{photo['id']}")
    assert result.status_code == 404


def test_other_users_cannot_access(client: TestClient) -> None:
    register(client, "ana")
    book = client.post("/api/books", json={"title": "Privado"}).json()
    client.post(
        f"/api/books/{book['id']}/cover", files={"file": ("cover.png", png_bytes(), "image/png")}
    )
    photo = client.post(
        f"/api/books/{book['id']}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    client.post("/api/auth/logout")

    register(client, "eva")
    assert client.get(f"/api/books/{book['id']}").status_code == 404
    assert client.get(f"/api/books/{book['id']}/cover").status_code == 404
    assert client.patch(f"/api/books/{book['id']}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/api/books/{book['id']}").status_code == 404
    assert client.get(f"/api/media/{photo['id']}").status_code == 404
    assert client.patch(f"/api/items/{photo['id']}", json={"caption": "x"}).status_code == 404
    assert client.delete(f"/api/items/{photo['id']}").status_code == 404


def test_create_shared_book_and_owner_only_delete(client: TestClient) -> None:
    register(client, "eva")
    client.post("/api/auth/logout")
    register(client, "ana")
    missing = client.post("/api/books", json={"title": "X", "collaborator_username": "nadie"})
    assert missing.status_code == 404
    assert client.get("/api/books").json() == []
    book = client.post("/api/books", json={"title": "Juntos", "collaborator_username": "EVA"}).json()
    bid = book["id"]
    assert book["owner_username"] == "ana"
    assert [member["username"] for member in book["collaborators"]] == ["eva"]
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "eva", "password": "secreto123"})
    assert [entry["id"] for entry in client.get("/api/books").json()] == [bid]
    assert client.patch(f"/api/books/{bid}", json={"title": "Nuestro"}).status_code == 200
    photo = client.post(
        f"/api/books/{bid}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    assert client.get(f"/api/media/{photo['id']}").status_code == 200
    assert client.patch(f"/api/items/{photo['id']}", json={"caption": "Juntos"}).status_code == 200
    assert client.post(f"/api/books/{bid}/notes", json={"text": "Hola"}).status_code == 201
    ids = [item["id"] for item in client.get(f"/api/books/{bid}").json()["items"]]
    assert client.put(f"/api/books/{bid}/order", json={"item_ids": ids[::-1]}).status_code == 204
    assert client.delete(f"/api/items/{photo['id']}").status_code == 204
    assert client.delete(f"/api/books/{bid}").status_code == 403
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "ana", "password": "secreto123"})
    assert client.get(f"/api/books/{bid}").json()["title"] == "Nuestro"
    assert client.delete(f"/api/books/{bid}").status_code == 204
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "eva", "password": "secreto123"})
    assert client.get("/api/books").json() == []


def test_add_collaborators_to_existing_book(client: TestClient) -> None:
    register(client, "ana")
    bid = client.post("/api/books", json={"title": "Viaje"}).json()["id"]
    assert client.post(f"/api/books/{bid}/collaborators", json={"username": "ana"}).status_code == 400
    assert client.post(f"/api/books/{bid}/collaborators", json={"username": "desconocido"}).status_code == 404
    client.post("/api/auth/logout")
    register(client, "eva")
    assert client.post(f"/api/books/{bid}/collaborators", json={"username": "eva"}).status_code == 404
    client.post("/api/auth/logout")
    register(client, "leo")
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "ana", "password": "secreto123"})
    assert client.post(f"/api/books/{bid}/collaborators", json={"username": "eva"}).status_code == 200
    assert client.post(f"/api/books/{bid}/collaborators", json={"username": "EVA"}).status_code == 409
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "eva", "password": "secreto123"})
    result = client.post(f"/api/books/{bid}/collaborators", json={"username": "leo"})
    assert result.status_code == 200
    assert {member["username"] for member in result.json()["collaborators"]} == {"eva", "leo"}
    client.post("/api/auth/logout")
    client.post("/api/auth/login", json={"username": "leo", "password": "secreto123"})
    assert client.get(f"/api/books/{bid}").status_code == 200


def test_upload_notes_reorder_and_cascade(client: TestClient) -> None:
    register(client)
    book = client.post("/api/books", json={"title": "Viaje"}).json()
    bid = book["id"]

    photos = client.post(
        f"/api/books/{bid}/photos",
        files=[("files", ("a.png", png_bytes(), "image/png")), ("files", ("b.png", png_bytes((3000, 100)), "image/png"))],
    )
    assert photos.status_code == 201
    note = client.post(f"/api/books/{bid}/notes", json={"text": "¡Hola!", "note_color": "#ffcc80"}).json()

    media = client.get(f"/api/media/{photos.json()[0]['id']}?size=full")
    assert media.status_code == 200 and media.headers["content-type"] == "image/webp"

    ids = [i["id"] for i in client.get(f"/api/books/{bid}").json()["items"]]
    assert ids[-1] == note["id"]
    new_order = list(reversed(ids))
    assert client.put(f"/api/books/{bid}/order", json={"item_ids": new_order}).status_code == 204
    assert [i["id"] for i in client.get(f"/api/books/{bid}").json()["items"]] == new_order
    assert client.put(f"/api/books/{bid}/order", json={"item_ids": [*new_order, 999]}).status_code == 400
    assert client.put(f"/api/books/{bid}/order", json={"item_ids": new_order[:1]}).status_code == 400

    caption = client.patch(f"/api/items/{photos.json()[0]['id']}", json={"caption": "Playa", "text": "ignorado"}).json()
    assert caption["caption"] == "Playa" and caption["text"] == ""

    media_dir = Path(get_settings().media_dir)
    assert len(list(media_dir.rglob("*.webp"))) == 4
    assert client.delete(f"/api/items/{photos.json()[0]['id']}").status_code == 204
    assert len(list(media_dir.rglob("*.webp"))) == 2
    assert client.delete(f"/api/books/{bid}").status_code == 204
    assert list(media_dir.rglob("*.webp")) == []


def test_invalid_uploads(client: TestClient) -> None:
    register(client)
    bid = client.post("/api/books", json={"title": "X"}).json()["id"]
    fake = client.post(f"/api/books/{bid}/photos", files=[("files", ("x.jpg", b"not an image", "image/jpeg"))])
    assert fake.status_code == 415

    get_settings().max_upload_mb = 0
    big = client.post(f"/api/books/{bid}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))])
    assert big.status_code == 413
    assert client.get(f"/api/books/{bid}").json()["items"] == []


def test_item_spans_are_persisted_for_photos_and_notes(client: TestClient) -> None:
    register(client)
    book_id = client.post("/api/books", json={"title": "Mosaico"}).json()["id"]
    photo = client.post(
        f"/api/books/{book_id}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    assert (photo["span_columns"], photo["span_rows"]) == (1, 1)
    response = client.patch(f"/api/items/{photo['id']}", json={"span_columns": 4, "span_rows": 2})
    assert response.status_code == 200
    assert (response.json()["span_columns"], response.json()["span_rows"]) == (4, 2)
    assert client.get(f"/api/books/{book_id}").json()["items"][0]["span_columns"] == 4
    assert client.patch(f"/api/items/{photo['id']}", json={"span_columns": 0}).status_code == 422
    assert client.patch(f"/api/items/{photo['id']}", json={"span_rows": 51}).status_code == 422
    note = client.post(f"/api/books/{book_id}/notes", json={"text": "Hola"}).json()
    assert (note["span_columns"], note["span_rows"]) == (1, 1)
    updated = client.patch(f"/api/items/{note['id']}", json={"span_columns": 2, "span_rows": 3})
    assert updated.status_code == 200
    assert (updated.json()["span_columns"], updated.json()["span_rows"]) == (2, 3)
    persisted = {item["id"]: item for item in client.get(f"/api/books/{book_id}").json()["items"]}
    assert (persisted[note["id"]]["span_columns"], persisted[note["id"]]["span_rows"]) == (2, 3)
    assert client.patch(f"/api/items/{note['id']}", json={"span_rows": 0}).status_code == 422


def test_photo_framing_is_persisted_and_restricted_to_photos(client: TestClient) -> None:
    register(client)
    book_id = client.post("/api/books", json={"title": "Encuadre"}).json()["id"]
    photo = client.post(
        f"/api/books/{book_id}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    assert (photo["focal_x"], photo["focal_y"], photo["photo_zoom"]) == (0.5, 0.5, 1)
    updated = client.patch(f"/api/items/{photo['id']}", json={"focal_x": 0.27, "focal_y": 0.83, "photo_zoom": 2.4})
    assert updated.status_code == 200
    assert (updated.json()["focal_x"], updated.json()["focal_y"], updated.json()["photo_zoom"]) == (0.27, 0.83, 2.4)
    assert client.get(f"/api/books/{book_id}").json()["items"][0]["photo_zoom"] == 2.4
    assert client.patch(f"/api/items/{photo['id']}", json={"focal_x": -0.1}).status_code == 422
    assert client.patch(f"/api/items/{photo['id']}", json={"photo_zoom": 5}).status_code == 422
    note = client.post(f"/api/books/{book_id}/notes", json={"text": "Hola"}).json()
    unchanged = client.patch(f"/api/items/{note['id']}", json={"focal_x": 0.1, "photo_zoom": 3}).json()
    assert (unchanged["focal_x"], unchanged["photo_zoom"]) == (0.5, 1)


def test_photo_caption_alignment_is_saved(client: TestClient) -> None:
    register(client)
    book_id = client.post("/api/books", json={"title": "Pies"}).json()["id"]
    photo = client.post(
        f"/api/books/{book_id}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    assert photo["caption_align"] == "center"
    for alignment in ("left", "right", "center"):
        response = client.patch(f"/api/items/{photo['id']}", json={"caption_align": alignment})
        assert response.status_code == 200
        assert response.json()["caption_align"] == alignment
    assert client.patch(f"/api/items/{photo['id']}", json={"caption_align": "justify"}).status_code == 422
    note = client.post(f"/api/books/{book_id}/notes", json={"text": "Nota"}).json()
    assert client.patch(f"/api/items/{note['id']}", json={"caption_align": "right"}).json()["caption_align"] == "center"


def test_existing_sqlite_items_get_default_spans_and_framing(tmp_path: Path, monkeypatch) -> None:
    engine = create_engine(f"sqlite:///{tmp_path / 'previous.db'}")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE book (id INTEGER PRIMARY KEY, owner_id INTEGER, title TEXT, bg_color TEXT, "
            "text_color TEXT, cover_color TEXT, created_at DATETIME, updated_at DATETIME)"
        ))
        connection.execute(text("CREATE TABLE item (id INTEGER PRIMARY KEY, book_id INTEGER, type TEXT, position INTEGER)"))
        connection.execute(text("INSERT INTO item (id, book_id, type, position) VALUES (1, 1, 'photo', 0)"))
    monkeypatch.setattr(db, "engine", engine)
    db.init_db()
    db.init_db()
    assert {column["name"] for column in inspect(engine).get_columns("item")} >= {
        "span_columns", "span_rows", "focal_x", "focal_y", "photo_zoom", "caption_align"
    }
    assert {column["name"] for column in inspect(engine).get_columns("book")} >= {
        "cover_image_path", "cover_thumb_path"
    }
    with engine.connect() as connection:
        assert connection.execute(text("SELECT span_columns, span_rows FROM item WHERE id = 1")).one() == (1, 1)
        assert connection.execute(text("SELECT focal_x, focal_y, photo_zoom FROM item WHERE id = 1")).one() == (0.5, 0.5, 1)
        assert connection.execute(text("SELECT caption_align FROM item WHERE id = 1")).scalar_one() == "center"


def test_replacing_only_photo_does_not_reuse_cached_media_url(client: TestClient) -> None:
    register(client)
    book_id = client.post("/api/books", json={"title": "Fotos"}).json()["id"]
    first = client.post(
        f"/api/books/{book_id}/photos", files=[("files", ("first.png", png_bytes(), "image/png"))]
    ).json()[0]
    first_media = client.get(f"/api/media/{first['id']}")
    assert first_media.headers["cache-control"] == "private, max-age=31536000, immutable"
    assert client.delete(f"/api/items/{first['id']}").status_code == 204

    second = client.post(
        f"/api/books/{book_id}/photos", files=[("files", ("second.png", png_bytes((60, 30)), "image/png"))]
    ).json()[0]
    assert second["id"] == first["id"]
    assert second["created_at"] != first["created_at"]
    assert client.get(f"/api/media/{second['id']}").content != first_media.content
