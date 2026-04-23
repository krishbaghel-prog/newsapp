from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.crud.articles import article_to_item
from app.deps import DbDep, SettingsDep
from app.models.article import Article
from app.services.ai_client import ai_chat
from app.services.clustering import group_by_story_key, story_key
from app.services.news_providers import normalize_category
from app.services.news_refresh import prepare_category_cache
from app.utils.json_util import parse_json_loose

router = APIRouter(prefix="/stories", tags=["stories"])


async def _merged_from_cache(
    db: DbDep,
    settings: SettingsDep,
    category: str,
    background_tasks: BackgroundTasks,
    *,
    page_size: int = 40,
) -> list[dict]:
    cat = normalize_category(category)

    await prepare_category_cache(
        db,
        settings,
        cat,
        background_tasks,
        ttl_seconds=settings.news_cache_ttl_seconds,
        batch_size=max(page_size, settings.news_fetch_batch_size),
    )

    if cat == "all":
        stmt = select(Article).order_by(Article.published_at.desc()).limit(min(80, max(30, page_size)))
    else:
        stmt = (
            select(Article)
            .where(Article.category == cat)
            .order_by(Article.published_at.desc())
            .limit(min(80, max(30, page_size)))
        )

    db_rows = list(db.execute(stmt).scalars().all())
    merged_map: dict[str, dict] = {}
    for a in db_rows:
        merged_map[a.url] = article_to_item(a)

    out = sorted(merged_map.values(), key=lambda x: x.get("publishedAt") or "", reverse=True)
    db.commit()
    return out


@router.get("")
async def list_story_clusters(
    db: DbDep,
    settings: SettingsDep,
    background_tasks: BackgroundTasks,
    category: str = Query("all"),
    min_size: int = Query(2, ge=2, le=10),
):
    merged = await _merged_from_cache(db, settings, category, background_tasks)
    grouped = group_by_story_key(merged)

    items: list[dict[str, Any]] = []
    for key, arts in grouped.items():
        if len(arts) < min_size:
            continue
        arts_sorted = sorted(arts, key=lambda x: x.get("publishedAt") or "", reverse=True)
        headline = arts_sorted[0].get("title") or key
        items.append(
            {
                "story_key": key,
                "headline": headline,
                "sources_count": len(arts_sorted),
                "sources": sorted(
                    {str(a.get("source") or "").strip() for a in arts_sorted if a.get("source")},
                    key=lambda s: s.lower(),
                ),
                "articles": arts_sorted[:12],
            }
        )

    items.sort(key=lambda x: (x.get("sources_count") or 0), reverse=True)
    return {"category": normalize_category(category), "items": items}


class AnalyzeBody(BaseModel):
    story_key: str = Field(min_length=1)
    category: str = "all"


@router.post("/analyze")
async def analyze_story(body: AnalyzeBody, db: DbDep, settings: SettingsDep, background_tasks: BackgroundTasks):
    merged = await _merged_from_cache(db, settings, body.category, background_tasks, page_size=60)
    grouped = group_by_story_key(merged)
    arts = grouped.get(body.story_key)
    if not arts:
        raise HTTPException(status_code=404, detail="Story cluster not found for this category. Try refreshing news first.")

    system = (
        "You compare multiple news reports about the same developing story. "
        "You cannot know absolute truth; infer agreement vs disagreement from the excerpts. "
        "Respond ONLY with valid JSON using this schema: "
        "{ "
        '"overview": string, '
        '"agreements": [string], '
        '"disagreements": [string], '
        '"citations": [{ "url": string, "title": string, "source": string, "note": string }]'
        " }. "
        "Every factual claim in overview must be traceable to citations URLs provided. "
        "Use short bullet strings. If only one source, say so."
    )

    ctx_lines: list[str] = []
    for i, a in enumerate(sorted(arts, key=lambda x: x.get("publishedAt") or "", reverse=True)[:15], start=1):
        ctx_lines.append(
            "\n".join(
                [
                    f"#{i}",
                    f"title: {a.get('title')}",
                    f"summary: {a.get('summary')}",
                    f"source: {a.get('source')}",
                    f"url: {a.get('url')}",
                ]
            )
        )

    user_msg = f"STORY_KEY: {body.story_key}\n\nARTICLES:\n\n" + "\n\n".join(ctx_lines)

    try:
        answer, provider_used = await ai_chat(
            settings=settings,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
            temperature=0.2,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    parsed: dict[str, Any] = parse_json_loose(answer) or {}
    return {
        "story_key": body.story_key,
        "provider": provider_used,
        "model_json": parsed,
        "raw": answer,
        "articles": sorted(arts, key=lambda x: x.get("publishedAt") or "", reverse=True)[:15],
    }


@router.get("/lookup")
async def lookup_story_key(
    db: DbDep,
    settings: SettingsDep,
    background_tasks: BackgroundTasks,
    title: str = Query(..., min_length=3),
    category: str = Query("all"),
):
    key = story_key(title)
    merged = await _merged_from_cache(db, settings, category, background_tasks)
    grouped = group_by_story_key(merged)
    arts = grouped.get(key)
    if not arts:
        return {"story_key": key, "found": False, "articles": []}
    return {"story_key": key, "found": True, "articles": sorted(arts, key=lambda x: x.get("publishedAt") or "", reverse=True)[:20]}
