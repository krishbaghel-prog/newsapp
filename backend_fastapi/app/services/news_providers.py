import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.config import Settings

_Cache: dict[str, tuple[float, list[dict]]] = {}
_TTL = 60.0

import time  # noqa: E402


def _now() -> float:
    return time.time()


def _get_cache(key: str) -> Optional[list[dict]]:
    hit = _Cache.get(key)
    if not hit:
        return None
    ts, data = hit
    if _now() - ts > _TTL:
        _Cache.pop(key, None)
        return None
    return data


def _set_cache(key: str, data: list[dict]) -> None:
    _Cache[key] = (_now(), data)


def normalize_category(category: str) -> str:
    c = (category or "all").lower()
    if c in ("all", "technology", "business", "sports", "war"):
        return c
    return "all"


def _clamp_words(text: str, lo: int, hi: int) -> str:
    t = re.sub(r"\s+", " ", (text or "")).strip()
    if not t:
        return ""
    words = t.split(" ")
    if len(words) <= hi:
        return t
    return " ".join(words[:hi]) + "…"


def pick_providers(settings: Settings) -> list[str]:
    out: list[str] = []
    if settings.newsapi_key:
        out.append("newsapi")
    if settings.gnews_key:
        out.append("gnews")
    if settings.currents_api_key:
        out.append("currents")
    if settings.mediastack_key:
        out.append("mediastack")
    out.append("inshorts")
    return out


def news_api_category(category: str) -> dict[str, str]:
    if category == "technology":
        return {"category": "technology"}
    if category == "business":
        return {"category": "business"}
    if category == "sports":
        return {"category": "sports"}
    if category == "war":
        return {"q": "war OR conflict OR ukraine OR gaza"}
    return {}


def gnews_category(category: str) -> dict[str, str]:
    if category == "technology":
        return {"topic": "technology"}
    if category == "business":
        return {"topic": "business"}
    if category == "sports":
        return {"topic": "sports"}
    if category == "war":
        return {"q": "war OR conflict OR ukraine OR gaza"}
    return {}


def inshorts_category(category: str) -> str:
    if category == "technology":
        return "technology"
    if category == "business":
        return "business"
    if category == "sports":
        return "sports"
    if category == "war":
        return "world"
    return "all"


async def fetch_from_newsapi(
    *,
    category: str,
    page: int,
    page_size: int,
    settings: Settings,
) -> list[dict]:
    key_cache = f"newsapi:{category}:{page}:{page_size}"
    hit = _get_cache(key_cache)
    if hit is not None:
        return hit

    api_key = settings.newsapi_key
    if not api_key:
        return []

    c = normalize_category(category)
    mapped = news_api_category(c)
    params: dict[str, Any] = {
        "apiKey": api_key,
        "language": "en",
        "page": page,
        "pageSize": page_size,
        **mapped,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("https://newsapi.org/v2/top-headlines", params=params)
        res.raise_for_status()
        data = res.json()

    articles = data.get("articles") if isinstance(data, dict) else None
    articles = articles if isinstance(articles, list) else []

    out: list[dict] = []
    for a in articles:
        if not a or not a.get("url") or not a.get("title"):
            continue
        text = a.get("content") or a.get("description") or ""
        summary = _clamp_words(text or (a.get("description") or ""), 50, 70)
        pub = a.get("publishedAt")
        published_at = (
            datetime.fromisoformat(pub.replace("Z", "+00:00"))
            if isinstance(pub, str)
            else datetime.now(timezone.utc)
        )
        src = (a.get("source") or {}) if isinstance(a.get("source"), dict) else {}
        out.append(
            {
                "title": a["title"],
                "summary": summary,
                "image": a.get("urlToImage") or "",
                "category": c,
                "source": src.get("name") or "",
                "url": a["url"],
                "publishedAt": published_at,
                "provider": "external",
            }
        )

    _set_cache(key_cache, out)
    return out


async def fetch_from_gnews(
    *,
    category: str,
    page: int,
    page_size: int,
    settings: Settings,
) -> list[dict]:
    key_cache = f"gnews:{category}:{page}:{page_size}"
    hit = _get_cache(key_cache)
    if hit is not None:
        return hit

    api_key = settings.gnews_key
    if not api_key:
        return []

    c = normalize_category(category)
    mapped = gnews_category(c)
    params: dict[str, Any] = {
        "token": api_key,
        "lang": "en",
        "max": page_size,
        "page": page,
        **mapped,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("https://gnews.io/api/v4/top-headlines", params=params)
        res.raise_for_status()
        data = res.json()

    articles = data.get("articles") if isinstance(data, dict) else None
    articles = articles if isinstance(articles, list) else []

    out: list[dict] = []
    for a in articles:
        if not a or not a.get("url") or not a.get("title"):
            continue
        text = a.get("content") or a.get("description") or ""
        summary = _clamp_words(text or (a.get("description") or ""), 50, 70)
        pub = a.get("publishedAt")
        published_at = (
            datetime.fromisoformat(str(pub).replace("Z", "+00:00"))
            if pub
            else datetime.now(timezone.utc)
        )
        out.append(
            {
                "title": a["title"],
                "summary": summary,
                "image": a.get("image") or "",
                "category": c,
                "source": (a.get("source") or {}).get("name") if isinstance(a.get("source"), dict) else "",
                "url": a["url"],
                "publishedAt": published_at,
                "provider": "external",
            }
        )

    _set_cache(key_cache, out)
    return out


async def fetch_from_inshorts(*, category: str, page_size: int) -> list[dict]:
    c = normalize_category(category)
    cat = inshorts_category(c)
    key_cache = f"inshorts:{cat}:{page_size}"
    hit = _get_cache(key_cache)
    if hit is not None:
        return hit

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            "https://inshortsapi.vercel.app/news",
            params={"category": cat},
        )
        res.raise_for_status()
        data = res.json()

    rows = data.get("data") if isinstance(data, dict) else None
    rows = rows if isinstance(rows, list) else []

    out: list[dict] = []
    for a in rows[:page_size]:
        if not a or not a.get("readMoreUrl") or not a.get("title"):
            continue
        text = a.get("content") or ""
        summary = _clamp_words(text, 50, 70)
        dt = a.get("date")
        published_at = datetime.now(timezone.utc)
        if isinstance(dt, str):
            try:
                published_at = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except ValueError:
                published_at = datetime.now(timezone.utc)

        source = a.get("author") or a.get("source") or "Inshorts"
        out.append(
            {
                "title": a["title"],
                "summary": summary,
                "image": a.get("imageUrl") or "",
                "category": c,
                "source": str(source),
                "url": a["readMoreUrl"],
                "publishedAt": published_at,
                "provider": "external",
            }
        )

    _set_cache(key_cache, out)
    return out


async def fetch_from_currents(*, category: str, page_size: int, settings: Settings) -> list[dict]:
    api_key = settings.currents_api_key
    if not api_key:
        return []

    c = normalize_category(category)
    key_cache = f"currents:{c}:{page_size}"
    hit = _get_cache(key_cache)
    if hit is not None:
        return hit

    params: dict[str, Any] = {
        "apiKey": api_key,
        "language": "en",
        "page_size": max(1, min(50, page_size)),
    }
    if c == "technology":
        params["category"] = "technology"
    elif c == "business":
        params["category"] = "business"
    elif c == "sports":
        params["category"] = "sports"
    elif c == "war":
        params["keywords"] = "war OR conflict OR ukraine OR gaza"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("https://api.currentsapi.services/v1/latest-news", params=params)
        res.raise_for_status()
        data = res.json()

    news = data.get("news") if isinstance(data, dict) else None
    news = news if isinstance(news, list) else []

    out: list[dict] = []
    for a in news[:page_size]:
        if not a or not a.get("url") or not a.get("title"):
            continue
        desc = a.get("description") or ""
        summary = _clamp_words(desc, 50, 70)
        pub = a.get("published")
        published_at = (
            datetime.fromisoformat(str(pub).replace("Z", "+00:00"))
            if pub
            else datetime.now(timezone.utc)
        )
        out.append(
            {
                "title": a["title"],
                "summary": summary,
                "image": a.get("image") or "",
                "category": c,
                "source": str(a.get("author") or ""),
                "url": a["url"],
                "publishedAt": published_at,
                "provider": "external",
            }
        )

    _set_cache(key_cache, out)
    return out


async def fetch_from_mediastack(
    *,
    category: str,
    page: int,
    page_size: int,
    settings: Settings,
) -> list[dict]:
    access_key = settings.mediastack_key
    if not access_key:
        return []

    c = normalize_category(category)
    key_cache = f"mediastack:{c}:{page}:{page_size}"
    hit = _get_cache(key_cache)
    if hit is not None:
        return hit

    params: dict[str, Any] = {
        "access_key": access_key,
        "languages": "en",
        "limit": max(1, min(100, page_size)),
        "offset": (max(1, page) - 1) * page_size,
    }
    if c != "all":
        params["categories"] = "general" if c == "war" else c

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get("http://api.mediastack.com/v1/news", params=params)
        res.raise_for_status()
        data = res.json()

    rows = data.get("data") if isinstance(data, dict) else None
    rows = rows if isinstance(rows, list) else []

    out: list[dict] = []
    for a in rows:
        if not a or not a.get("url") or not a.get("title"):
            continue
        desc = a.get("description") or ""
        summary = _clamp_words(desc, 50, 70)
        pub = a.get("published_at")
        published_at = (
            datetime.fromisoformat(str(pub).replace("Z", "+00:00"))
            if pub
            else datetime.now(timezone.utc)
        )
        out.append(
            {
                "title": a["title"],
                "summary": summary,
                "image": a.get("image") or "",
                "category": c,
                "source": str(a.get("source") or ""),
                "url": a["url"],
                "publishedAt": published_at,
                "provider": "external",
            }
        )

    _set_cache(key_cache, out)
    return out


async def fetch_external_news(
    *,
    category: str,
    page: int,
    page_size: int,
    settings: Settings,
) -> list[dict]:
    providers = pick_providers(settings)
    tasks: list[list[dict]] = []

    for p in providers:
        try:
            if p == "newsapi" and settings.newsapi_key:
                tasks.append(await fetch_from_newsapi(category=category, page=page, page_size=page_size, settings=settings))
            elif p == "gnews" and settings.gnews_key:
                tasks.append(await fetch_from_gnews(category=category, page=page, page_size=page_size, settings=settings))
            elif p == "currents" and settings.currents_api_key:
                tasks.append(await fetch_from_currents(category=category, page_size=page_size, settings=settings))
            elif p == "mediastack" and settings.mediastack_key:
                tasks.append(await fetch_from_mediastack(category=category, page=page, page_size=page_size, settings=settings))
            elif p == "inshorts":
                tasks.append(await fetch_from_inshorts(category=category, page_size=page_size))
            else:
                tasks.append([])
        except Exception:
            tasks.append([])

    all_rows = [row for batch in tasks for row in batch]
    if not all_rows:
        raise RuntimeError(
            "No news provider returned results. Configure NEWSAPI_KEY/GNEWS_KEY/CURRENTS_API_KEY/MEDIASTACK_KEY "
            "or rely on Inshorts."
        )
    return all_rows
