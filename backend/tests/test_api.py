from pathlib import Path

from conftest import png_bytes, register
from fastapi.testclient import TestClient

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


def test_other_users_cannot_access(client: TestClient) -> None:
    register(client, "ana")
    book = client.post("/api/books", json={"title": "Privado"}).json()
    photo = client.post(
        f"/api/books/{book['id']}/photos", files=[("files", ("a.png", png_bytes(), "image/png"))]
    ).json()[0]
    client.post("/api/auth/logout")

    register(client, "eva")
    assert client.get(f"/api/books/{book['id']}").status_code == 404
    assert client.patch(f"/api/books/{book['id']}", json={"title": "x"}).status_code == 404
    assert client.delete(f"/api/books/{book['id']}").status_code == 404
    assert client.get(f"/api/media/{photo['id']}").status_code == 404
    assert client.patch(f"/api/items/{photo['id']}", json={"caption": "x"}).status_code == 404
    assert client.delete(f"/api/items/{photo['id']}").status_code == 404


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
