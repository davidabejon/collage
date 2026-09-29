from contextlib import asynccontextmanager

from fastapi import FastAPI

from .config import DEFAULT_SECRET, get_settings
from .db import init_db
from .routers import auth, books, items


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    if settings.cookie_secure and settings.secret_key == DEFAULT_SECRET:
        raise RuntimeError("Define SECRET_KEY en el entorno antes de desplegar")
    init_db()
    yield


app = FastAPI(title="Collage API", lifespan=lifespan)


@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    return response


app.include_router(auth.router)
app.include_router(books.router)
app.include_router(items.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
