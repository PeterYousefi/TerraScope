# SiteSignal AI — local geospatial investigation

SiteSignal preserves the existing Lovable cinematic React frontend and connects its workspace, map, reports and comparison to a Python backend. The implemented use case is **EV charging opportunity areas in Austin, Texas**. It retrieves public data, calculates features in projected meters, ranks clipped geographic zones and stores evidence and execution events in SQLite.

**Local development only. No cloud resources or deployment.** These zones are screening areas, not available properties, demand forecasts or approved charging sites.

## Current verification

Backend and browser workflows are tested with explicit test fixtures. The live Census Austin boundary was successfully retrieved on October 10, 2026; source topology required a disclosed repair. Complete live ranking has **not** been verified: this source export contains no NLR or Census credentials. Both are needed. Live OSM retrieval also succeeded: 19,606 source objects yielded 19,571 normalized records on October 10, 2026. Public Overpass availability varies; the smoke test reports actual success/failure and never substitutes fixtures. See [validation record](docs/VALIDATION.md).

The workspace defaults to a real local API, including when environment files are absent. Seattle coffee and Chicago bike-share, plus the cinematic landing previews, remain clearly labeled demos. Set `VITE_DEMO_MODE=true` only when deliberately previewing fixtures. API connection failures display errors and never switch modes automatically.

## Prerequisites and source keys

- Python 3.11+ (verified here with Python 3.14.7), Node.js 22.12+ or a compatible newer version, npm.
- Obtain a free [NLR developer key](https://developer.nlr.gov/signup/) for `NLR_API_KEY`.
- Obtain and activate a free [Census API key](https://api.census.gov/data/key_signup.html) for `CENSUS_API_KEY`. [Census now requires a key for all data queries](https://www.census.gov/library/video/2026/adrm/requesting-a-census-data-api-key.html).
- OpenAI is optional and paid. Leave `ENABLE_OPENAI=false` unless you approve its usage. Enabling requires `OPENAI_API_KEY` and your chosen `OPENAI_MODEL`; no model is silently selected. The app makes at most two bounded OpenAI requests per investigation and records returned token usage.
- OSM uses a configurable public Overpass endpoint. MapLibre defaults to the CARTO public style with attribution. A MapTiler public token or custom style is optional; restrict public tokens at the provider. Never place backend keys in `VITE_*` variables.
- `OPENROUTESERVICE_API_KEY` is reserved for future routing integration. Routing enrichment is **not implemented**; every displayed distance is straight-line meters.

## Install

When working from a GitHub clone, clone your existing repository URL and enter its root. This supplied folder was an export without Git metadata; see Git status below.

```sh
git clone <existing-repository-url> SiteSignal
cd SiteSignal
cd lovable
npm ci
cd ..
```

macOS / Linux:

```sh
python3 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -e './backend[test]'
cp backend/.env.example backend/.env
cp lovable/.env.example lovable/.env
```

Windows PowerShell:

```powershell
py -3 -m venv backend/.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -e "./backend[test]"
Copy-Item backend/.env.example backend/.env
Copy-Item lovable/.env.example lovable/.env
```

Edit `backend/.env` locally to add the two free data keys. Do not paste keys into frontend code or commit them. `backend/requirements.lock.txt` records the verified Python environment; the editable installation above reads the portable dependency ranges in `pyproject.toml`.

## Start locally

Terminal 1 (activate the Python environment first):

```sh
cd backend
python -m app.manage init
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```sh
cd lovable
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [SiteSignal](http://localhost:5173), [API health](http://localhost:8000/api/health), or [FastAPI OpenAPI docs](http://localhost:8000/docs). The database is also initialized automatically when FastAPI starts. Use **one backend process**; multiple worker processes are not supported by this local queue.

## Demonstrate the Austin investigation

1. Open the existing home page and click **Investigate**.
2. Submit “Where should I open a new EV charging station in Austin?” with Area Austin and Type EV charging.
3. Read the persisted execution activity as provider requests and spatial calculations complete. A failed source is explicitly marked; no station records are invented.
4. With NLR and Census available, view ranked opportunity areas and source station points on the map. Click a marker or cell, then inspect its population, households, commuting/income proxies, supply count, destinations, road distance and normalized weighted components.
5. Expand an evidence entry to inspect its source, query parameters and retrieval date. Open the full report to inspect normalized source records and each candidate's source record identifiers.
6. Compare areas, inspect the +20% weight sensitivity checks, and export JSON or print the report.
7. Reload the report or workspace. Existing investigations load from SQLite without rerunning acquisition or AI.

If a required source fails, the investigation finishes as **failed** with its successfully retrieved artifacts and errors retained. OSM failure permits a reduced-dimensional ranking with warnings. Missing OpenAI configuration retains a clearly labeled code-generated statistical summary.

## Tests

Backend (activated environment):

```sh
cd backend
python -m pytest -q
ruff check app tests live_smoke.py
# Small engineering evaluation harness:
python -m pytest tests/test_ai_evaluation.py tests/test_spatial.py -q
```

Frontend:

```sh
cd lovable
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests run dedicated local servers on ports **8001 and 5174** against explicitly labeled `TEST FIXTURE` provider data in a temporary database. They exercise real API persistence and numeric analysis, report reload, map/panel selection and connection failures. They do not establish live-provider completeness. The browser configuration selects the virtual-environment Python executable automatically for Windows, macOS and Linux. Windows/Linux execution has not been tested on this machine.

Opt-in public live smoke (no AI calls):

```sh
cd backend
python live_smoke.py --live
```

This writes `backend/data/live-smoke.json` with actual provider status, record counts and retrieval dates. Only successful NLR, Census and boundary retrieval permits spatial ranking. Routine tests require no credentials or network credits.

## Method and limits

[Architecture](docs/ARCHITECTURE.md) and [implementation checklist](docs/IMPLEMENTATION_PLAN.md) describe the system. Default study acquisition bounds are longitude -97.96 to -97.55 and latitude 30.05 to 30.55. Areas outside these bounds are not analyzed. Catchments touching incomplete acquisition edges are excluded. Official Austin boundaries are clipped to these bounds, so this is not a full metropolitan coverage claim.

Default grid spacing: 3,000 m; catchment radius: 2,000 m; maximum 80 zones. Grid spacing increases deterministically to meet the cap. Catchments require at least 90% coverage by tracts with valid population estimates. Population and household totals are apportioned by intersected tract area with a uniform-density assumption. Income is a household-weighted mean of tract medians, **not** the catchment median. Commuters are ACS workers age 16+, including work-from-home, **not** road traffic.

Scores use cohort min/max normalization, reverse existing station count and road distance, assign 50 for constant dimensions, and form a weighted sum. Default weights: population proxy 0.35, charging coverage gap 0.30, destinations 0.20, road proximity 0.15. Missing dimensions are removed for the entire cohort and remaining weights renormalized. Customize via `WEIGHTS` JSON in backend `.env`; weights are assumptions, not scientifically calibrated facts. Ranking ties use stable grid identifiers. Each weight is increased 20% independently to inspect changes in the top recommendation.

OpenAI tool planning is restricted to the supported tool sequence. Its report output selects supplied observation/candidate/evidence IDs rather than writing unconstrained factual claims. The validator rejects fabricated IDs, reordered calculated rankings or omitted limitations. The displayed optional explanation is **AI-selected evidence synthesis**, built from code-generated observations, not free-form AI prose.

Grid capacity, electrical connection feasibility, land availability, charging utilization, EV ownership, permits, property access and investment returns are not determined by these datasets. ACS uncertainty and vintage differences are disclosed; no confidence percentages are manufactured.

## Troubleshooting

- **Missing keys:** inspect `/api/capabilities` and the setup message. Add activated NLR and Census keys to `backend/.env`, then restart FastAPI. Census may redirect invalid keys to an HTML page; this is reported as a provider failure.
- **Python version:** `python --version` must show 3.11+. Use `python3` on macOS/Linux or `py -3` on Windows. Create a fresh virtual environment if packages were installed for a different interpreter.
- **Node installation:** check `node --version`, then use `npm ci` in `lovable/`. Vite 8 requires a supported modern Node release.
- **CORS:** use the documented ports and include the actual frontend origin in `CORS_ORIGINS`. Cross-origin write requests from unknown browser origins are rejected.
- **Port conflicts:** stop the other local server or update the corresponding frontend URL/CORS value. Browser tests need ports 8001 and 5174 free.
- **Provider limits/outages:** inspect the source status and activity. Successful responses are cached (NLR 1 day, OSM 7 days, Census/TIGER 30 days). Overpass is queried serially with bounded results and timeout; configure `OVERPASS_URL` if the service is unavailable. Do not rapidly rerun public-service smoke tests. HTTP 429 waits 30 seconds before one retry.
- **Map tiles:** check network access, style URL/token restrictions and attribution. Textual results remain inspectable if the basemap fails.
- **OpenAI limits:** HTTP errors and refusals leave the statistical report intact and produce warnings. Disable AI or resolve provider limits before retrying; no automatic paid-call retries.
- **Queue limits:** at most 5 queued/running jobs and 10 new jobs per hour by default. Active identical questions reuse the job. Hourly limits are derived from persisted investigation timestamps.
- **Interrupted backend:** jobs that were running are marked failed on restart; queued jobs resume. Submit again to reuse cached provider responses.
- **Cache clearing:** stop the backend, activate the environment, `cd backend`, then `python -m app.manage clear-cache`. Existing investigations remain accessible.
- **Database reset:** stop the backend and move `backend/data/sitesignal.db` to a backup location. Restart to create a new database. This removes access to stored investigations in the active app until the backup is restored.

## Git status

The supplied export had no `.git` directory or remote. Local focused commits have been created to retain incremental progress. Pushing is blocked by `fatal: No configured push destination.` The existing GitHub URL is needed before reconciling with its history; no remote history has been overwritten and no force-push has occurred. Do not simply force-push this export over an existing repository.
