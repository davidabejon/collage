from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, model_validator
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
    storage_backend: Literal["local", "b2"] = "local"
    backblaze_key_id: str = ""
    backblaze_application_key: SecretStr = SecretStr("")
    backblaze_bucket: str = ""
    backblaze_endpoint: str = ""

    @model_validator(mode="after")
    def _check_backblaze(self) -> "Settings":
        if self.storage_backend == "b2":
            missing = [
                name
                for name in ("backblaze_key_id", "backblaze_bucket", "backblaze_endpoint")
                if not getattr(self, name)
            ]
            if not self.backblaze_application_key.get_secret_value():
                missing.append("backblaze_application_key")
            if missing:
                raise ValueError(f"STORAGE_BACKEND=b2 requiere: {', '.join(n.upper() for n in missing)}")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
