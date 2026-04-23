from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.crud.articles import article_to_item, upsert_article_from_item
from app.deps import CurrentUserDep, DbDep
from app.models.article import Article
from app.models.user import User

router = APIRouter(prefix="/saved", tags=["saved"])


class ArticlePayload(BaseModel):
    title: str
    summary: str
    image: str = ""
    category: Literal["all", "technology", "business", "sports", "war"] = "all"
    source: str = ""
    url: str = Field(min_length=4)
    publishedAt: Optional[str] = None


class SaveBody(BaseModel):
    newsId: Optional[str] = None
    article: Optional[ArticlePayload] = None


class UnsaveBody(BaseModel):
    newsId: str


def _load_user_with_saved(db: DbDep, user_id: UUID) -> User:
    user = db.execute(
        select(User).options(selectinload(User.saved_articles)).where(User.id == user_id)
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/save")
def save_article(body: SaveBody, db: DbDep, user: CurrentUserDep):
    me = _load_user_with_saved(db, user.id)

    news_doc: Optional[Article] = None
    if body.newsId:
        try:
            uid = UUID(body.newsId)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid newsId")
        news_doc = db.get(Article, uid)
        if news_doc is None:
            raise HTTPException(status_code=404, detail="News not found")
    elif body.article:
        a = body.article
        news_doc = upsert_article_from_item(
            db,
            {
                "title": a.title,
                "summary": a.summary,
                "image": a.image or "",
                "category": a.category,
                "source": a.source or "",
                "url": a.url,
                "publishedAt": a.publishedAt,
                "provider": "external",
            },
        )
        db.commit()
        db.refresh(news_doc)
    else:
        raise HTTPException(status_code=400, detail="Missing newsId or article")

    if news_doc not in me.saved_articles:
        me.saved_articles.append(news_doc)
        db.commit()

    return {"ok": True}


@router.post("/unsave")
def unsave_article(body: UnsaveBody, db: DbDep, user: CurrentUserDep):
    me = _load_user_with_saved(db, user.id)

    try:
        aid = UUID(body.newsId)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid newsId")

    art = db.get(Article, aid)
    if art and art in me.saved_articles:
        me.saved_articles.remove(art)
        db.commit()

    return {"ok": True}


@router.get("")
def list_saved(db: DbDep, user: CurrentUserDep):
    me = _load_user_with_saved(db, user.id)
    return {"items": [article_to_item(a) for a in me.saved_articles]}
