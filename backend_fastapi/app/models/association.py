import uuid

from sqlalchemy import ForeignKey, Table, Column
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

user_saved_article = Table(
    "user_saved_article",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("article_id", UUID(as_uuid=True), ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True),
)
