from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET = "dev-only-insecure-secret-change-me-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = DEFAULT_SECRET
    database_url: str = "sqlite:///./collage.db"
    media_dir: Path = Path("./media")
    max_upload_mb: int = 15
    access_token_minutes: int = 60 * 24 * 7
    cookie_secure: bool = False
    cookie_name: str = "collage_session"
    jwt_algorithm: str = "HS256"


@lru_cache
def get_settings() -> Settings:
    return Settings()
