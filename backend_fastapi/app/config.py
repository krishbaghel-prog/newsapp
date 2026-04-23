from functools import lru_cache
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "NewsApp API"
    database_url: str = "postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/newsapp"
    client_origin: str = "http://localhost:5173"

    google_client_id: str = ""

    jwt_secret: str = "change-me-in-production-use-long-random-string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7

    newsapi_key: Optional[str] = None
    gnews_key: Optional[str] = None
    currents_api_key: Optional[str] = None
    mediastack_key: Optional[str] = None

    grok_api_key: Optional[str] = None
    grok_base_url: str = "https://api.x.ai/v1"
    grok_model: str = "grok-2-latest"

    ai_provider: str = "openai"
    ai_fallbacks: str = ""

    openai_api_key: Optional[str] = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4.1-mini"

    anthropic_api_key: Optional[str] = None
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    anthropic_model: str = "claude-3-5-sonnet-latest"

    gemini_api_key: Optional[str] = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-1.5-flash"

    # News cache: fetch upstream once per TTL, serve users from Postgres only (keys stay in .env).
    news_cache_ttl_seconds: int = 900
    news_fetch_batch_size: int = 50
    # Optional: require header X-Refresh-Secret on POST /api/news/refresh for cron/manual warm-up.
    refresh_secret: Optional[str] = None

    @property
    def cors_origins(self) -> List[str]:
        parts = [p.strip() for p in self.client_origin.split(",") if p.strip()]
        return parts or ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
