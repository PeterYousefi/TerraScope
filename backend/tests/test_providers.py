import httpx
import pytest
import respx
from shapely.geometry import box, mapping

from app.config import Settings
from app.providers import NLR_URL, ProviderError, Providers, census_number, normalize_stations
from app.store import Store


@pytest.fixture
def provider(tmp_path):
    return Providers(Settings(nlr_api_key="test-secret", census_api_key="census-test", request_timeout=5),
                     Store(f"sqlite:///{tmp_path}/test.db"), httpx.AsyncClient())


def station(id=1, **kwargs):
    return dict(id=id, station_name="Fixture station", longitude=-97.74, latitude=30.27,
                access_code="public", status_code="E", **kwargs)


def test_station_normalization():
    bad = station(2)
    bad["latitude"] = 999
    rows, warnings = normalize_stations({"fuel_stations": [station(), station(), bad]})
    assert len(rows) == 1
    assert len(warnings) == 2
    assert rows[0]["id"] == "1"
    with pytest.raises(ProviderError):
        normalize_stations({"stations": []})


@pytest.mark.parametrize("value,expected", [("100", 100), (None, None), ("null", None),
                                           ("-666666666", None), ("0", 0)])
def test_census_missing(value, expected):
    assert census_number(value) == expected


@respx.mock
async def test_stations_cached_and_secret_absent(provider):
    route = respx.get(NLR_URL).respond(200, json={"fuel_stations": [station()], "total_results": 1})
    a, src = await provider.stations()
    b, cached = await provider.stations()
    assert a == b
    assert src.status == "fetched" and cached.status == "cached"
    assert route.call_count == 1
    assert "test-secret" not in src.model_dump_json()
    assert "limit=all" in str(route.calls[0].request.url)


@respx.mock
@pytest.mark.parametrize("code", [401, 403, 422])
async def test_auth_and_errors(provider, code):
    respx.get(NLR_URL).respond(code)
    with pytest.raises(ProviderError, match=f"HTTP {code}"):
        await provider.stations()


@respx.mock
async def test_timeout(provider):
    respx.get(NLR_URL).mock(side_effect=httpx.ReadTimeout("test"))
    with pytest.raises(ProviderError, match="timed out"):
        await provider.stations()


@respx.mock
async def test_census_geometry_join(provider):
    url = "https://api.census.gov/data/2024/acs/acs5"
    respx.get(url).respond(200, json=[
        ["NAME", "B01003_001E", "B11001_001E", "B19013_001E", "B08301_001E", "state", "county", "tract"],
        ["Fixture tract", "1000", "400", "-666666666", "600", "48", "453", "000100"]])
    respx.get(url__regex=r".*Tracts_Blocks.*").respond(200, json={"features": [
        {"properties": {"GEOID": "48453000100"}, "geometry": mapping(box(-97.8, 30.2, -97.7, 30.3))}]})
    rows, sources = await provider.census()
    assert rows[0]["medianIncome"] is None and rows[0]["population"] == 1000
    assert len(sources) == 2


@respx.mock
async def test_osm_missing_tags_and_partial(provider):
    route = respx.post(provider.settings.overpass_url)
    route.respond(200, json={"elements": [{"type": "node", "id": 1, "lon": -97.74, "lat": 30.27},
                                        {"type": "way", "id": 2}]})
    rows, source = await provider.osm()
    assert len(rows) == 1 and source.warnings
    provider.store.clear_cache()
    route.respond(200, json={"elements": [], "remark": "timeout"})
    with pytest.raises(ProviderError, match="partial"):
        await provider.osm()


async def test_missing_key(provider):
    provider.settings.nlr_api_key = ""
    with pytest.raises(ProviderError, match="NLR_API_KEY"):
        await provider.stations()


@respx.mock
async def test_boundary_topology_repaired(provider):
    from shapely.geometry import Polygon, shape
    polygon = Polygon([(-97.8, 30.2), (-97.7, 30.3), (-97.8, 30.3), (-97.7, 30.2), (-97.8, 30.2)])
    respx.get(url__regex=r".*Places_CouSub.*").respond(200, json={"features": [{"geometry": mapping(polygon)}]})
    geometry, source = await provider.boundary()
    assert shape(geometry).is_valid and source.warnings


async def test_missing_census_key(provider):
    provider.settings.census_api_key = ""
    with pytest.raises(ProviderError, match="CENSUS_API_KEY"):
        await provider.census()


@respx.mock
async def test_truncated_supply_rejected(provider):
    respx.get(NLR_URL).respond(200, json={"fuel_stations": [station()], "total_results": 100})
    with pytest.raises(ProviderError, match="incomplete"):
        await provider.stations()


def test_expired_cache(provider):
    provider.store.cache("expired", {"body": {}, "at": "test"}, ttl=-1)
    assert provider.store.cached("expired") is None


@respx.mock
async def test_osm_way_geometry_bounds(provider):
    respx.post(provider.settings.overpass_url).respond(200, json={"elements": [
        {"type": "way", "id": 5, "bounds": {"minlon": -97.75, "maxlon": -97.73,
                                                "minlat": 30.26, "maxlat": 30.28},
         "tags": {"highway": "primary"}, "geometry": [
             {"lon": -97.75, "lat": 30.26}, {"lon": -97.73, "lat": 30.28}]}]})
    rows, source = await provider.osm()
    assert len(rows) == 1 and rows[0]["road"]
    assert rows[0]["lon"] == pytest.approx(-97.74, abs=.001)
    assert "not entrances" in str(source.warnings)
