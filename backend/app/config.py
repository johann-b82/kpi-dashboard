"""Pydantic v2 BaseSettings for KPI Light API (Phase 28).

Centralizes all Phase 28 auth configuration. `DEX_CLIENT_SECRET` uses
`validation_alias="DEX_KPI_SECRET"` so we read Phase 27's env var directly
without a rename (D-01).
"""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, case_sensitive=True, extra="ignore")

    # Dex OIDC client config (D-04)
    DEX_ISSUER: str = "https://auth.internal/dex"
    DEX_CLIENT_ID: str = "kpi-light"
    DEX_CLIENT_SECRET: str = Field(default="", validation_alias="DEX_KPI_SECRET")
    DEX_REDIRECT_URI: str = "https://kpi.internal/api/auth/callback"

    # SessionMiddleware signing key (D-01)
    SESSION_SECRET: str = ""

    # Dev-only OIDC bypass (D-13..D-16)
    DISABLE_AUTH: bool = False


settings = Settings()
