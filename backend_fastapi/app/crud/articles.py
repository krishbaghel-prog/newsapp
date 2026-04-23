from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.article import Article


def upsert_article_from_item(db: Session, it: dict) -> Article:
    url = it["url"]
    pub = it.get("publishedAt")
    if isinstance(pub, str):
        published_at = datetime.fromisoformat(pub.replace("Z", "+00:00"))
    elif isinstance(pub, datetime):
        published_at = pub
    else:
        published_at = datetime.now(timezone.utc)

    row = db.execute(select(Article).where(Article.url == url)).scalar_one_or_none()
    if row is None:
        row = Article(
            title=it["title"],
            summary=it.get("summary") or "",
            image=it.get("image") or "",
            category=it.get("category") or "all",
            source=it.get("source") or "",
            url=url,
            published_at=published_at,
            provider=it.get("provider") or "external",
        )
        db.add(row)
        return row

    row.title = it.get("title") or row.title
    row.summary = it.get("summary") or row.summary
    row.image = it.get("image") or row.image
    row.category = it.get("category") or row.category
    row.source = it.get("source") or row.source
    row.published_at = published_at
    row.provider = it.get("provider") or row.provider
    return row


def article_to_item(a: Article) -> dict:
    return {
        "title": a.title,
        "summary": a.summary,
        "image": a.image or "",
        "category": a.category,
        "source": a.source,
        "url": a.url,
        "publishedAt": a.published_at.isoformat(),
        "provider": a.provider,
        "id": str(a.id),
    }
