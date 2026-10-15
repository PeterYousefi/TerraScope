# Validation record — October 10, 2026

## Automated checks executed

- Backend: **31 pytest tests passed**. Provider authentication, missing keys/records, invalid coordinates, duplicate IDs, schema changes, timeouts, cache hit/expiry, Census missing codes and joins, boundary repair, OSM geometry/bounds normalization and partial failures.
- Spatial: projection round trips, meter distances, clipped bounded deterministic grid, aggregation, flat/reverse normalization, reproducible ranking, missing dimensions/population and +20% weight sensitivity.
- API: create/status/result endpoints, truthful partial-source failure, missing required charging data, persisted hourly limit, cross-origin writes, restart persistence and interrupted-job recovery.
- Evaluation: supported planner/tool order, unsupported tool rejection, valid citations, fabricated observations/evidence rejection, ranking preservation, limitations acknowledgment and mocked structured OpenAI tool calls/token usage.
- Frontend: **3 Vitest tests passed** (navigation route and connected submission/polling/map-to-panel selection/error behavior).
- Browser: **2 Playwright tests passed in Chromium** on macOS. Preserved landing navigation; actual local FastAPI execution with explicitly labeled synthetic provider fixtures; calculated zones; candidate/evidence selection; report open/reload; comparison; backend unavailable without fixture fallback. Test servers use a temporary database on ports 8001 and 5174. The final map-selection test uses a blank basemap-style fixture so map marker assertions are mandatory and independent of public tile availability. An earlier successful run loaded the actual CARTO basemap for visual review.
- TypeScript type check and production build passed.
- ESLint passed with **0 errors and 7 pre-existing Fast Refresh export warnings**. Existing formatting violations were normalized without altering cinematic scene behavior; one pre-existing ternary expression lint failure was rewritten as an equivalent conditional.
- Ruff passed.
- Visual review of the rendered comparison detected a degenerate two-dimension radar chart. The reduced-data case now uses dimension bars.

Tests do not validate charging demand predictions. Routine checks use small synthetic records, make no paid API requests and are independent of public-service uptime. Native Windows/Linux execution was documented but not run on this macOS host. Starlette currently emits one deprecation warning for HTTPX-based TestClient; tests pass.

## Live public data smoke

`cd backend && python live_smoke.py --live` was executed. Raw cached responses and smoke output remain under ignored `backend/data/`, not in Git.

| Provider | Actual outcome |
| --- | --- |
| Census TIGER Austin boundary | Retrieved successfully at 2026-10-10T21:40:13Z. Polygon topology repaired using Shapely make_valid and disclosed in source warnings. |
| OpenStreetMap Overpass | Main instance succeeded at 2026-10-10T21:51:30Z after initial partial responses; 19,606 source objects, 19,571 normalized records. Geometry output bounds are used to derive projected centers for ways/relations. Result replay uses the seven-day cache and retains original retrieval time. |
| NLR EV charging | Blocked: `NLR_API_KEY` absent. Adapter and normalization/error tests implemented; no real station counts or rankings claimed. |
| Census ACS estimates | Blocked: `CENSUS_API_KEY` absent. Current Census policy requires an activated free key; an initial unkeyed request returned HTTP 302. Adapter and joins tested with fixtures; no live population estimates claimed. |
| OpenAI | No paid call executed. Disabled by default; API tool/output behavior tested with mocked responses. Requires explicit enablement, key and selected model. |
| openrouteservice | Optional enrichment not implemented; straight-line distances are labeled. |

The official Census key requirement is documented at https://www.census.gov/library/video/2026/adrm/requesting-a-census-data-api-key.html. NLR request limits and fields were checked against https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/. OpenAI tool schemas were checked against https://developers.openai.com/api/docs/guides/function-calling. Overpass instance/usage policy was checked against https://wiki.openstreetmap.org/wiki/Overpass_API.

**The full live-data definition of done remains blocked by the two required data keys.** The application never replaces those missing datasets with demo results. Successfully retrieved artifacts remain inspectable even when ranking fails.

## Publication and October 15 revalidation

The project is connected to `https://github.com/PeterYousefi/TerraScope` and its existing commit history was pushed to `master`. Earlier missing-remote blockers are resolved.

On October 15, 2026, the local checks were rerun: **31 backend tests, 3 frontend tests, and 2 Chromium browser acceptance tests passed**. Ruff, TypeScript checking, ESLint, and production build passed. ESLint still reports seven warnings (six Fast Refresh export warnings and one map cleanup ref warning). Build diagnostics include large map/3D chunks and tooling warnings. The Starlette TestClient deprecation warning remains. These are not reported as a warning-free build.

Documentation captures reuse the asserted browser workflow and are explicitly synthetic. No new public-provider smoke run or paid OpenAI call was performed during this refresh; the October 10 live results above remain historical evidence. The full live-data limitation remains unresolved.

A GitHub Actions workflow now runs backend checks, frontend checks/build, and Chromium acceptance without provider secrets or paid model calls. A local pass does not establish a CI pass; consult the repository Actions run for that result.

## Azure deployment verification — October 15, 2026

- Deployed the opt-in static TanStack frontend and FastAPI API as one Python 3.12 process at **https://terrascope.azurewebsites.net**.
- Verified resource inventory: one App Service plan (`F1`, `Free`, capacity 1) and one web app, in `terrascope-rg`. No paid database, registry, telemetry service, or model endpoint was provisioned.
- Backend suite now has **32 passing tests**, including hosted frontend routing, static file serving, preserved API routing, and missing-asset/API 404 behavior. Ruff, frontend tests, TypeScript checking and ESLint pass with the previously disclosed warnings. Static production build passes.
- Chromium smoke passed against both the locally built single-process target and the real public Azure URL: API health, landing, direct workspace navigation with truthful missing-key setup, labeled Austin demo report, reload, comparison, and no uncaught browser exceptions. A deployment-only hydration mismatch found during the first smoke was fixed with an explicit client-rendered entry for the static target; the default SSR entry remains available.
- Hosted `/api/capabilities` confirms OpenAI disabled and NLR/Census keys absent. No complete live ranking or paid AI execution is claimed.
- Azure memory metrics had not yet populated with usable readings during verification; the 1 GB figure is the free-tier allowance, not a measured application working set. No live heavy-analysis memory or production load benchmark was run.
- Free-tier hosting can sleep or stop at quotas. See [hosting configuration and budget](AZURE.md).
