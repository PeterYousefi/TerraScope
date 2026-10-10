import pytest
from shapely.geometry import Point, box, mapping, shape

from app.config import Settings
from app.spatial import PROJECT, UNPROJECT, analyze, generate_zones, normalize, transform


@pytest.fixture
def datasets():
    boundary = mapping(box(-97.82, 30.2, -97.68, 30.34))
    tracts = [{"id": "fixture", "geometry": mapping(box(-98, 30, -97.5, 30.6)),
               "population": 400000, "households": 150000,
               "medianIncome": 70000, "commuters": 200000}]
    stations = [{"id": "fixture-station", "lon": -97.74, "lat": 30.27}]
    osm = [{"id": "node/1", "lon": -97.73, "lat": 30.28, "road": False},
           {"id": "way/2", "lon": -97.74, "lat": 30.27, "road": True,
            "geometry": [{"lon": -97.8, "lat": 30.22}, {"lon": -97.7, "lat": 30.32}]}]
    return boundary, stations, tracts, osm


def test_projected_distance_and_roundtrip():
    p = Point(-97.74, 30.27)
    q = Point(-97.73, 30.27)
    projected = transform(PROJECT, p)
    assert 950 < projected.distance(transform(PROJECT, q)) < 970
    assert transform(UNPROJECT, projected).distance(p) < 1e-8


def test_grid_clipped_and_bounded(datasets):
    boundary = datasets[0]
    zones, spacing = generate_zones(boundary, 1500, 10)
    assert 0 < len(zones) <= 10 and spacing > 1500
    study = transform(PROJECT, shape(boundary))
    assert all(study.buffer(.001).covers(cell) for _, cell in zones)
    assert zones == generate_zones(boundary, 1500, 10)[0]


def test_normalization():
    assert normalize([10, 20, 30]) == [0, 50, 100]
    assert normalize([10, 20, 30], True) == [100, 50, 0]
    assert normalize([5, 5, None]) == [50, 50, None]


def test_reproducible_features_and_sensitivity(datasets):
    a, ev, sensitivity, warnings = analyze(*datasets, Settings())
    b, *_ = analyze(*datasets, Settings())
    assert [c.model_dump() for c in a] == [c.model_dump() for c in b]
    assert a[0].rank == 1 and 0 <= a[0].totalScore <= 100
    assert sum(s.weight for s in a[0].scores) == pytest.approx(1)
    assert len(ev) == len(a)*3
    assert len(sensitivity) == 4
    assert warnings
    assert any(c.features["stations"].value == 1 for c in a)


def test_missing_optional_and_population(datasets):
    boundary, stations, tracts, _ = datasets
    candidates, _, _, warnings = analyze(boundary, stations, tracts, None, Settings())
    assert {s.dimension for s in candidates[0].scores} == {"Demand proxy", "Coverage gap"}
    assert any("excluded" in w for w in warnings)
    tracts[0]["population"] = None
    with pytest.raises(ValueError, match="90%"):
        analyze(boundary, stations, tracts, None, Settings())
