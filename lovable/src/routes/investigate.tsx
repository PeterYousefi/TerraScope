import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Plus, Search, FileText } from "lucide-react";
import { investigations } from "@/lib/demo/fixtures";
import { api, isDemoMode } from "@/lib/api/client";
import type { Investigation } from "@/types";
import { Logo } from "@/components/layout/SiteHeader";
import { InvestigationMap } from "@/components/map/InvestigationMap";
import {
  CandidateRow,
  DemoBadge,
  EvidenceTrail,
  SourceList,
  Timeline,
} from "@/components/investigation/parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investigate")({
  head: () => ({
    meta: [
      { title: "Investigation workspace — SiteSignal AI" },
      {
        name: "description",
        content:
          "Ask a geographic question and watch a structured, evidence-backed investigation unfold on a live map.",
      },
      { property: "og:title", content: "Investigation workspace — SiteSignal AI" },
      {
        property: "og:description",
        content:
          "Map layers, ranked candidates and traceable evidence in one geospatial workspace.",
      },
    ],
  }),
  component: Workspace,
});

const TYPES = [
  { v: "ev-charging", l: "EV charging" },
  { v: "retail", l: "Retail site" },
  { v: "mobility", l: "Mobility access" },
];

function Workspace() {
  const empty: Investigation = {
    ...investigations[0]!,
    id: "",
    isDemo: false,
    status: "draft",
    steps: [],
    candidates: [],
    sources: [],
    evidence: [],
    layers: [],
    report: {
      summary: "Submit an Austin EV charging question to retrieve real public datasets.",
      findings: [],
      limitations: [],
      rankingExplanation: "",
    },
  };
  const [inv, setInv] = useState<Investigation>(isDemoMode ? investigations[0]! : empty);
  const [recent, setRecent] = useState<Investigation[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [setup, setSetup] = useState("");
  const [question, setQuestion] = useState(investigations[0]!.question.text);
  const [area, setArea] = useState("Austin");
  const [layers, setLayers] = useState<string[]>(["existing", "demand", "gap"]);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"controls" | "map" | "results">("map");
  const running = submitting || inv.status === "queued" || inv.status === "running";
  const step = inv.steps.length;

  useEffect(() => {
    let cancelled = false;
    api
      .listInvestigations()
      .then((items) => {
        if (cancelled) return;
        setRecent(items);
        if (items[0]) setInv((current) => (current.id ? current : items[0]!));
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    if (!isDemoMode)
      api
        .capabilities()
        .then((c) => {
          if (!cancelled)
            setSetup(
              c.missingConfiguration.length
                ? `Setup required: ${c.missingConfiguration.join(", ")}. Analysis cannot rank zones until charging data are available.`
                : "Live public-data analysis configured.",
            );
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!inv.id || (inv.status !== "queued" && inv.status !== "running")) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api.getInvestigation(inv.id);
        if (cancelled || !next) return;
        setInv(next);
        setError("");
        setRecent((items) => [next, ...items.filter((i) => i.id !== next.id)]);
        if (next.status === "queued" || next.status === "running") timer = setTimeout(poll, 1500);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          timer = setTimeout(poll, 3000);
        }
      }
    };
    timer = setTimeout(poll, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [inv.id, inv.status]);

  const run = async (q: string, a: string) => {
    setSubmitting(true);
    setError("");
    try {
      const next = await api.createInvestigation(q, a);
      setInv(next);
      setArea(next.area.name);
      setSelected(null);
      setTab("results");
      setRecent((items) => [next, ...items.filter((i) => i.id !== next.id)]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const loadRecent = (i: Investigation) => {
    setInv(i);
    setQuestion(i.question.text);
    setArea(i.area.name);
    setSelected(null);
  };

  const controls = (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
      <Button
        variant="outline"
        onClick={() => {
          setQuestion("");
          setSelected(null);
        }}
        className="justify-start"
      >
        <Plus /> New investigation
      </Button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) run(question, area);
        }}
        className="space-y-3"
      >
        <label htmlFor="q" className="label-tech text-muted-foreground">
          Question
        </label>
        <textarea
          id="q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="Where should I open an EV charging station in Austin?"
          className="w-full resize-none border border-input bg-paper p-3 text-sm outline-none focus:border-primary"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="area" className="label-tech text-muted-foreground">
              Area
            </label>
            <select
              id="area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="mt-1 w-full border border-input bg-paper p-2 text-sm"
            >
              {(isDemoMode ? investigations : [investigations[0]!]).map((i) => (
                <option key={i.id}>{i.area.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="type" className="label-tech text-muted-foreground">
              Type
            </label>
            <select
              id="type"
              value={inv.question.type}
              onChange={(e) => {
                const m = investigations.find((i) => i.question.type === e.target.value);
                if (m) {
                  setArea(m.area.name);
                  setQuestion(m.question.text);
                }
              }}
              className="mt-1 w-full border border-input bg-paper p-2 text-sm"
            >
              {(isDemoMode ? TYPES : TYPES.slice(0, 1)).map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={running || !question.trim()}>
          <Search /> {running ? "Investigating…" : "Investigate"}
        </Button>
        {isDemoMode && (
          <p className="text-xs text-muted-foreground">
            Demo mode: questions are matched to one of three prewritten investigations.
          </p>
        )}
      </form>
      {setup && <p className="text-xs text-muted-foreground">{setup}</p>}
      {error && (
        <p role="alert" className="border-l-2 border-signal pl-3 text-sm">
          {error}
        </p>
      )}
      <div>
        <div className="label-tech mb-2 text-muted-foreground">Recent</div>
        <ul className="space-y-1">
          {recent.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => loadRecent(i)}
                className={cn(
                  "w-full px-2 py-2 text-left text-sm hover:bg-muted",
                  inv.id === i.id && "bg-muted",
                )}
              >
                {i.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="label-tech mb-2 flex items-center gap-2 text-muted-foreground">
          <Layers className="size-3" /> Layers
        </div>
        <ul className="space-y-1.5">
          {inv.layers.map((l) => (
            <li key={l.id}>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={layers.includes(l.id)}
                  onChange={() =>
                    setLayers((s) =>
                      s.includes(l.id) ? s.filter((x) => x !== l.id) : [...s, l.id],
                    )
                  }
                  className="accent-primary"
                />
                {l.label}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="label-tech mb-2 text-muted-foreground">Data sources</div>
        <SourceList sources={inv.sources} />
      </div>
    </div>
  );

  const results = (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border p-5">
        <div className="mb-2 flex items-center gap-2">
          <DemoBadge isDemo={inv.isDemo} mode={inv.dataMode} />
          <span className="label-tech text-muted-foreground">
            {inv.area.name}, {inv.area.region}
          </span>
        </div>
        <h1 className="text-lg font-medium leading-snug">{inv.question.text}</h1>
      </div>
      <div className="border-b border-border p-5">
        <div className="label-tech mb-4 text-muted-foreground">
          Execution activity · {inv.status}
        </div>
        <Timeline steps={inv.steps} current={step} />
      </div>
      <div
        className={cn(
          "transition-opacity duration-500",
          running ? "pointer-events-none opacity-30" : "opacity-100",
        )}
      >
        <div className="border-b border-border p-5">
          <div className="label-tech mb-2 text-muted-foreground">Summary</div>
          <p className="text-sm leading-relaxed">{inv.report.summary}</p>
        </div>
        <div className="border-b border-border py-3">
          <div className="label-tech mb-2 px-5 text-muted-foreground">
            Ranked opportunity areas · {inv.isDemo ? "illustrative scores" : "calculated scores"}
          </div>
          {inv.candidates.map((c) => (
            <CandidateRow
              key={c.id}
              c={c}
              active={hover === c.id || selected === c.id}
              onHover={setHover}
              onSelect={(id) => {
                setSelected(id);
                setTab("map");
              }}
            />
          ))}
        </div>
        <div className="p-5">
          {inv.report.aiStatus && (
            <p className="mb-3 text-xs text-muted-foreground">{inv.report.aiStatus}</p>
          )}
          {inv.warnings?.map((w) => (
            <p key={w} className="mb-2 border-l-2 border-signal pl-2 text-xs">
              {w}
            </p>
          ))}
          <div className="label-tech mb-2 text-muted-foreground">Evidence</div>
          <EvidenceTrail items={inv.evidence} sources={inv.sources} />
          <details className="mt-4 text-sm">
            <summary className="label-tech cursor-pointer text-muted-foreground">
              Methodology
            </summary>
            <p className="mt-2 text-muted-foreground">{inv.report.rankingExplanation}</p>
          </details>
          {inv.id && (
            <Button asChild variant="ink" className="mt-5 w-full">
              <Link to="/investigations/$id" params={{ id: inv.id }}>
                <FileText /> Open full report <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper px-5">
        <Logo />
        <nav className="flex items-center gap-5">
          <Link to="/compare" className="label-tech text-muted-foreground hover:text-foreground">
            Compare
          </Link>
          <Link
            to="/methodology"
            className="label-tech hidden text-muted-foreground hover:text-foreground sm:inline"
          >
            Methodology
          </Link>
          {!isDemoMode && <span className="label-tech">Local live analysis</span>}
          {isDemoMode && (
            <span className="label-tech border border-signal/60 px-2 py-1">Demo mode</span>
          )}
        </nav>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "w-full shrink-0 border-r border-border bg-paper md:block md:w-72",
            tab === "controls" ? "block" : "hidden",
          )}
        >
          {controls}
        </aside>
        <main
          className={cn("relative min-w-0 flex-1 md:block", tab === "map" ? "block" : "hidden")}
        >
          <InvestigationMap
            investigation={inv}
            activeLayers={layers}
            showCandidates={!running}
            selectedId={selected}
            hoverId={hover}
            onHover={setHover}
            onSelect={setSelected}
          />
        </main>
        <aside
          className={cn(
            "w-full shrink-0 border-l border-border bg-paper lg:block lg:w-[380px]",
            tab === "results" ? "block" : "hidden",
          )}
        >
          {results}
        </aside>
      </div>
      <nav
        className="grid shrink-0 grid-cols-3 border-t border-border bg-paper lg:hidden"
        aria-label="Workspace panels"
      >
        {(["controls", "map", "results"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "label-tech py-3",
              tab === t ? "text-foreground" : "text-muted-foreground",
              t === "controls" && "md:hidden",
            )}
          >
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}
