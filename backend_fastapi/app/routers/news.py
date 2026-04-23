from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Query
from sqlalchemy import func, select

from app.crud.articles import article_to_item
from app.deps import DbDep, SettingsDep
from app.models.article import Article
from app.services.news_providers import normalize_category
from app.services.news_refresh import (
    count_articles,
    prepare_category_cache,
    refresh_category_cached,
)

router = APIRouter(prefix="/news", tags=["news"])


@router.get("")
async def list_news(
    db: DbDep,
    settings: SettingsDep,
    background_tasks: BackgroundTasks,
    category: str = Query("all"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    source: str = Query("all"),
):
    """
    Serve articles **from Postgres only**. Upstream news APIs run at most once per TTL (or on first empty load),
    never once per user request fan-out.
    """
    cat = normalize_category(category)
    src = (source or "all").lower()
    skip = (page - 1) * limit

    # Legacy param: external|db|all — all paths read the same cached DB table now.
    if src not in ("external", "db", "all"):
        raise HTTPException(status_code=400, detail="Invalid source")

    await prepare_category_cache(
        db,
        settings,
        cat,
        background_tasks,
        ttl_seconds=settings.news_cache_ttl_seconds,
        batch_size=settings.news_fetch_batch_size,
    )

    stmt = select(Article)
    if cat != "all":
        stmt = stmt.where(Article.category == cat)
    stmt = stmt.order_by(Article.published_at.desc()).offset(skip).limit(limit)
    rows = list(db.execute(stmt).scalars().all())
    items = [article_to_item(a) for a in rows]

    db.commit()

    if not items and count_articles(db, cat) == 0:
        raise HTTPException(
            status_code=503,
            detail="No cached news yet. Configure provider keys in server .env or try again after refresh.",
        )

    return {"page": page, "limit": limit, "category": cat, "items": items}


@router.post("/refresh")
async def manual_refresh(
    db: DbDep,
    settings: SettingsDep,
    category: str = Query("all"),
    x_refresh_secret: Annotated[Optional[str], Header(alias="X-Refresh-Secret")] = None,
):
    """
    Force one upstream fetch into Postgres (ops/cron). Requires REFRESH_SECRET and matching header.
    Never exposes API keys in the response.
    """
    if not settings.refresh_secret:
        raise HTTPException(
            status_code=503,
            detail="Manual refresh disabled. Set REFRESH_SECRET in the server environment.",
        )
    if not x_refresh_secret or x_refresh_secret != settings.refresh_secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Refresh-Secret header.")

    cat = normalize_category(category)
    await refresh_category_cached(
        db,
        settings,
        cat,
        batch_size=settings.news_fetch_batch_size,
    )
    db.commit()
    return {"ok": True, "category": cat, "cached": True}


@router.get("/notify")
def news_notify(db: DbDep, since: str = Query(...)):
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid since")

    count = db.execute(select(func.count()).select_from(Article).where(Article.created_at > since_dt)).scalar()
    count = int(count or 0)

    latest = db.execute(select(Article.created_at).order_by(Article.created_at.desc()).limit(1)).scalar_one_or_none()

    return {
        "hasNew": count > 0,
        "count": count,
        "latestCreatedAt": latest.isoformat() if isinstance(latest, datetime) else None,
    }


@router.get("/changes")
def news_changes(db: DbDep, since: str = Query(...)):
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid since")

    count = db.execute(select(func.count()).select_from(Article).where(Article.created_at > since_dt)).scalar()
    count = int(count or 0)

    latest = db.execute(select(Article.created_at).order_by(Article.created_at.desc()).limit(1)).scalar_one_or_none()

    return {"count": count, "latestCreatedAt": latest.isoformat() if isinstance(latest, datetime) else None}
