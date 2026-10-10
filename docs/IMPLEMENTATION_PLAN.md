# Local implementation plan

## Initial assessment (2026-10-10)
The supplied `lovable/` directory is a source export, with no `.git` directory, remote, or installed dependencies. It uses React 19, TypeScript, Vite 8 and TanStack Start/Router (not a plain SPA), Tailwind 4, Three/R3F, GSAP and MapLibre 6. Preserve the SSR server wrapper and cinematic scene components. Routes include home, investigate, report, compare, methodology and about. The central API client supports a backend URL, but defaults to fixtures. Workspace starts with fixture results and simulates progress with timers. Report and compare read fixtures directly. Scores, evidence and map layers are illustrative. Map click/selection and JSON export already work. No backend exists.

## Checklist
- [x] Inspect source, models, routes and project instructions
- [ ] Run baseline frontend tests/build and local server
- [ ] Connect Git history/remote (blocked: supplied export has neither; URL requested)
- [ ] Scaffold typed backend, settings, health/capabilities and SQLite persistence
- [ ] Implement cached HTTP integrations for NLR, Census ACS/TIGER and OSM
- [ ] Generate projected deterministic candidate areas and reproducible scores
- [ ] Add real execution workflow, API routes and restart recovery
- [ ] Add opt-in structured OpenAI planner/report validation
- [ ] Connect workspace/report/compare to backend; preserve landing scenes
- [ ] Provider, spatial, API, frontend and browser tests
- [ ] Evaluation harness and opt-in live smoke test
- [ ] Local setup/troubleshooting and final verification

Commit/push each tested slice when existing remote is known. Never provision or deploy cloud resources. Missing provider keys must remain explicit; fixture data is test-only or explicitly labeled preview data.
