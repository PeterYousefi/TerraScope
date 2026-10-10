"""Opt-in public-data smoke; no paid AI calls or fixture fallback."""
import argparse
import asyncio
import json
from pathlib import Path

import httpx

from app.config import Settings
from app.providers import ProviderError, Providers, now
from app.spatial import analyze
from app.store import Store


async def smoke(output):
    settings = Settings(enable_openai=False)
    results = {"retrievedAt": now(), "providers": {}, "paidCalls": False}
    artifacts = {}
    async with httpx.AsyncClient(headers={"User-Agent": "SiteSignal-local-smoke/0.1"}) as client:
        p = Providers(settings, Store(settings.database_url), client)
        for name in ("boundary", "stations", "census", "osm"):
            try:
                records, sources = await getattr(p, name)()
                artifacts[name] = records
                sources = sources if isinstance(sources, list) else [sources]
                results["providers"][name] = {"status": "ok", "sources": [s.model_dump() for s in sources]}
            except ProviderError as exc:
                results["providers"][name] = {"status": "unavailable", "detail": str(exc)}
        if all(k in artifacts for k in ("boundary", "stations", "census")):
            candidates, _, sensitivity, warnings = analyze(artifacts["boundary"], artifacts["stations"],
                                                           artifacts["census"], artifacts.get("osm"), settings)
            results["analysis"] = {"candidates": len(candidates), "top": candidates[0].model_dump(),
                                   "sensitivity": sensitivity, "warnings": warnings}
        else:
            results["analysis"] = {"status": "blocked", "detail": "NLR, Census and official boundary must succeed before ranking."}
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    Path(output).write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", required=True)
    parser.add_argument("--output", default="data/live-smoke.json")
    args = parser.parse_args()
    asyncio.run(smoke(args.output))
