"""Numeric analysis runs entirely in projected meters; no LLM supplies measurements."""

import math

from pyproj import Transformer
from shapely import transform as shapely_transform
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import unary_union

from .models import Candidate, Evidence, Feature, Score
from .providers import BBOX


def transform(fn, geom):
    return shapely_transform(geom, fn, interleaved=False)


PROJECT = Transformer.from_crs(4326, 32614, always_xy=True).transform
UNPROJECT = Transformer.from_crs(32614, 4326, always_xy=True).transform

LIMITATIONS = [
    "Opportunity areas are clipped grid cells, not available properties or approved sites.",
    "Population and household estimates are demand proxies, not measured EV charging demand.",
    "Population is apportioned by tract intersection area assuming uniform population density.",
    "Distances are straight-line meters; driving times and routing catchments are unavailable.",
    "Grid capacity, utility connection costs, land availability, permits and financial viability are unassessed.",
    "Public operating station counts omit private/planned chargers and do not measure utilization or power.",
    "ACS sampling error and TIGER/ACS vintage differences are not modeled.",
    "OSM completeness varies; scores and weights are exploratory assumptions, not validated forecasts.",
]


def generate_zones(boundary, spacing, maximum):
    study = transform(PROJECT, shape(boundary).intersection(box(*BBOX)))
    if study.is_empty or study.area < 1:
        raise ValueError("Austin boundary does not intersect configured study bounds")
    xmin, ymin, xmax, ymax = study.bounds
    # Increase spacing to cover the full study area when a finer grid exceeds the bound.
    while True:
        zones = []
        for ix in range(math.floor(xmin / spacing), math.ceil(xmax / spacing)):
            for iy in range(math.floor(ymin / spacing), math.ceil(ymax / spacing)):
                cell = box(
                    ix * spacing, iy * spacing, (ix + 1) * spacing, (iy + 1) * spacing
                ).intersection(study)
                if cell.area >= spacing * spacing * 0.15:
                    zones.append((f"zone-{ix}-{iy}", cell))
        if len(zones) <= maximum:
            return zones, spacing
        spacing = math.ceil(spacing * 1.2)


def normalize(values, reverse=False):
    valid = [v for v in values if v is not None]
    if not valid:
        return [None] * len(values)
    low, high = min(valid), max(valid)
    return [
        None
        if v is None
        else (
            50.0
            if high == low
            else round(100 * ((high - v) if reverse else (v - low)) / (high - low), 4)
        )
        for v in values
    ]


def rank(candidates, weights):
    if any(not math.isfinite(w) or w < 0 for w in weights.values()) or sum(weights.values()) <= 0:
        raise ValueError("Scoring weights must be finite, nonnegative and have a positive sum")
    for c in candidates:
        total = sum(weights.get(s.dimension, 0) for s in c.scores)
        if total <= 0:
            raise ValueError("No available scoring dimensions with positive weights")
        for s in c.scores:
            s.weight = weights.get(s.dimension, 0) / total
        c.totalScore = round(sum(s.value * s.weight for s in c.scores), 4)
    candidates.sort(key=lambda c: (-c.totalScore, c.id))
    for i, c in enumerate(candidates):
        c.rank = i + 1
    return candidates


def analyze(boundary, stations, tracts, osm, settings):
    zones, spacing = generate_zones(boundary, settings.grid_meters, settings.max_candidates)
    tract_geoms = [(r, transform(PROJECT, shape(r["geometry"]))) for r in tracts]
    station_points = [(r, transform(PROJECT, Point(r["lon"], r["lat"]))) for r in stations]
    destinations, roads = [], []
    for r in osm or []:
        if r["road"]:
            coords = [
                (p["lon"], p["lat"]) for p in r.get("geometry", []) if "lon" in p and "lat" in p
            ]
            if len(coords) >= 2:
                roads.append((r, transform(PROJECT, LineString(coords))))
        else:
            destinations.append((r, transform(PROJECT, Point(r["lon"], r["lat"]))))
    candidates, evidence, warnings = [], [], []
    acquisition_bounds = transform(PROJECT, box(*BBOX))
    if not stations:
        warnings.append(
            "NLR returned no valid stations in study bounds; inspect supply coverage before relying on ranking."
        )
    for id, cell in zones:
        point = cell.representative_point()
        catchment = point.buffer(settings.catchment_meters)
        if not acquisition_bounds.covers(catchment):
            continue
        matched = [
            (r, g, g.intersection(catchment).area / g.area)
            for r, g in tract_geoms
            if g.area > 0 and g.intersects(catchment)
        ]
        valid_pop = [(r, g, f) for r, g, f in matched if r["population"] is not None]
        coverage = (
            unary_union([g.intersection(catchment) for _, g, _ in valid_pop]).area / catchment.area
        )
        if coverage < 0.9:
            continue
        pop = sum(r["population"] * f for r, _, f in valid_pop)
        households = sum(r["households"] * f for r, _, f in matched if r["households"] is not None)
        commuters = sum(
            r.get("commuters", 0) * f for r, _, f in matched if r.get("commuters") is not None
        )
        has_commuters = all(r.get("commuters") is not None for r, _, _ in matched)
        income_rows = [
            (r, f)
            for r, _, f in matched
            if r.get("medianIncome") is not None and r.get("households") is not None
        ]
        income_weight = sum(r["households"] * f for r, f in income_rows)
        income_proxy = (
            sum(r["medianIncome"] * r["households"] * f for r, f in income_rows) / income_weight
            if income_weight
            else None
        )
        has_households = all(r["households"] is not None for r, _, _ in matched)
        nearby = [
            (r, p) for r, p in station_points if p.distance(point) <= settings.catchment_meters
        ]
        amenities = [
            (r, p) for r, p in destinations if p.distance(point) <= settings.catchment_meters
        ]
        nearest_road_item = min(roads, key=lambda item: point.distance(item[1]), default=None)
        nearest_station_item = min(
            station_points, key=lambda item: point.distance(item[1]), default=None
        )
        nearest_road = point.distance(nearest_road_item[1]) if nearest_road_item else None
        nearest_station = point.distance(nearest_station_item[1]) if nearest_station_item else None
        lon, lat = UNPROJECT(point.x, point.y)

        def feature(value, unit, source, method, warning=None):
            return Feature(value=value, unit=unit, source=source, method=method, warning=warning)

        features = {
            "population": feature(
                round(pop, 1),
                "estimated people",
                "census",
                "Sum ACS tract population × projected catchment intersection fraction",
                "Uniform tract density; proxy, not measured charging demand",
            ),
            "households": feature(
                round(households, 1) if has_households else None,
                "estimated households",
                "census",
                "Area-weighted tract sum",
                None if has_households else "Some household estimates unavailable",
            ),
            "commuters": feature(
                round(commuters, 1) if has_commuters else None,
                "estimated workers age 16+",
                "census",
                "Area-apportioned ACS B08301_001E total workers",
                "Commute proxy; includes work-from-home and is not traffic volume",
            ),
            "incomeProxy": feature(
                round(income_proxy, 1) if income_proxy is not None else None,
                "USD/year",
                "census",
                "Household-weighted mean of tract median household incomes",
                "This proxy is not the catchment median income or EV ownership",
            ),
            "populationDensity": feature(
                round(pop / (catchment.area / 1e6), 1),
                "people/km²",
                "census",
                "Area-weighted population / projected catchment area",
            ),
            "stations": feature(
                len(nearby),
                "public operating stations",
                "nlr",
                f"Station points within {settings.catchment_meters} straight-line meters",
            ),
            "nearestStation": feature(
                round(nearest_station, 1) if nearest_station is not None else None,
                "meters",
                "nlr",
                "Minimum projected point distance",
            ),
            "destinations": feature(
                len(amenities) if osm is not None else None,
                "OSM mapped destinations",
                "osm",
                "Point/OSM center within catchment",
                "OSM completeness varies",
            ),
            "roadDistance": feature(
                round(nearest_road, 1) if nearest_road is not None else None,
                "meters",
                "osm",
                "Minimum projected distance to major road line",
                "Geographic proximity, not access feasibility",
            ),
            "dataCoverage": feature(
                round(coverage * 100, 1),
                "% catchment area",
                "tracts",
                "Union area of tracts with population / catchment area",
            ),
        }
        eids = [f"{id}-population", f"{id}-stations"]
        evidence.extend(
            [
                Evidence(
                    id=eids[0],
                    sourceId="census",
                    claim=f"{id}: {pop:.1f} estimated people within {settings.catchment_meters} m using area apportionment.",
                    candidateIds=[id],
                ),
                Evidence(
                    id=eids[1],
                    sourceId="nlr",
                    claim=f"{id}: {len(nearby)} public operating EV stations within {settings.catchment_meters} m.",
                    candidateIds=[id],
                ),
            ]
        )
        if osm is not None:
            eids.append(f"{id}-osm")
            evidence.append(
                Evidence(
                    id=eids[-1],
                    sourceId="osm",
                    claim=f"{id}: {len(amenities)} mapped destinations within catchment.",
                    candidateIds=[id],
                )
            )
        candidates.append(
            Candidate(
                id=id,
                name=f"Opportunity area {len(candidates) + 1}",
                coords=(lon, lat),
                geometry=mapping(transform(UNPROJECT, cell)),
                rank=0,
                scores=[],
                features=features,
                evidenceIds=eids,
                sourceRecordIds={
                    "census": [r["id"] for r, _, _ in matched],
                    "nlr": sorted(
                        {r["id"] for r, _ in nearby}
                        | ({nearest_station_item[0]["id"]} if nearest_station_item else set())
                    ),
                    "osm": sorted(
                        {r["id"] for r, _ in amenities}
                        | ({nearest_road_item[0]["id"]} if nearest_road_item else set())
                    ),
                },
                totalScore=0,
                rationale=f"Estimated catchment population {pop:.1f}; {len(nearby)} existing public operating stations. Screening zone requires property and utility due diligence.",
            )
        )
    if not candidates:
        raise ValueError(
            "No zones have at least 90% catchment coverage by valid Census population data"
        )
    dimensions = {
        "Demand proxy": ("population", False),
        "Coverage gap": ("stations", True),
        "Destinations": ("destinations", False),
        "Road proximity": ("roadDistance", True),
    }
    # Missing dimensions are removed cohort-wide, avoiding candidate-specific weight advantages.
    for dimension, (key, reverse) in dimensions.items():
        vals = [c.features[key].value for c in candidates]
        if any(v is None for v in vals):
            warnings.append(f"{dimension} excluded from ranking because data are incomplete")
            continue
        for c, value in zip(candidates, normalize(vals, reverse)):
            c.scores.append(Score(dimension=dimension, value=value, weight=0))
    rank(candidates, settings.weights)
    top = candidates[0].id
    sensitivity = {}
    for dimension, weight in settings.weights.items():
        altered = dict(settings.weights, **{dimension: weight * 1.2})
        copied = [c.model_copy(deep=True) for c in candidates]
        rank(copied, altered)
        sensitivity[dimension] = {
            "weightMultiplier": 1.2,
            "topCandidate": copied[0].id,
            "topChanged": copied[0].id != top,
        }
    warnings.append(
        f"Grid spacing {spacing} m; {len(zones) - len(candidates)} zones excluded for inadequate population coverage."
    )
    return candidates, evidence, sensitivity, warnings
