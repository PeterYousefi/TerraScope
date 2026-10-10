import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — How SiteSignal AI investigates a place" },
      { name: "description", content: "The intended multi-agent architecture: planning, data discovery, spatial analysis, evaluation, verification and report synthesis." },
      { property: "og:title", content: "Methodology — How SiteSignal AI investigates a place" },
      { property: "og:description", content: "A transparent pipeline from geographic question to evidence-backed report." },
    ],
  }),
  component: Methodology,
});

type Status = "demo" | "planned";
const STAGES: { k: string; t: string; agent: string; status: Status; d: string; io: [string, string] }[] = [
  { k: "01", t: "Question interpretation", agent: "Planning agent", status: "demo", d: "Classify intent, extract the place, the decision being made and success criteria. In demo mode a keyword matcher routes to one of three fixtures.", io: ["Natural-language question", "Structured intent"] },
  { k: "02", t: "Geographic planning", agent: "Planning agent", status: "planned", d: "Resolve the area of interest to a boundary, choose analysis resolution (H3 cells or blocks) and the dimensions to score.", io: ["Intent", "AOI + analysis plan"] },
  { k: "03", t: "Data acquisition", agent: "Data discovery agent", status: "planned", d: "Select and call public APIs (DOE AFDC, Census ACS, OSM Overpass, GBFS). Each response is stored with URL, timestamp and hash.", io: ["Analysis plan", "Raw layers + provenance"] },
  { k: "04", t: "Spatial analysis", agent: "Geospatial analysis agent", status: "planned", d: "Deterministic tools — buffers, coverage gaps, density surfaces, network distance — run as code, not LLM guesses.", io: ["Raw layers", "Derived signals"] },
  { k: "05", t: "Candidate evaluation", agent: "Evaluation agent", status: "demo", d: "Weighted multi-criteria scoring with explicit weights. Demo mode renders fixed illustrative weights and values.", io: ["Derived signals", "Ranked candidates"] },
  { k: "06", t: "Evidence verification", agent: "Evidence verification agent", status: "planned", d: "Every claim must cite a stored source record; unsupported claims are dropped or downgraded to 'unverified'.", io: ["Draft claims", "Verified claims"] },
  { k: "07", t: "Report generation", agent: "Report synthesis agent", status: "demo", d: "Compose summary, ranking explanation and limitations. The report UI, export and comparison are implemented now.", io: ["Verified claims", "Investigation report"] },
];

function Methodology() {
  const [active, setActive] = useState(0);
  const s = STAGES[active]!;
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-[1400px] px-6 pb-16 pt-20 md:px-10">
          <div className="label-tech mb-6 text-muted-foreground">Methodology</div>
          <h1 className="display-xl max-w-5xl">From a question to evidence, one accountable step at a time.</h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">This describes the intended backend. Stages marked <em>planned</em> are not running yet — the frontend uses deterministic demo fixtures.</p>
        </section>

        <section className="grid-paper border-y border-border">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-10">
            <ol className="grid gap-px bg-border md:grid-cols-7" role="tablist" aria-label="Pipeline stages">
              {STAGES.map((st, i) => (
                <li key={st.k} className="bg-paper">
                  <button type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} onMouseEnter={() => setActive(i)}
                    className={cn("relative h-full w-full p-4 text-left transition-colors", i === active ? "bg-foreground text-background" : "hover:bg-muted")}>
                    <div className={cn("label-tech", i === active ? "text-signal" : "text-muted-foreground")}>{st.k}</div>
                    <div className="mt-6 text-sm font-medium leading-snug">{st.t}</div>
                    <div className={cn("label-tech mt-3", st.status === "demo" ? "text-primary" : i === active ? "text-background/60" : "text-muted-foreground")}>{st.status === "demo" ? "● Demo UI" : "○ Planned"}</div>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-px grid gap-8 border border-border bg-paper p-8 md:grid-cols-[1fr_1.4fr]" role="tabpanel">
              <div>
                <div className="label-tech text-muted-foreground">{s.agent}</div>
                <h2 className="mt-2 text-3xl font-medium tracking-tight">{s.t}</h2>
                <div className="mt-6 flex items-center gap-3 text-sm">
                  <span className="border border-border px-2 py-1">{s.io[0]}</span>
                  <span className="h-px w-8 bg-signal" />
                  <span className="border border-foreground px-2 py-1">{s.io[1]}</span>
                </div>
              </div>
              <p className="text-lg leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1400px] gap-12 px-6 py-20 md:grid-cols-2 md:px-10">
          {[
            ["Implemented in frontend demo mode", ["Cinematic 3D narrative", "MapLibre workspace with layers, popups and fly-to", "Deterministic investigation timeline", "Report, JSON export, print, comparison", "Typed API client with demo adapter"]],
            ["Connected to the backend later", ["Live public data acquisition", "Spatial tools executed server-side", "LLM planning & synthesis via tool calls", "Streaming events at /api/investigations/:id/events", "Persistent investigations"]],
            ["How evidence is tracked", ["Each source fetch stored with URL, timestamp, hash", "Claims reference evidence IDs, never free text", "Unsupported claims are labeled unverified"]],
            ["Uncertainty & evaluation", ["Per-candidate uncertainty from data coverage and recency", "Golden question sets with expected candidates", "Citation precision: share of claims with valid sources", "Ranking stability under weight perturbation"]],
          ].map(([h, items]) => (
            <div key={h as string} className="border-t border-foreground pt-6">
              <h3 className="text-xl font-medium">{h as string}</h3>
              <ul className="mt-4 space-y-2 text-muted-foreground">{(items as string[]).map((x) => <li key={x}>— {x}</li>)}</ul>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-[1400px] px-6 pb-24 md:px-10">
          <details className="border border-border bg-paper p-6">
            <summary className="cursor-pointer text-lg font-medium">Technical architecture</summary>
            <pre className="mt-6 overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground">{`Browser (static React build, Azure Static Web Apps)
  │  VITE_API_BASE_URL
  ▼
API (Azure Container Apps / Functions)
  ├─ POST /api/investigations      → enqueue run
  ├─ GET  /api/investigations/:id  → report
  ├─ GET  /api/investigations/:id/events (SSE)
  └─ GET  /api/health
  ▼
Orchestrator ── Planning → Discovery → Spatial → Evaluation → Verification → Synthesis
  │                 │            │
  │                 ▼            ▼
  │        Public APIs      PostGIS / H3 tools
  ▼
Store: investigations, evidence records (url, fetched_at, sha256), scores`}</pre>
          </details>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
