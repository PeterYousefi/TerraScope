import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from uuid import uuid4

import httpx
from fastapi import FastAPI, HTTPException
from fastapi import Request as HTTPRequest
from fastapi.middleware.cors import CORSMiddleware

from .ai import supported
from .config import Settings
from .models import Candidate, Event, Evidence, Investigation, Layer, Question, Report, Request
from .pipeline import run
from .providers import Providers, now
from .store import Store

logging.basicConfig(level=logging.INFO, format="%(message)s")
# Avoid HTTPX INFO logging URLs carrying provider keys.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def create_app(settings=None, provider_factory=Providers):
    settings = settings or Settings()
    store = Store(settings.database_url)

    @asynccontextmanager
    async def lifespan(app):
        for inv in store.list():
            if inv.status == "running":
                inv.status = "failed"
                inv.report.summary = "Interrupted by server restart. Submit again; provider cache is retained."
                inv.steps.append(Event(id=str(uuid4()), agent="worker", label="Interrupted execution",
                                       detail=inv.report.summary, timestamp=now(), status="failed"))
                store.save(inv)
        async with httpx.AsyncClient(headers={"User-Agent": "SiteSignal-local-research/0.1"},
                                     limits=httpx.Limits(max_connections=3)) as client:
            providers = provider_factory(settings, store, client)
            async def worker():
                while True:
                    queued = [i for i in reversed(store.list()) if i.status == "queued"]
                    if queued:
                        await run(queued[0], settings, store, providers)
                    else:
                        await asyncio.sleep(.3)
            task = asyncio.create_task(worker())
            yield
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title="SiteSignal AI local API", version="0.1.0", lifespan=lifespan)
    app.state.store = store
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","),
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    @app.middleware("http")
    async def local_only_write(request: HTTPRequest, call_next):
        # Browser cross-origin writes require a trusted frontend Origin, even though this is local.
        if request.method == "POST" and request.headers.get("origin") and request.headers["origin"] not in settings.cors_origins.split(","):
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        return await call_next(request)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "dataMode": "live", "database": "sqlite"}

    @app.get("/api/capabilities")
    def capabilities():
        return {"supported": ["Austin, Texas: EV charging opportunity areas"],
                "aiAvailable": settings.ai_available, "nlrConfigured": bool(settings.nlr_api_key),
                "missingConfiguration": [k for k, value in [("NLR_API_KEY", settings.nlr_api_key)] if not value],
                "routing": "Unavailable; straight-line distances only", "acsYear": settings.acs_year}

    @app.post("/api/investigations", response_model=Investigation, status_code=202)
    def create(body: Request):
        if not supported(body.question, body.area):
            raise HTTPException(422, "Only Austin, Texas EV charging opportunity analysis is supported")
        active = [i for i in store.list() if i.status in ("queued", "running")]
        duplicate = next((i for i in active if i.question.text.strip().lower() == body.question.strip().lower()), None)
        if duplicate:
            return duplicate
        if len(active) >= settings.max_queue:
            raise HTTPException(429, "Local investigation queue is full; wait for an active job to finish")
        inv = Investigation(id=str(uuid4()), question=Question(text=body.question),
                            status="queued", createdAt=now())
        store.save(inv)
        return inv

    @app.get("/api/investigations", response_model=list[Investigation])
    def list_investigations():
        return store.list()

    def get(id):
        inv = store.get(id)
        if inv is None:
            raise HTTPException(404, "Investigation not found")
        return inv

    @app.get("/api/investigations/{id}", response_model=Investigation)
    def investigation(id: str):
        return get(id)

    @app.get("/api/investigations/{id}/events", response_model=list[Event])
    def events(id: str):
        return get(id).steps

    @app.get("/api/investigations/{id}/candidates", response_model=list[Candidate])
    def candidates(id: str):
        return get(id).candidates

    @app.get("/api/investigations/{id}/evidence", response_model=list[Evidence])
    def evidence(id: str):
        return get(id).evidence

    @app.get("/api/investigations/{id}/layers", response_model=list[Layer])
    def layers(id: str):
        return get(id).layers

    @app.get("/api/investigations/{id}/report", response_model=Report)
    def report(id: str):
        return get(id).report

    return app


app = create_app()
