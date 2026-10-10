import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — How SiteSignal AI investigates a place" },
      {
        name: "description",
        content:
          "The local investigation pipeline: public data acquisition, projected calculations, reproducible scoring and evidence validation.",
      },
      { property: "og:title", content: "Methodology — How SiteSignal AI investigates a place" },
      {
        property: "og:description",
        content: "A transparent pipeline from geographic question to evidence-backed report.",
      },
    ],
  }),
  component: Methodology,
});

type Status = "implemented" | "optional";
const STAGES: {
  k: string;
  t: string;
  agent: string;
  status: Status;
  d: string;
  io: [string, string];
}[] = [
  {
    k: "01",
    t: "Question interpretation",
    agent: "Supported-use-case planner",
    status: "implemented",
    d: "Validate Austin, Texas EV charging investigations. The default planner is deterministic. An explicitly enabled OpenAI structured tool planner selects and validates the same supported workflow.",
    io: ["Question", "Validated plan"],
  },
  {
    k: "02",
    t: "Geographic planning",
    agent: "Boundary tool",
    status: "implemented",
    d: "Retrieve the official Census Austin place boundary. Clip a stable meter-based grid to the study boundary and configured acquisition bounds. Invalid source topology is repaired with a disclosed warning.",
    io: ["Austin place identifier", "Projected study boundary"],
  },
  {
    k: "03",
    t: "Data acquisition",
    agent: "Provider adapters",
    status: "implemented",
    d: "Call NLR public operating EV stations, ACS five-year demographic estimates, TIGER tract geometry and OSM parking, supermarkets, malls and roads. Persist identifiers, parameters, retrieval dates, cache status and errors. NLR and Census require free API keys.",
    io: ["Study bounds", "Records + provenance"],
  },
  {
    k: "04",
    t: "Spatial analysis",
    agent: "Python spatial tools",
    status: "implemented",
    d: "Project to EPSG:32614 meters. Estimate catchment population by tract intersection area, count nearby station and destination records, and measure straight-line road proximity. Exclude areas with under 90% valid population coverage. These are proxies, not charging demand forecasts.",
    io: ["Retrieved records", "Calculated features"],
  },
  {
    k: "05",
    t: "Candidate evaluation",
    agent: "Weighted scoring",
    status: "implemented",
    d: "Min/max normalization across eligible candidates; constant dimensions receive 50. Weighted sum with configurable assumptions. Missing dimensions are excluded cohort-wide. Compare the top area when each weight increases by 20%.",
    io: ["Features + weights", "Reproducible ranking"],
  },
  {
    k: "06",
    t: "Evidence verification",
    agent: "Validation tools",
    status: "implemented",
    d: "Link calculation evidence to successfully retrieved sources and normalized record identifiers. AI may select only supplied observation and evidence IDs; changed rankings or unsupported selections are rejected.",
    io: ["Candidate calculations", "Validated references"],
  },
  {
    k: "07",
    t: "Report generation",
    agent: "Statistical summary / optional AI",
    status: "optional",
    d: "Code generates the statistical report and explicit limitations. When enabled and configured, OpenAI selects explanatory observations with validated citations. Paid AI is disabled by default. Results and events persist in local SQLite.",
    io: ["Rankings + evidence", "Persistent report"],
  },
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
          <h1 className="display-xl max-w-5xl">
            From a question to evidence, one accountable step at a time.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-muted-foreground">
            Austin EV charging analysis uses a local backend and real provider adapters. Missing
            keys or failed providers are reported explicitly. Landing previews for Austin, Seattle
            and Chicago remain labeled demo data; only Austin has an implemented live pipeline.
          </p>
        </section>

        <section className="grid-paper border-y border-border">
          <div className="mx-auto max-w-[1400px] px-6 py-16 md:px-10">
            <ol
              className="grid gap-px bg-border md:grid-cols-7"
              role="tablist"
              aria-label="Pipeline stages"
            >
              {STAGES.map((st, i) => (
                <li key={st.k} className="bg-paper">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "relative h-full w-full p-4 text-left transition-colors",
                      i === active ? "bg-foreground text-background" : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "label-tech",
                        i === active ? "text-signal" : "text-muted-foreground",
                      )}
                    >
                      {st.k}
                    </div>
                    <div className="mt-6 text-sm font-medium leading-snug">{st.t}</div>
                    <div
                      className={cn(
                        "label-tech mt-3",
                        st.status === "implemented"
                          ? "text-primary"
                          : i === active
                            ? "text-background/60"
                            : "text-muted-foreground",
                      )}
                    >
                      {st.status === "implemented" ? "● Implemented" : "○ AI optional"}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
            <div
              className="mt-px grid gap-8 border border-border bg-paper p-8 md:grid-cols-[1fr_1.4fr]"
              role="tabpanel"
            >
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
            [
              "Local workflow",
              [
                "Preserved cinematic 3D narrative",
                "MapLibre source points and clipped opportunity zones",
                "Actual persisted execution activity",
                "Reports, JSON export, print and comparison",
                "Typed API client with explicit preview mode",
              ],
            ],
            [
              "Backend tools",
              [
                "NLR, ACS, TIGER and OSM adapters",
                "Projected spatial calculations in Python",
                "Optional paid structured OpenAI calls",
                "Polling persisted execution events",
                "SQLite investigations and TTL cache",
              ],
            ],
            [
              "Evidence",
              [
                "Dataset names, query parameters and retrieval dates",
                "Stable source record identifiers",
                "Calculation methods and assumptions",
                "Validated evidence and observation selections",
              ],
            ],
            [
              "Uncertainty & evaluation",
              [
                "Area-apportioned ACS population proxies",
                "Missing data exclusions and truthful provider warnings",
                "Deterministic fixture tests",
                "Weight sensitivity checks",
                "No claim of scientifically validated charging demand",
              ],
            ],
          ].map(([h, items]) => (
            <div key={h as string} className="border-t border-foreground pt-6">
              <h3 className="text-xl font-medium">{h as string}</h3>
              <ul className="mt-4 space-y-2 text-muted-foreground">
                {(items as string[]).map((x) => (
                  <li key={x}>— {x}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="mx-auto max-w-[1400px] px-6 pb-24 md:px-10">
          <details className="border border-border bg-paper p-6">
            <summary className="cursor-pointer text-lg font-medium">Technical architecture</summary>
            <pre className="mt-6 overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground">{`React / TanStack Start + MapLibre (localhost:5173)
  │ Typed HTTP client + progress polling
  ▼
FastAPI (localhost:8000; OpenAPI at /docs)
  ├─ Persistent bounded local investigation worker
  ├─ NLR / ACS / TIGER / OSM provider tools
  ├─ Shapely + PyProj calculations in meters
  ├─ Weighted ranking + evidence validation
  └─ Optional configured OpenAI tool planner / evidence synthesis
  ▼
SQLite: investigations, source records, scores, events, TTL cache`}</pre>
          </details>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
