import asyncio
import json
import logging
import time

from .ai import AI, TOOLS, Plan, supported
from .models import Event, Layer, LayerPoint, Source
from .providers import ProviderError, now
from .spatial import LIMITATIONS, analyze

logger = logging.getLogger("sitesignal")


async def run(inv, settings, store, providers):
    inv.status = "running"
    store.save(inv)
    ai = AI(settings, providers.client)
    tool_start = 0

    def event(tool, label, detail, status="done", duration=0):
        inv.steps.append(Event(id=f"event-{len(inv.steps)+1}", agent=tool, label=label,
                               detail=detail, timestamp=now(), status=status, durationMs=duration))
        store.save(inv)
        logger.info(json.dumps({"investigation": inv.id, "tool": tool, "status": status,
                                "detail": detail, "durationMs": duration}))

    async def acquire(name, fn, required=False):
        nonlocal tool_start
        tool_start = time.monotonic()
        event(name, f"Retrieving {name}", "Live request or persisted provider cache lookup", "running")
        try:
            result, sources = await fn()
            sources = sources if isinstance(sources, list) else [sources]
            inv.sources.extend(sources)
            inv.warnings.extend(w for s in sources for w in s.warnings)
            inv.records[name] = result
            detail = f"{len(result) if isinstance(result, list) else 1} records · " + ", ".join(s.status for s in sources)
            event(name, f"Retrieved {name}", detail, duration=round((time.monotonic()-tool_start)*1000))
            return result
        except ProviderError as exc:
            message = str(exc)
            inv.warnings.append(f"{name}: {message}")
            inv.sources.append(Source(id=name, name=name, publisher=name, url={
                "stations": "https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/",
                "census": "https://api.census.gov/", "osm": "https://www.openstreetmap.org/",
                "boundary": "https://tigerweb.geo.census.gov/"}[name],
                status="failed", freshness="Not retrieved", retrievedAt=now(),
                warnings=[message], httpStatus=exc.status))
            event(name, f"{name} unavailable", message, "failed",
                  round((time.monotonic()-tool_start)*1000))
            if required:
                raise
            return None

    try:
        if not supported(inv.question.text, inv.area.name):
            raise ValueError("Only Austin, Texas EV charging investigations are supported")
        event("planner", "Validating supported investigation", "Austin EV charging opportunity analysis", "running")
        if settings.ai_available:
            try:
                plan = await ai.plan(inv.question.text)
                inv.report.planner = "OpenAI structured tool planner"
                inv.report.tokenUsage["planning"] = ai.usage
            except (ProviderError, ValueError, Exception) as exc:
                # Do not log exception text from HTTPX: it can contain request secrets.
                inv.warnings.append(f"OpenAI planning failed ({type(exc).__name__}); using deterministic supported planner")
                plan = Plan(area="Austin, Texas", investigation_type="ev-charging", tools=TOOLS)
        else:
            plan = Plan(area="Austin, Texas", investigation_type="ev-charging", tools=TOOLS)
            event("openai", "AI planning skipped", "Paid AI disabled or key/model missing", "skipped")
        event("planner", "Plan validated", f"{inv.report.planner}: {', '.join(plan.tools)}")
        boundary = await acquire("boundary", providers.boundary, required=True)
        # Acquire all independently useful datasets even when NLR configuration is missing.
        stations = await acquire("stations", providers.stations)
        tracts = await acquire("census", providers.census)
        osm = await acquire("osm", providers.osm)
        if stations is None or tracts is None:
            raise ProviderError("Ranking requires successful NLR charging data and Census population/geometry. Review provider warnings.")
        start = time.monotonic()
        event("spatial_analysis", "Calculating candidate features", "Projected grid, 2 km catchments, area-weighted demographics", "running")
        candidates, evidence, sensitivity, warnings = await asyncio.to_thread(
            analyze, boundary, stations, tracts, osm, settings)
        inv.candidates, inv.evidence = candidates, evidence
        inv.warnings.extend(warnings)
        inv.report.weights = {s.dimension: s.weight for s in candidates[0].scores}
        inv.report.sensitivity = sensitivity
        inv.report.limitations = LIMITATIONS + inv.warnings
        inv.report.rankingExplanation = "Min/max normalization across eligible zones (flat dimensions = 50); weighted sum on 0–100 scale. Missing dimensions removed cohort-wide. Ties resolved by stable grid ID. Weights are assumptions."
        inv.report.summary = f"Statistical summary: {len(candidates)} Austin opportunity areas ranked from {len(stations)} public operating EV station records and {len(tracts)} ACS tracts. {candidates[0].name} has the highest screening score ({candidates[0].totalScore:.2f}/100)."
        inv.report.findings = [f"Rank {c.rank}: {c.name}, score {c.totalScore:.2f}; {c.rationale}" for c in candidates[:5]]
        inv.layers = [Layer(id="existing", label="Public operating EV stations (NLR)", kind="existing", color="ink",
                            points=[LayerPoint(coords=(r["lon"], r["lat"]), label=f"{r['name']} · NLR {r['id']}") for r in stations]),
                      Layer(id="demand", label="Population proxy (ACS, normalized)", kind="demand", color="primary",
                            points=[LayerPoint(coords=c.coords, label=f"{c.features['population'].value} estimated people", value=next((s.value for s in c.scores if s.dimension == "Demand proxy"), 0)/4+2) for c in candidates]),
                      Layer(id="gap", label="Screening opportunity areas", kind="gap", color="signal",
                            points=[LayerPoint(coords=c.coords, label=c.name, value=c.totalScore) for c in candidates[:10]])]
        event("spatial_analysis", "Spatial analysis completed", f"{len(candidates)} eligible zones; sensitivity checks persisted", duration=round((time.monotonic()-start)*1000))
        source_ids = {s.id for s in inv.sources if s.status != "failed"}
        if any(e.sourceId not in source_ids for e in evidence):
            raise ValueError("Evidence references unavailable source")
        event("evidence_validation", "Evidence references verified", f"{len(evidence)} calculation references linked to retrieved sources")
        if settings.ai_available:
            event("openai", "Selecting evidence-backed explanation", "At most 5 candidates, 12 validated observations", "running")
            try:
                inv.report.aiExplanation = await ai.explain(inv)
                inv.report.aiGenerated = True
                inv.report.aiStatus = "AI-selected explanation using validated, code-generated observations"
                inv.report.tokenUsage["reporting"] = ai.usage
                event("openai", "Explanation validated", "Ranking, observations, citations and limitations checked")
            except Exception as exc:
                inv.report.aiStatus = f"AI explanation unavailable ({type(exc).__name__}); statistical summary retained"
                inv.warnings.append(inv.report.aiStatus)
                event("openai", "AI explanation rejected or unavailable", inv.report.aiStatus, "failed")
        else:
            event("openai", "AI explanation skipped", inv.report.aiStatus, "skipped")
        statuses = {s.status for s in inv.sources if s.status != "failed"}
        inv.dataMode = "cached" if statuses == {"cached"} else "mixed" if "cached" in statuses else "live"
        inv.status = "completed_with_warnings" if inv.warnings else "completed"
        event("worker", "Investigation completed", inv.status)
    except Exception as exc:
        inv.status = "failed"
        detail = str(exc) if isinstance(exc, (ProviderError, ValueError)) else f"Internal failure ({type(exc).__name__}); inspect local server logs"
        inv.report.summary = f"Investigation failed: {detail}"
        inv.report.limitations = LIMITATIONS + inv.warnings
        event("worker", "Investigation failed", detail, "failed")
    store.save(inv)
