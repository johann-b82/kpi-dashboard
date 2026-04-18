from uuid import UUID

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DIRECTUS_SECRET: str = Field(..., description="Directus JWT signing secret (HS256)")
    DIRECTUS_ADMINISTRATOR_ROLE_UUID: UUID
    DIRECTUS_VIEWER_ROLE_UUID: UUID


settings = Settings()
