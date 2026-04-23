"""Refresh external news into Postgres once per TTL; never log API keys."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.crud.articles import upsert_article_from_item
from app.models.article import Article
from app.models.news_cache_state import NewsCacheState
from app.services.news_providers import fetch_external_news, normalize_category

if TYPE_CHECKING:
    from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)

_category_locks: dict[str, asyncio.Lock] = {}


def _lock_for(category: str) -> asyncio.Lock:
    if category not in _category_locks:
        _category_locks[category] = asyncio.Lock()
    return _category_locks[category]


def count_articles(db: Session, category: str) -> int:
    cat = normalize_category(category)
    stmt = select(func.count()).select_from(Article)
    if cat != "all":
        stmt = stmt.where(Article.category == cat)
    return int(db.execute(stmt).scalar() or 0)


def is_cache_stale(db: Session, category: str, ttl_seconds: int) -> bool:
    cat = normalize_category(category)
    row = db.get(NewsCacheState, cat)
    if row is None:
        return True
    age = (datetime.now(timezone.utc) - row.last_fetch_at).total_seconds()
    return age > ttl_seconds


async def _fetch_and_upsert(db: Session, settings: Settings, category: str, batch_size: int) -> None:
    cat = normalize_category(category)
    raw = await fetch_external_news(category=cat, page=1, page_size=batch_size, settings=settings)

    for it in raw:
        upsert_article_from_item(db, it)

    now = datetime.now(timezone.utc)
    row = db.get(NewsCacheState, cat)
    if row is None:
        db.add(NewsCacheState(category=cat, last_fetch_at=now, last_error=None))
    else:
        row.last_fetch_at = now
        row.last_error = None


async def refresh_category_cached(
    db: Session,
    settings: Settings,
    category: str,
    *,
    batch_size: int,
) -> None:
    """Calls upstream news APIs once, upserts articles, updates cache row. Caller must commit."""
    cat = normalize_category(category)
    async with _lock_for(cat):
        try:
            await _fetch_and_upsert(db, settings, cat, batch_size)
        except Exception:
            logger.exception("News refresh failed for category=%s", cat)
            now = datetime.now(timezone.utc)
            row = db.get(NewsCacheState, cat)
            err_note = "Upstream fetch failed (check server logs). Keys are never logged."
            if row is None:
                db.add(NewsCacheState(category=cat, last_fetch_at=now, last_error=err_note))
            else:
                row.last_fetch_at = now
                row.last_error = err_note[:2000]
            raise


async def prepare_category_cache(
    db: Session,
    settings: Settings,
    category: str,
    background_tasks: Optional["BackgroundTasks"],
    *,
    ttl_seconds: int,
    batch_size: int,
) -> None:
    """
    Serve-path helper: if empty, block until first fetch; if stale, schedule background refresh.
    User responses should always read from Postgres only.
    """
    cat = normalize_category(category)
    empty = count_articles(db, cat) == 0
    stale = is_cache_stale(db, cat, ttl_seconds)

    if empty:
        await refresh_category_cached(db, settings, cat, batch_size=batch_size)
        return

    if stale and background_tasks is not None:

        async def _job():
            from app.config import get_settings
            from app.database import SessionLocal

            session = SessionLocal()
            try:
                await refresh_category_cached(
                    session,
                    get_settings(),
                    cat,
                    batch_size=batch_size,
                )
                session.commit()
            except Exception:
                session.rollback()
            finally:
                session.close()

        background_tasks.add_task(_job)
