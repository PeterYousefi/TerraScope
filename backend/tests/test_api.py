import time

from fastapi.testclient import TestClient
from shapely.geometry import box, mapping

from app.config import Settings
from app.main import create_app
from app.models import Investigation, Question, Source
from app.providers import ProviderError, now
from app.store import Store


class FixtureProviders:
    def __init__(self, settings, store, client):
        self.client = client

    def source(self, id):
        return Source(id=id, name="TEST FIXTURE", publisher="Test", url="https://example.org",
                      status="fetched", freshness="Test only", retrievedAt=now(), recordCount=1)

    async def boundary(self):
        return mapping(box(-97.82, 30.2, -97.68, 30.34)), self.source("boundary")

    async def stations(self):
        return [{"id": "fixture", "name": "TEST station", "lon": -97.74, "lat": 30.27}], self.source("nlr")

    async def census(self):
        return [{"id": "fixture", "geometry": mapping(box(-98, 30, -97.5, 30.6)),
                 "population": 400000, "households": 150000}], [self.source("census"), self.source("tracts")]

    async def osm(self):
        raise ProviderError("Test partial OSM failure", 503)


def finish(client, id):
    for _ in range(100):
        inv = client.get(f"/api/investigations/{id}").json()
        if inv["status"] not in ("queued", "running"):
            return inv
        time.sleep(.03)
    raise AssertionError("Worker did not finish")


def test_api_pipeline_and_restart(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path}/jobs.db")
    with TestClient(create_app(settings, FixtureProviders)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/api/capabilities").json()["aiAvailable"] is False
        assert client.post("/api/investigations", json={"question": "Coffee in Seattle"}).status_code == 422
        response = client.post("/api/investigations", json={"question": "Where should I open an EV charging station in Austin?"})
        assert response.status_code == 202
        id = response.json()["id"]
        inv = finish(client, id)
        assert inv["status"] == "completed_with_warnings"
        assert inv["candidates"] and not inv["isDemo"]
        assert any("OSM failure" in w for w in inv["warnings"])
        assert not inv["report"]["aiGenerated"]
        for endpoint in ("events", "candidates", "evidence", "layers", "report"):
            assert client.get(f"/api/investigations/{id}/{endpoint}").status_code == 200
        assert client.get("/api/investigations/missing").status_code == 404
        assert client.post("/api/investigations", headers={"Origin": "https://untrusted.example"}, json={"question": "EV charging in Austin?"}).status_code == 403
    with TestClient(create_app(settings, FixtureProviders)) as client:
        assert client.get(f"/api/investigations/{id}").json()["candidates"] == inv["candidates"]
        assert len(client.get("/api/investigations").json()) == 1


def test_interrupted_recovery(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path}/jobs.db")
    store = Store(settings.database_url)
    inv = Investigation(id="interrupted", question=Question(text="EV charging in Austin?"),
                        status="running", createdAt=now())
    store.save(inv)
    with TestClient(create_app(settings, FixtureProviders)) as client:
        result = client.get("/api/investigations/interrupted").json()
        assert result["status"] == "failed"
        assert "restart" in result["report"]["summary"]


class MissingSupply(FixtureProviders):
    async def stations(self):
        raise ProviderError("NLR_API_KEY missing")


def test_missing_supply_never_fake_success(tmp_path):
    with TestClient(create_app(Settings(database_url=f"sqlite:///{tmp_path}/jobs.db"), MissingSupply)) as client:
        id = client.post("/api/investigations", json={"question": "EV charging in Austin?"}).json()["id"]
        inv = finish(client, id)
        assert inv["status"] == "failed" and inv["candidates"] == []
        assert "census" in inv["records"]
        assert "NLR_API_KEY" in str(inv["warnings"])


def test_persisted_hourly_limit(tmp_path):
    settings = Settings(database_url=f"sqlite:///{tmp_path}/jobs.db", max_jobs_per_hour=1)
    with TestClient(create_app(settings, FixtureProviders)) as client:
        id = client.post("/api/investigations", json={"question": "EV charging in Austin?"}).json()["id"]
        finish(client, id)
        response = client.post("/api/investigations", json={"question": "Where to open electric charging in Austin?"})
        assert response.status_code == 429
