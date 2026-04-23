from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, make_engine
from app.deps import init_db
from app.models import association  # noqa: F401
from app.models import article as article_model  # noqa: F401
from app.models import user as user_model  # noqa: F401
from app.models import news_cache_state as news_cache_state_model  # noqa: F401
from app.routers import auth, chat, live, news, saved, stories


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    engine = make_engine(settings.database_url)
    Base.metadata.create_all(bind=engine)
    init_db(engine)
    yield
    engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router, prefix="/api")
    app.include_router(news.router, prefix="/api")
    app.include_router(chat.router, prefix="/api")
    app.include_router(saved.router, prefix="/api")
    app.include_router(stories.router, prefix="/api")
    app.include_router(live.router, prefix="/api")

    @app.get("/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
