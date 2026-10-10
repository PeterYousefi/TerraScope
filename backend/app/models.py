from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Request(Model):
    question: str = Field(min_length=8, max_length=600)
    area: str | None = Field(default=None, max_length=80)


class Source(Model):
    id: str
    name: str
    publisher: str
    url: str
    kind: Literal["api", "public-dataset", "derived"] = "api"
    status: Literal["fetched", "cached", "failed"]
    freshness: str
    retrievedAt: str
    recordCount: int = 0
    parameters: dict[str, Any] = {}
    warnings: list[str] = []
    durationMs: int = 0
    httpStatus: int | None = None
    vintage: str | None = None


class Event(Model):
    id: str
    agent: str
    label: str
    detail: str
    durationMs: int = 0
    timestamp: str
    status: Literal["running", "done", "failed", "skipped"] = "done"


class Score(Model):
    dimension: str
    value: float
    weight: float


class Feature(Model):
    value: float | None
    unit: str
    source: str
    method: str
    warning: str | None = None


class Candidate(Model):
    id: str
    name: str
    neighborhood: str = "Austin opportunity area"
    coords: tuple[float, float]
    geometry: dict[str, Any]
    rank: int
    scores: list[Score]
    features: dict[str, Feature]
    rationale: str
    strengths: list[str] = []
    weaknesses: list[str] = []
    uncertainty: Literal["high"] = "high"
    evidenceIds: list[str]
    sourceRecordIds: dict[str, list[str]] = {}
    totalScore: float


class Evidence(Model):
    id: str
    sourceId: str
    claim: str
    candidateIds: list[str]


class Area(Model):
    name: str = "Austin"
    region: str = "Texas"
    center: tuple[float, float] = (-97.7431, 30.2672)
    bounds: list[tuple[float, float]] = [(-97.96, 30.05), (-97.55, 30.55)]
    zoom: int = 10


class Question(Model):
    text: str
    type: Literal["ev-charging"] = "ev-charging"


class LayerPoint(Model):
    coords: tuple[float, float]
    label: str
    value: float | None = None


class Layer(Model):
    id: str
    label: str
    kind: Literal["existing", "demand", "gap"]
    color: Literal["primary", "signal", "ink"]
    points: list[LayerPoint]


class Report(Model):
    summary: str = "Awaiting analysis."
    findings: list[str] = []
    limitations: list[str] = []
    rankingExplanation: str = ""
    aiGenerated: bool = False
    aiStatus: str = "Unavailable: enable and configure OpenAI for paid calls."
    aiExplanation: list[str] = []
    sensitivity: dict[str, Any] = {}
    weights: dict[str, float] = {}
    planner: str = "deterministic"
    tokenUsage: dict[str, Any] = {}


class Investigation(Model):
    id: str
    title: str = "Austin EV charging opportunity investigation"
    question: Question
    area: Area = Field(default_factory=Area)
    status: Literal["queued", "running", "completed", "completed_with_warnings", "failed"]
    createdAt: str
    steps: list[Event] = []
    candidates: list[Candidate] = []
    sources: list[Source] = []
    evidence: list[Evidence] = []
    layers: list[Layer] = []
    report: Report = Field(default_factory=Report)
    isDemo: bool = False
    dataMode: Literal["live", "cached", "mixed"] = "live"
    warnings: list[str] = []
    records: dict[str, Any] = {}
