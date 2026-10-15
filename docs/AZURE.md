# Azure hosting

Public URL: **https://terrascope.azurewebsites.net**

## Deployment shape and budget

TerraScope uses one Azure App Service **Free F1** Linux plan in Canada Central. FastAPI serves the API and a prebuilt, client-rendered TanStack frontend in one Python process. No Node server runs in Azure. A static build is selected explicitly; the default local SSR build remains available.

| Resource | Configuration | Recurring charge for this deployment |
| --- | --- | --- |
| App Service plan | F1 Free, shared CPU, 1 GB RAM allowance, one worker | $0 |
| Web app | `terrascope`, Python 3.12, HTTPS | Included |
| Database | SQLite in `/home/terrascope/sitesignal.db` | Included app storage |
| Domain/TLS | `terrascope.azurewebsites.net` | Included |
| OpenAI | Disabled; no key deployed | $0 |
| Separate SQL, registry, VMs, Insights, custom domain | Not provisioned | $0 |

The intended recurring hosting cost is **$0/month**, below the requested $5 ceiling, without relying on student credits. This applies to the TerraScope resources, not other subscription resources. The Free plan has shared CPU, 60 CPU minutes per day, limited storage/transfer, no availability SLA, and cold starts. Quota exhaustion can make the app unavailable. It is suitable for a portfolio demonstration. It does not automatically upgrade itself to a paid plan.

F1 is the smallest free service tier that accommodates this Python backend. Its memory allowance is fixed by Azure; this is not a dedicated 1 GB VM reservation. The application runs one worker, serves compressed assets, and gives fingerprinted assets long cache lifetimes. Always On is disabled. Queue capacity is one and new investigations are capped at two per hour globally. No model runs locally.

Pricing and limits: [App Service Linux pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/), [App Service quotas](https://learn.microsoft.com/en-us/azure/app-service/web-sites-monitor).

## Capabilities of the public deployment

The frontend, same-origin API, health endpoint, illustrative reports, and comparison are hosted together. Public provider credentials are not present: a new live investigation cannot produce a complete ranking until activated NLR/Census keys are configured. The app discloses this rather than inventing results. The [Austin illustrative report](https://terrascope.azurewebsites.net/investigations/austin-ev) is clearly labeled demo data.

Paid OpenAI use is disabled. Adding paid API credentials or changing service tiers is a separate cost decision. Anonymous API results are shared; this is not a private multi-tenant workspace. Do not submit sensitive questions or private data. Live jobs can be interrupted when the Free service sleeps or reaches its daily quota; interrupted jobs are marked failed on restart.

SQLite uses the app's persistent `/home` storage with one process. It has no managed backups, disaster-recovery guarantee, or multi-instance support. Keep the deployment at one worker.

## Build and package

```sh
npm ci --prefix lovable
cd lovable
STATIC_HOSTING=true VITE_API_BASE_URL=/ npm run build
cd ..
python3 scripts/package_azure.py /tmp/terrascope-azure.zip
```

The packaging script includes only backend Python modules, declared runtime dependencies, and compiled browser assets. It excludes environment files, tests, local databases, caches, Git history, Python environments, and Node dependencies. Node is needed at build time only. `/` as the frontend API base resolves requests to the same HTTPS origin.

## Redeploy the existing app

Sign in to the intended Azure subscription first. The existing resources are `terrascope-rg`, `terrascope-free`, and `terrascope`. Confirm **F1 / Free** before making changes:

```sh
az appservice plan show -g terrascope-rg -n terrascope-free --query sku
az webapp deploy -g terrascope-rg -n terrascope --src-path /tmp/terrascope-azure.zip --type zip
```

Azure installs dependencies during deployment with `SCM_DO_BUILD_DURING_DEPLOYMENT=true`. Startup:

```sh
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

App settings: `STATIC_DIR=frontend`, `DATABASE_URL=sqlite:////home/terrascope/sitesignal.db`, `ENABLE_OPENAI=false`, `MAX_QUEUE=1`, `MAX_JOBS_PER_HOUR=2`, `CORS_ORIGINS=https://terrascope.azurewebsites.net`. Provider secrets must be added through Azure app configuration, never committed or embedded in frontend assets.

## Verify

```sh
curl --fail https://terrascope.azurewebsites.net/api/health
cd lovable
npx playwright install chromium
node scripts/verify-hosted.mjs https://terrascope.azurewebsites.net
```

The Chromium smoke checks the real hosted frontend, same-origin API access, direct SPA routes, labeled demo report, reload, comparison, and uncaught browser errors. It makes no investigation submissions or paid API calls. CI also runs this smoke against the built single-process package locally on Linux.

To stop the app without changing the free plan, use `az webapp stop -g terrascope-rg -n terrascope`. Deleting `terrascope-rg` removes this deployment and its stored reports; that is a destructive cleanup action.
