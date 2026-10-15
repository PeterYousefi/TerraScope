# Engineering walkthrough

## Problem and scope

A location recommendation needs inspectable data, repeatable calculations, and a clear account of uncertainty. SiteSignal narrows the problem to Austin EV charging opportunity areas so its retrieval tools, geographic assumptions, and output validation can be tested. TerraScope is the repository name; SiteSignal AI is the product name shown in the interface.

The frontend began as a Lovable export. The implementation retains its cinematic scenes and extends the workspace, reports, comparison, and map interactions with a typed Python API and persisted analysis. This provenance matters when assessing which engineering decisions the repository demonstrates.

## A route through the code

1. [API contracts and application](../backend/app/main.py): submission, capability discovery, rate/queue constraints, job status, and artifact endpoints. [API tests](../backend/tests/test_api.py) cover missing required data, cross-origin writes, restart recovery, and persistence.
2. [Pipeline](../backend/app/pipeline.py): dependency-ordered execution with real events, explicit tool failure, deterministic analysis, and optional AI stages.
3. [Providers](../backend/app/providers.py): bounded HTTP retrieval, normalized schemas, source provenance, cache behavior, and completeness checks. [Provider tests](../backend/tests/test_providers.py) cover malformed/missing records and failure paths.
4. [Spatial engine](../backend/app/spatial.py): meter projection, boundary clipping, demographic intersection, score normalization, stable ranking, and weight sensitivity.
5. [AI boundary](../backend/app/ai.py): a strict supported plan and schema-constrained explanation. [Evaluation tests](../backend/tests/test_ai_evaluation.py) reject unsupported tools, fabricated IDs, changed rankings, and omitted limitations.
6. [Typed browser client](../lovable/src/lib/api/client.ts) and [acceptance workflow](../lovable/e2e/workflow.spec.ts): real API round trips, selection, reports, reloads, and explicit backend-unavailable behavior.

## Why use deterministic calculations around the model?

The scoring inputs are numbers and geometry, so Python calculates them directly. OpenAI can select the supported plan and the most useful observations. Its structured output cannot introduce a new candidate, invent an evidence identifier, or reorder the computed ranking without validation failing. The displayed explanation is assembled from supplied observations rather than unconstrained generated factual prose.

That boundary reduces one class of unsupported output. It does not prove the source data are correct, the weights predict demand, or the model chooses the most useful observations. Existing AI tests assess contracts and invariants with mocked responses; they are not an empirical model-quality benchmark.

## Failure behavior is product behavior

| Condition | Outcome |
| --- | --- |
| Charging inventory unavailable | Fail ranking; do not interpret missing supply as zero competitors |
| Required demographics unavailable | Retain retrieved artifacts and report failure |
| Optional OSM enrichment fails | Remove missing dimensions across the cohort, renormalize weights, disclose warnings |
| AI disabled or response invalid | Preserve deterministic report with a warning/status |
| Browser cannot reach backend | Explicit connection error; no silent fixture fallback |
| Backend restarts mid-job | Mark interrupted work failed; resume queued jobs |

These cases are exercised by tests. The screenshot workflow intentionally demonstrates the optional-source failure path.

## Operational tradeoffs

SQLite keeps installation simple and preserves source cache, execution events, and reports in one local system. A bounded single-process worker limits resource use. This choice does not provide distributed execution, tenant separation, or production availability.

Requests use timeouts and conservative retries; public data use TTL caches. Optional AI requires an explicit enable flag, key, and model. Requests are bounded and returned token usage is recorded. No automatic paid-call retries are used. Secrets stay in backend configuration; frontend `VITE_*` settings are public.

Geographic scores are cohort-relative screening proxies. Tract aggregation assumes uniform density, catchments require population coverage, and geographic distances are straight lines. Weight sensitivity helps expose ranking dependence on assumptions; it does not measure predictive confidence.

## Next milestones and acceptance criteria

- **Complete live integration:** run with activated NLR/Census keys, retain retrieval timestamps and source counts, inspect candidate evidence against source records, and publish a redacted validation record.
- **Evaluate optional AI behavior:** use a versioned set of supported and unsupported questions; record schema validity, evidence coverage, invalid-output rejection, latency, and token usage for an explicitly selected model. Include adversarial user/source text. Do not describe mock-based contract tests as model benchmarks.
- **Improve frontend delivery:** measure map/3D loading and bundle costs; retain the existing visual experience while testing any loading changes.
- **Prepare for hosted use:** authentication, tenant-specific limits/storage, durable workers, migration strategy, structured monitoring, retention policy, and load tests before claiming production readiness.

No vector database, model training, multi-agent autonomy, deployment, or production customer adoption is claimed by this project. The strongest evidence here is the implemented retrieval/analysis/reporting boundary and its executable failure tests.
