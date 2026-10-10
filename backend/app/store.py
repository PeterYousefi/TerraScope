import time
from pathlib import Path

from sqlalchemy import JSON, Float, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column
from sqlalchemy.pool import StaticPool

from .models import Investigation


class Base(DeclarativeBase):
    pass


class Job(Base):
    __tablename__ = "investigations"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)


class Cache(Base):
    __tablename__ = "provider_cache"
    key: Mapped[str] = mapped_column(String, primary_key=True)
    expires: Mapped[float] = mapped_column(Float)
    payload: Mapped[dict] = mapped_column(JSON)


class Store:
    def __init__(self, url):
        if url.startswith("sqlite:///") and url != "sqlite:///:memory:":
            Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(
            url,
            connect_args={"check_same_thread": False},
            **({"poolclass": StaticPool} if url == "sqlite:///:memory:" else {}),
        )
        Base.metadata.create_all(self.engine)

    def save(self, inv: Investigation):
        with Session(self.engine) as s:
            s.merge(Job(id=inv.id, payload=inv.model_dump(mode="json")))
            s.commit()

    def get(self, id):
        with Session(self.engine) as s:
            row = s.get(Job, id)
            return Investigation.model_validate(row.payload) if row else None

    def list(self):
        with Session(self.engine) as s:
            return sorted(
                [Investigation.model_validate(r.payload) for r in s.scalars(select(Job))],
                key=lambda x: x.createdAt,
                reverse=True,
            )

    def cached(self, key):
        with Session(self.engine) as s:
            row = s.get(Cache, key)
            return row.payload if row and row.expires > time.time() else None

    def cache(self, key, payload, ttl):
        with Session(self.engine) as s:
            s.merge(Cache(key=key, payload=payload, expires=time.time() + ttl))
            s.commit()

    def clear_cache(self):
        with Session(self.engine) as s:
            for row in s.scalars(select(Cache)):
                s.delete(row)
            s.commit()
