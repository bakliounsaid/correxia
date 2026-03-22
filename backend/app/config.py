from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "CORREXIA API"
    debug: bool = False

    supabase_url: str | None = None
    supabase_key: str | None = None

    anthropic_api_key: str | None = None

    upload_max_size_mb: int = 50
    upload_allowed_extensions: str = "pdf,docx,txt"

    cors_origins: str = "http://localhost:3000"

    database_url: str = (
        "postgresql+psycopg_async://postgres:postgres@localhost:5432/correxia"
    )
    secret_key: str = "dev-secret-change-in-production-min-32-chars!!"
    access_token_expire_minutes: int = 60 * 24 * 7

    # Stripe : STRIPE_KEY + STRIPE_LINK (lien de retour success) — alias anciens noms acceptés
    stripe_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("STRIPE_KEY", "STRIPE_SECRET_KEY"),
    )
    stripe_success_url: str = Field(
        default="http://localhost:3000/dashboard?checkout=success",
        validation_alias=AliasChoices("STRIPE_LINK", "STRIPE_SUCCESS_URL"),
    )
    stripe_cancel_url: str = "http://localhost:3000/dashboard?checkout=cancel"
    stripe_webhook_secret: str | None = None
    stripe_price_advanced_quarterly: str | None = None
    stripe_price_mastery_quarterly: str | None = None
    stripe_price_establishment_quarterly: str | None = None

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return bool(v)

    def upload_extensions_list(self) -> list[str]:
        return [
            x.strip().lower().lstrip(".")
            for x in self.upload_allowed_extensions.split(",")
            if x.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
