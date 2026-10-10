import { api } from "@/lib/api/client";
import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, Printer, Share2, Check } from "lucide-react";
import { totalScore } from "@/lib/demo/fixtures";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { InvestigationMap } from "@/components/map/InvestigationMap";
import { DemoBadge, EvidenceTrail, ScoreBars, Timeline } from "@/components/investigation/parts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/investigations/$id")({
  loader: async ({ params }) => {
    const inv = await api.getInvestigation(params.id);
    if (!inv) throw notFound();
    return { inv };
  },
  head: ({ loaderData }) => {
    if (!loaderData)
      return {
        meta: [
          { title: "Investigation not found — SiteSignal AI" },
          { name: "robots", content: "noindex" },
        ],
      };
    const t = `${loaderData.inv.title} — SiteSignal AI report`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.inv.question.text },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.inv.report.summary },
      ],
    };
  },
  notFoundComponent: ReportNotFound,
  component: Report,
});

function ReportNotFound() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-6 py-32 text-center">
        <h1 className="display-lg">No investigation here.</h1>
        <p className="mt-4 text-muted-foreground">This investigation ID could not be found.</p>
        <Button asChild className="mt-8">
          <Link to="/investigate">Open the workspace</Link>
        </Button>
      </div>
    </div>
  );
}

function Report() {
  const { inv } = Route.useLoaderData();
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(inv, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sitesignal-${inv.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const share = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-svh bg-background">
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <article className="mx-auto max-w-[1400px] px-6 py-14 md:px-10">
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-10 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <DemoBadge isDemo={inv.isDemo} mode={inv.dataMode} />
              <span className="label-tech text-muted-foreground">Status · {inv.status}</span>
              <span className="label-tech text-muted-foreground">
                {inv.area.name}, {inv.area.region} · {inv.area.center[1].toFixed(4)}° N /{" "}
                {Math.abs(inv.area.center[0]).toFixed(4)}° W
              </span>
            </div>
            <h1 className="display-lg max-w-4xl">{inv.title}</h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">“{inv.question.text}”</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={exportJson}>
              <Download /> Export JSON
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
            <Button variant="outline" onClick={share}>
              {copied ? <Check /> : <Share2 />} {copied ? "Link copied" : "Share"}
            </Button>
          </div>
        </div>

        <div className="grid gap-10 py-10 lg:grid-cols-[1fr_380px]">
          <div className="h-[460px] border border-border print:hidden">
            <InvestigationMap
              investigation={inv}
              activeLayers={inv.layers.map((l) => l.id)}
              hoverId={hover}
              selectedId={selected}
              onHover={setHover}
              onSelect={setSelected}
            />
          </div>
          <div>
            <div className="label-tech mb-3 text-muted-foreground">Findings</div>
            <p className="text-lg leading-relaxed">{inv.report.summary}</p>
            {inv.report.aiStatus && (
              <p className="mt-4 text-xs text-muted-foreground">{inv.report.aiStatus}</p>
            )}
            {inv.report.aiExplanation?.map((line) => (
              <p key={line} className="mt-2 text-sm">
                {line}
              </p>
            ))}
            <ul className="mt-6 space-y-3">
              {inv.report.findings.map((f, i) => (
                <li key={f} className="flex gap-3 text-sm">
                  <span className="label-tech text-primary">F{i + 1}</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <section className="border-t border-border py-10">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-2xl font-medium tracking-tight">Candidate ranking</h2>
            <span className="label-tech text-muted-foreground">
              {inv.report.rankingExplanation}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="label-tech border-b border-border text-left text-muted-foreground">
                  <th className="py-3 font-normal">#</th>
                  <th className="font-normal">Location</th>
                  {inv.candidates[0]?.scores.map((s) => (
                    <th key={s.dimension} className="font-normal">
                      {s.dimension}
                    </th>
                  ))}
                  <th className="font-normal">Uncertainty</th>
                  <th className="text-right font-normal">Score</th>
                </tr>
              </thead>
              <tbody>
                {inv.candidates.map((c) => (
                  <tr
                    key={c.id}
                    onMouseEnter={() => setHover(c.id)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors",
                      hover === c.id && "bg-muted",
                    )}
                  >
                    <td className="py-4 font-mono text-muted-foreground">0{c.rank}</td>
                    <td>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.neighborhood}</div>
                    </td>
                    {c.scores.map((s) => (
                      <td key={s.dimension}>
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-14 bg-muted">
                            <div className="h-1 bg-primary" style={{ width: `${s.value}%` }} />
                          </div>
                          <span className="font-mono text-xs">{s.value}</span>
                        </div>
                      </td>
                    ))}
                    <td className="label-tech">{c.uncertainty}</td>
                    <td className="text-right font-mono text-base">{totalScore(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-10 border-t border-border py-10 lg:grid-cols-3">
          {inv.candidates.slice(0, 3).map((c) => (
            <div key={c.id}>
              <div className="label-tech mb-1 text-muted-foreground">Candidate 0{c.rank}</div>
              <h3 className="mb-4 text-lg font-medium">{c.name}</h3>
              <ScoreBars c={c} />
              {c.features && (
                <dl className="mt-4 space-y-2 text-xs">
                  {Object.entries(c.features).map(([key, f]) => (
                    <div key={key}>
                      <dt>
                        {key}: {f.value ?? "Unavailable"} {f.unit}
                      </dt>
                      <dd className="text-muted-foreground">
                        {f.method} · source {f.source} · {f.warning}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {c.sourceRecordIds && (
                <details className="mt-3 text-xs">
                  <summary>Source record IDs</summary>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(c.sourceRecordIds, null, 2)}
                  </pre>
                </details>
              )}
              <p className="mt-4 text-sm text-muted-foreground">{c.rationale}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-12 border-t border-border py-10 lg:grid-cols-2">
          <div>
            <h2 className="mb-4 text-2xl font-medium tracking-tight">Evidence</h2>
            <EvidenceTrail items={inv.evidence} sources={inv.sources} />
            {inv.records && (
              <details className="mt-6 text-sm">
                <summary>Inspect normalized source records and identifiers</summary>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(inv.records, null, 2)}
                </pre>
              </details>
            )}
            <h3 className="label-tech mb-3 mt-10 text-muted-foreground">
              Data provenance & freshness
            </h3>
            <ul className="divide-y divide-border border-y border-border text-sm">
              {inv.sources.map((s) => (
                <li key={s.id} className="flex flex-wrap justify-between gap-2 py-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                    {s.name} — {s.publisher}
                  </a>
                  <span className="label-tech text-muted-foreground">
                    {s.kind} · {s.freshness}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-2xl font-medium tracking-tight">Execution timeline</h2>
            <Timeline steps={inv.steps} />
            {inv.report.sensitivity && (
              <details className="mt-5 text-sm">
                <summary>Weight sensitivity (+20% per dimension)</summary>
                {Object.entries(inv.report.sensitivity).map(([dimension, result]) => (
                  <p key={dimension}>
                    {dimension}: top {result.topCandidate} ·{" "}
                    {result.topChanged ? "top changes" : "top unchanged"}
                  </p>
                ))}
              </details>
            )}
            <h3 className="label-tech mb-3 mt-10 text-muted-foreground">
              Limitations & uncertainties
            </h3>
            <ul className="space-y-2 text-sm">
              {inv.report.limitations.map((l) => (
                <li key={l} className="border-l-2 border-signal pl-3">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <div className="flex gap-3 print:hidden">
          <Button asChild variant="ink">
            <Link to="/compare" search={{ inv: inv.id }}>
              Compare candidates
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/investigate">Back to workspace</Link>
          </Button>
        </div>
      </article>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}
