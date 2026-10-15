# SiteSignal AI frontend

React 19, TypeScript, and TanStack Start power TerraScope's SiteSignal application. The cinematic frontend originated in Lovable; investigation, report, and comparison flows connect to the local Python backend.

See the [repository overview](../README.md), [local setup](../docs/LOCAL_DEVELOPMENT.md), and [screenshot gallery](../docs/SCREENSHOTS.md).

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Start the backend separately on port 8000. With no frontend environment file the client uses the local API. Set `VITE_DEMO_MODE=true` only for an explicitly labeled fixture preview; connection failures never silently enable demos. Backend secrets must never go into public `VITE_*` variables.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start their own frontend/backend on ports 5174/8001 using synthetic provider fixtures and temporary storage. See the root documentation for Python prerequisites.
