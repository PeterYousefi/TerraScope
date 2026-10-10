"""Bounded live adapters. Tests supply HTTP fixtures, never production fallback data."""

import asyncio
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError
from pyproj import Transformer
from shapely import make_valid
from shapely import transform as project_geometry
from shapely.geometry import box, shape

from .models import Source

BBOX = (-97.96, 30.05, -97.55, 30.55)
NLR_URL = "https://developer.nlr.gov/api/alt-fuel-stations/v1.json"
TIGER = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb"


def now():
    return datetime.now(timezone.utc).isoformat()


class ProviderError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class Station(BaseModel):
    id: str
    name: str
    lon: float = Field(ge=-180, le=180, allow_inf_nan=False)
    lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    address: str = ""
    access: str = "public"
    connectors: list[str] = []
    level2: int | None = None
    dcFast: int | None = None
    network: str | None = None
    updatedAt: str | None = None


class Tract(BaseModel):
    id: str
    population: float | None
    households: float | None
    medianIncome: float | None
    commuters: float | None
    geometry: dict[str, Any]


def census_number(value):
    try:
        n = float(value)
        return n if n >= 0 else None
    except (ValueError, TypeError):
        return None


def normalize_stations(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("fuel_stations"), list):
        raise ProviderError("NLR schema changed: fuel_stations array missing")
    records, warnings, seen = [], [], set()
    for r in payload["fuel_stations"]:
        if not isinstance(r, dict):
            warnings.append("Discarded malformed station record")
            continue
        if r.get("access_code") != "public" or r.get("status_code") != "E":
            continue
        try:
            if r.get("id") is None or not r.get("station_name"):
                raise ValueError("Missing station identity")
            s = Station(
                id=str(r["id"]),
                name=r["station_name"],
                lon=r.get("longitude"),
                lat=r.get("latitude"),
                address=r.get("street_address") or "",
                connectors=r.get("ev_connector_types") or [],
                level2=r.get("ev_level2_evse_num"),
                dcFast=r.get("ev_dc_fast_num"),
                network=r.get("ev_network"),
                updatedAt=r.get("updated_at"),
            )
        except (ValidationError, ValueError, TypeError):
            warnings.append("Discarded station with missing identity or invalid coordinates/fields")
            continue
        if not (BBOX[0] <= s.lon <= BBOX[2] and BBOX[1] <= s.lat <= BBOX[3]):
            continue
        if s.id in seen:
            warnings.append(f"Duplicate station {s.id} removed")
            continue
        seen.add(s.id)
        records.append(s.model_dump())
    return records, warnings


class Providers:
    def __init__(self, settings, store, client: httpx.AsyncClient):
        self.settings, self.store, self.client = settings, store, client
        self.lock = asyncio.Lock()
        self.observations = []

    async def request(self, url, params=None, data=None, ttl=86400):
        safe = {k: v for k, v in (params or {}).items() if k not in ("api_key", "key")}
        key = hashlib.sha256(json.dumps([url, safe, data], sort_keys=True).encode()).hexdigest()
        # One investigation worker plus a lock prevents identical concurrent cache misses.
        async with self.lock:
            cached = self.store.cached(key)
            if cached:
                self.observations.append(
                    {"url": url, "cache": "hit", "durationMs": 0, "httpStatus": 200}
                )
                return cached["body"], cached["at"], True
            start = time.monotonic()
            for attempt in range(2):
                try:
                    r = await self.client.request(
                        "POST" if data else "GET",
                        url,
                        params=params,
                        data=data,
                        timeout=self.settings.request_timeout,
                    )
                    if r.status_code in (429, 502, 503, 504) and attempt == 0:
                        await asyncio.sleep(30 if r.status_code == 429 else 2)
                        continue
                    if not r.is_success:
                        raise ProviderError(
                            f"Provider returned HTTP {r.status_code}", r.status_code
                        )
                    body = r.json()
                    if isinstance(body, dict) and (body.get("error") or body.get("remark")):
                        raise ProviderError("Provider returned an error/partial response")
                    at = now()
                    self.store.cache(key, {"body": body, "at": at}, ttl)
                    self.observations.append(
                        {
                            "url": url,
                            "cache": "miss",
                            "durationMs": round((time.monotonic() - start) * 1000),
                            "httpStatus": r.status_code,
                        }
                    )
                    return body, at, False
                except (httpx.TimeoutException, httpx.NetworkError):
                    if attempt == 0:
                        await asyncio.sleep(1)
                        continue
                    raise ProviderError("Provider connection failed or timed out") from None
                except (json.JSONDecodeError, UnicodeDecodeError):
                    raise ProviderError(
                        "Provider returned non-JSON data (check key and endpoint)"
                    ) from None
        raise ProviderError("Provider request exhausted retries")

    def source(
        self, id, name, publisher, url, at, cached, count, params, warnings=None, vintage=None
    ):
        obs = self.observations[-1] if self.observations else {}
        return Source(
            id=id,
            name=name,
            publisher=publisher,
            url=url,
            retrievedAt=at,
            freshness=f"Retrieved {at}" + (" · cache hit" if cached else ""),
            status="cached" if cached else "fetched",
            recordCount=count,
            parameters=params,
            warnings=warnings or [],
            vintage=vintage,
            durationMs=obs.get("durationMs", 0),
            httpStatus=obs.get("httpStatus"),
        )

    async def stations(self):
        if not self.settings.nlr_api_key:
            raise ProviderError("NLR_API_KEY is required for real EV charging coverage analysis")
        params = {
            "api_key": self.settings.nlr_api_key,
            "fuel_type": "ELEC",
            "state": "TX",
            "status": "E",
            "access": "public",
            "limit": "all",
        }
        body, at, cached = await self.request(NLR_URL, params, ttl=86400)
        if body.get("total_results", 0) > 15000 or body.get("total_results", 0) != len(
            body.get("fuel_stations", [])
        ):
            raise ProviderError("NLR result cap exceeded; refusing incomplete supply analysis")
        records, warnings = normalize_stations(body)
        return records, self.source(
            "nlr",
            "Public operating EV stations",
            "NLR",
            NLR_URL,
            at,
            cached,
            len(records),
            {"state": "TX", "fuel_type": "ELEC", "access": "public", "bbox": BBOX},
            warnings,
        )

    async def boundary(self):
        url = f"{TIGER}/Places_CouSub_ConCity_SubMCD/MapServer/4/query"
        params = {
            "where": "STATE='48' AND PLACE='05000'",
            "outFields": "GEOID,NAME",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
        }
        body, at, cached = await self.request(url, params, ttl=30 * 86400)
        features = body.get("features", [])
        if len(features) != 1 or not features[0].get("geometry"):
            raise ProviderError("Official Austin place boundary unavailable or schema changed")
        geometry = features[0]["geometry"]
        warnings = []
        g = shape(geometry)
        if not g.is_valid:
            from shapely.geometry import mapping

            repaired = make_valid(g)
            if repaired.geom_type not in ("Polygon", "MultiPolygon") or repaired.is_empty:
                raise ProviderError("Austin boundary cannot be repaired to valid polygons")
            geometry = mapping(repaired)
            warnings.append(
                "Official boundary topology repaired with Shapely make_valid before analysis"
            )
        return geometry, self.source(
            "boundary",
            "Austin incorporated place boundary",
            "US Census",
            url,
            at,
            cached,
            1,
            params,
            warnings,
            vintage="TIGERweb current",
        )

    async def census(self):
        if not self.settings.census_api_key:
            raise ProviderError(
                "CENSUS_API_KEY is required: Census requires a free activated key for all data queries since May 2026"
            )
        year = self.settings.acs_year
        url = f"https://api.census.gov/data/{year}/acs/acs5"
        params = {
            "get": "NAME,B01003_001E,B11001_001E,B19013_001E,B08301_001E",
            "for": "tract:*",
            "in": "state:48 county:453,491,209",
        }
        if self.settings.census_api_key:
            params["key"] = self.settings.census_api_key
        rows, at, cached = await self.request(url, params, ttl=30 * 86400)
        if not isinstance(rows, list) or len(rows) < 2:
            raise ProviderError("Census response missing tract records")
        required = {
            "state",
            "county",
            "tract",
            "B01003_001E",
            "B11001_001E",
            "B19013_001E",
            "B08301_001E",
        }
        if not required.issubset(rows[0]):
            raise ProviderError("Census schema changed: required columns missing")
        demographics = {}
        for row in rows[1:]:
            if len(row) != len(rows[0]):
                raise ProviderError("Census row width differs from header")
            r = dict(zip(rows[0], row))
            demographics[r["state"] + r["county"] + r["tract"]] = r
        geo_url = f"{TIGER}/Tracts_Blocks/MapServer/0/query"
        # Use the same ACS vintage boundary layer when available; current TIGER is explicitly labeled.
        geo_params = {
            "where": "STATE='48' AND COUNTY IN ('453','491','209')",
            "outFields": "GEOID",
            "returnGeometry": "true",
            "outSR": "4326",
            "f": "geojson",
            "geometry": ",".join(map(str, BBOX)),
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
        }
        geo, geo_at, geo_cached = await self.request(geo_url, geo_params, ttl=30 * 86400)
        if geo.get("exceededTransferLimit"):
            raise ProviderError("TIGER tract geometry response truncated")
        features = geo.get("features")
        if not isinstance(features, list) or not features:
            raise ProviderError("TIGER tract geometry records missing")
        records, warnings = (
            [],
            [
                "ACS estimates have sampling uncertainty; margins of error not modeled.",
                "Current TIGER boundaries joined to ACS by GEOID; vintages may differ.",
            ],
        )
        for f in features:
            id = f.get("properties", {}).get("GEOID")
            r = demographics.get(id)
            if not r or not f.get("geometry"):
                warnings.append(f"No ACS/geometry match for tract {id}")
                continue
            try:
                g = shape(f["geometry"])
                if not g.is_valid or g.area <= 0:
                    raise ValueError("Invalid geometry")
                tract = Tract(
                    id=id,
                    population=census_number(r["B01003_001E"]),
                    households=census_number(r["B11001_001E"]),
                    medianIncome=census_number(r["B19013_001E"]),
                    commuters=census_number(r["B08301_001E"]),
                    geometry=f["geometry"],
                )
                records.append(tract.model_dump())
            except (ValidationError, ValueError, TypeError):
                warnings.append(f"Invalid tract geometry {id}")
        if not records:
            raise ProviderError("No tract geometries matched ACS demographics")
        source = self.source(
            "census",
            f"ACS {year} five-year tract estimates",
            "US Census",
            url,
            at,
            cached,
            len(records),
            {k: v for k, v in params.items() if k != "key"},
            warnings,
            f"{year - 4}–{year}",
        )
        geo_source = self.source(
            "tracts",
            "Census tract geometry",
            "US Census",
            geo_url,
            geo_at,
            geo_cached,
            len(features),
            geo_params,
            vintage="TIGERweb current",
        )
        return records, [source, geo_source]

    async def osm(self):
        west, south, east, north = BBOX
        bounds = f"({south},{west},{north},{east})"
        query = f"""[out:json][timeout:45][maxsize:134217728];(
        nwr[amenity=parking]{bounds};nwr[shop=supermarket]{bounds};
        nwr[shop=mall]{bounds};
        way[highway~"^(motorway|trunk|primary|secondary)$"]{bounds};);out center geom;"""
        url = self.settings.overpass_url
        body, at, cached = await self.request(url, data={"data": query}, ttl=7 * 86400)
        elements = body.get("elements")
        if not isinstance(elements, list):
            raise ProviderError("OSM schema changed: elements array missing")
        if len(elements) > 20000:
            raise ProviderError("OSM bounded result limit exceeded")
        records, seen, warnings = [], set(), []
        missing_coordinates = 0
        projected_centers = 0
        project = Transformer.from_crs(4326, 32614, always_xy=True).transform
        unproject = Transformer.from_crs(32614, 4326, always_xy=True).transform
        for r in elements:
            if not isinstance(r, dict):
                warnings.append("Discarded malformed OSM record")
                continue
            center = r.get("center", r)
            lon, lat = center.get("lon"), center.get("lat")
            id = f"{r.get('type')}/{r.get('id')}"
            # Overpass geom output supplies bounds rather than center for ways/relations.
            if (lon is None or lat is None) and isinstance(r.get("bounds"), dict):
                bounds = r["bounds"]
                try:
                    g = box(bounds["minlon"], bounds["minlat"], bounds["maxlon"], bounds["maxlat"])
                    projected = project_geometry(g, project, interleaved=False)
                    p = projected.representative_point()
                    lon, lat = unproject(p.x, p.y)
                    projected_centers += 1
                except (KeyError, TypeError, ValueError):
                    pass
            if id in seen:
                continue
            if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
                missing_coordinates += 1
                continue
            if not BBOX[0] <= lon <= BBOX[2] or not BBOX[1] <= lat <= BBOX[3]:
                continue
            seen.add(id)
            tags = r.get("tags") or {}
            records.append(
                {
                    "id": id,
                    "lon": lon,
                    "lat": lat,
                    "tags": tags,
                    "road": "highway" in tags,
                    "geometry": r.get("geometry", []),
                }
            )
        if missing_coordinates:
            warnings.append(
                f"{missing_coordinates} OSM objects discarded for missing coordinates/bounds"
            )
        if projected_centers:
            warnings.append(
                f"{projected_centers} OSM way/relation centers derived from projected bounding boxes; not entrances"
            )
        warnings.append("OSM is volunteered mapping; absent destinations do not prove absence.")
        return records, self.source(
            "osm",
            "Parking, supermarkets, malls and major roads",
            "OpenStreetMap contributors",
            url,
            at,
            cached,
            len(records),
            {"bbox": BBOX, "query": query},
            warnings,
        )
