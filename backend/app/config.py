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

    # CORS (origines séparées par des virgules) : URL du frontend Next.js
    cors_origins: str = "http://localhost:3000"
    # URL publique du frontend (redirections Stripe, liens emails)
    frontend_url: str = "http://localhost:3000"

    # Postgres Supabase (Project Settings → Database → Connection string, mode « Session »).
    # Accepte postgresql://… : le driver async est ajouté automatiquement.
    database_url: str = ""

    # Supabase Auth / Admin API
    supabase_url: str | None = None
    supabase_anon_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_ANON_KEY", "SUPABASE_KEY"),
    )
    supabase_service_role_key: str | None = None

    # IA
    openai_api_key: str | None = None
    openai_ocr_model: str = "gpt-4o"
    openai_grade_model: str = "gpt-4o-mini"

    # Stripe
    stripe_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("STRIPE_SECRET_KEY", "STRIPE_KEY"),
    )
    stripe_webhook_secret: str | None = None
    stripe_price_advanced_quarterly: str | None = None
    stripe_price_mastery_quarterly: str | None = None
    stripe_price_establishment_quarterly: str | None = None

    # HubSpot CRM (formulaire de contact)
    hubspot_access_token: str | None = None
    hubspot_role_property: str = "fonction"
    hubspot_subject_property: str = "sujet"
    hubspot_message_property: str = "message"
    hubspot_lead_status_property: str = "hs_lead_status"
    hubspot_lead_status_value: str = "NEW"

    # SMTP (email de confirmation du formulaire de contact) — noms SMTP_* ou MAIL_* acceptés
    smtp_host: str | None = Field(default=None, validation_alias=AliasChoices("SMTP_HOST", "MAIL_HOST"))
    smtp_port: int | None = Field(default=None, validation_alias=AliasChoices("SMTP_PORT", "MAIL_PORT"))
    smtp_user: str | None = Field(default=None, validation_alias=AliasChoices("SMTP_USER", "MAIL_USERNAME"))
    smtp_password: str | None = Field(default=None, validation_alias=AliasChoices("SMTP_PASS", "MAIL_PASSWORD"))
    smtp_from: str | None = None
    mail_from_name: str | None = None
    mail_encryption: str | None = None  # ssl | tls
    smtp_reply_to: str = "contact@correxia.fr"

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, v):
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return bool(v)

    @property
    def async_database_url(self) -> str:
        url = self.database_url.strip()
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url

    @field_validator("smtp_port", mode="before")
    @classmethod
    def parse_port(cls, v):
        return None if v in (None, "") else v

    @property
    def smtp_sender(self) -> str | None:
        if self.smtp_from:
            return self.smtp_from
        if self.mail_from_name and self.smtp_user:
            return f"{self.mail_from_name} <{self.smtp_user}>"
        return None

    def cors_origin_list(self) -> list[str]:
        """
        Origines autorisées. Le navigateur envoie « https://site.app » (sans / final ni chemin) et la
        comparaison est exacte : on tolère donc les saisies courantes « https://site.app/ » ou entre guillemets.
        """
        origins = []
        for raw in self.cors_origins.split(","):
            origin = raw.strip().strip("\"'").strip().rstrip("/")
            if origin:
                origins.append(origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
