from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class NewsCacheState(Base):
    """Tracks last successful news fetch per category (Postgres cache layer; keys never stored here)."""

    __tablename__ = "news_cache_state"

    category: Mapped[str] = mapped_column(String(32), primary_key=True)
    last_fetch_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
