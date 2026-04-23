from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.crud.articles import article_to_item
from app.deps import DbDep, SettingsDep
from app.models.article import Article
from app.services.ai_client import ai_chat
from app.services.news_providers import normalize_category
from app.services.news_refresh import prepare_category_cache
from app.utils.json_util import parse_json_loose

router = APIRouter(prefix="/chat", tags=["chat"])


def _format_articles(articles: list[dict], max_items: int = 12) -> str:
    lines: list[str] = []
    for i, a in enumerate((articles or [])[:max_items], start=1):
        ts = ""
        pub = a.get("publishedAt")
        if hasattr(pub, "isoformat"):
            ts = pub.isoformat()
        elif isinstance(pub, str):
            ts = pub
        lines.append(
            "\n".join(
                [
                    f"#{i}",
                    f"title: {a.get('title') or ''}",
                    f"summary: {a.get('summary') or ''}",
                    f"source: {a.get('source') or ''}",
                    f"url: {a.get('url') or ''}",
                    f"publishedAt: {ts}",
                    f"category: {a.get('category') or ''}",
                ]
            )
        )
    return "\n\n".join(lines)


async def _latest_bundle(
    db: DbDep,
    settings: SettingsDep,
    category: str,
    background_tasks: BackgroundTasks,
) -> tuple[list[dict], list[Article]]:
    cat = normalize_category(category)

    await prepare_category_cache(
        db,
        settings,
        cat,
        background_tasks,
        ttl_seconds=settings.news_cache_ttl_seconds,
        batch_size=settings.news_fetch_batch_size,
    )

    if cat == "all":
        stmt = select(Article).order_by(Article.published_at.desc()).limit(12)
    else:
        stmt = (
            select(Article)
            .where(Article.category == cat)
            .order_by(Article.published_at.desc())
            .limit(12)
        )

    db_rows = list(db.execute(stmt).scalars().all())

    merged_map: dict[str, dict] = {}
    for a in db_rows:
        merged_map[a.url] = article_to_item(a)

    merged = sorted(merged_map.values(), key=lambda x: x.get("publishedAt") or "", reverse=True)[:12]
    db.commit()
    return merged, db_rows


class ChatNewsBody(BaseModel):
    message: str = Field(min_length=1)
    category: str = "all"
    baseline: str = ""
    mode: Literal["latest", "compare"] = "latest"


@router.post("/news")
async def chat_news(
    body: ChatNewsBody,
    db: DbDep,
    settings: SettingsDep,
    background_tasks: BackgroundTasks,
):
    cat = normalize_category(body.category)

    latest, _ = await _latest_bundle(db, settings, cat, background_tasks)

    system = (
        "You are a news assistant. Use the provided 'LATEST_NEWS' context when answering. "
        "If asked for sources, include URLs from the context. "
        "Keep answers concise, structured, and up-to-date. "
        "If information isn't in the context, say so and suggest what to search for."
    )

    context = f"LATEST_NEWS (category={cat}):\n\n{_format_articles(latest)}\n"

    user_msg = (
        f"BASELINE:\n{body.baseline or '(none)'}\n\nREQUEST:\n{body.message}\n\n{context}"
        if body.mode == "compare"
        else f"REQUEST:\n{body.message}\n\n{context}"
    )

    try:
        answer, provider_used = await ai_chat(
            settings=settings,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
            temperature=0.2,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    used = [{"title": x.get("title"), "url": x.get("url"), "source": x.get("source")} for x in latest]

    return {
        "category": cat,
        "provider": provider_used,
        "used": used,
        "answer": answer,
    }


@router.get("/trust-feed")
async def trust_feed(
    db: DbDep,
    settings: SettingsDep,
    background_tasks: BackgroundTasks,
    category: str = Query("all"),
):
    cat = normalize_category(category)

    latest, _ = await _latest_bundle(db, settings, cat, background_tasks)

    if not latest:
        return {
            "category": cat,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "verified": [],
            "caution": [],
        }

    system = (
        "You are a strict fact-checking assistant for a news app. "
        "You MUST compare headlines/summaries across available items, identify likely true points, and mark uncertain claims conservatively. "
        "Respond ONLY in valid JSON with shape: "
        "{ verified: [{ title, reason, confidence, url }], caution: [{ title, reason, confidence, url }] }. "
        "confidence must be one of: high, medium, low. Keep arrays short (max 4 each)."
    )

    context = f"LATEST_NEWS (category={cat}):\n\n{_format_articles(latest)}\n"

    user_msg = (
        "Create a trusted feed for app-open screen.\n"
        "Rule: classify as verified only if corroborated by multiple reputable signals in this context.\n\n"
        f"{context}"
    )

    try:
        answer, provider_used = await ai_chat(
            settings=settings,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
            temperature=0.1,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    parsed: dict[str, Any] = parse_json_loose(answer) or {}
    verified = parsed.get("verified") if isinstance(parsed.get("verified"), list) else []
    caution = parsed.get("caution") if isinstance(parsed.get("caution"), list) else []

    verified = verified[:4]
    caution = caution[:4]

    return {
        "category": cat,
        "provider": provider_used,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "verified": verified,
        "caution": caution,
    }
