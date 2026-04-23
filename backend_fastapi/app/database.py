from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Base(DeclarativeBase):
    pass


def make_engine(database_url: str):
    return create_engine(database_url, pool_pre_ping=True)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)
