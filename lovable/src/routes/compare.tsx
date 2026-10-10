import { api } from "@/lib/api/client";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { totalScore } from "@/lib/demo/fixtures";
import type { CandidateLocation } from "@/types";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { InvestigationMap } from "@/components/map/InvestigationMap";
import { DemoBadge, EvidenceTrail } from "@/components/investigation/parts";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/compare")({
  validateSearch: (s: Record<string, unknown>): { inv?: string } => (typeof s["inv"] === "string" ? { inv: s["inv"] } : {}),
  head: () => ({
    meta: [
      { title: "Compare candidate locations — SiteSignal AI" },
      { name: "description", content: "Side-by-side comparison of candidate sites across scoring dimensions, uncertainty and evidence." },
      { property: "og:title", content: "Compare candidate locations — SiteSignal AI" },
      { property: "og:description", content: "Weigh strengths, weaknesses and evidence for two or three candidate sites." },
    ],
  }),
  loaderDeps: ({ search }) => ({ inv: search.inv }),
  loader: async ({ deps }) => {
    const items = await api.listInvestigations();
    const selected = deps.inv ? await api.getInvestigation(deps.inv) : items[0];
    return { investigations: selected && !items.some((i) => i.id === selected.id) ? [selected, ...items] : items, selected };
  },
  component: Compare,
});

const TONES = ["stroke-primary fill-primary/15", "stroke-signal fill-signal/15", "stroke-foreground fill-foreground/10"];
const DOT = ["bg-primary", "bg-signal", "bg-foreground"];

function Radar({ cands }: { cands: CandidateLocation[] }) {
  const dims = cands[0]?.scores.map((s) => s.dimension) ?? [];
  const R = 110, cx = 140, cy = 140;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / dims.length - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)];
  };
  return (
    <svg viewBox="0 0 280 280" className="mx-auto w-full max-w-[320px]" role="img" aria-label="Score comparison radar chart">
      {[25, 50, 75, 100].map((r) => (
        <polygon key={r} points={dims.map((_, i) => pt(i, r).join(",")).join(" ")} className="fill-none stroke-border" />
      ))}
      {dims.map((d, i) => {
        const [x, y] = pt(i, 118);
        return <text key={d} x={x} y={y} textAnchor="middle" className="fill-muted-foreground text-[9px] uppercase tracking-wider">{d}</text>;
      })}
      {cands.map((c, k) => (
        <polygon key={c.id} points={c.scores.map((s, i) => pt(i, s.value).join(",")).join(" ")} className={cn("stroke-[1.5] transition-all duration-500", TONES[k])} />
      ))}
    </svg>
  );
}

function Compare() {
  const { investigations, selected } = Route.useLoaderData();
  if (!selected) return <div><SiteHeader /><p className="p-10">No persisted investigations yet. <Link to="/investigate">Start an Austin investigation</Link></p></div>;
  return <Comparison investigations={investigations} initial={selected} />;
}

function Comparison({ investigations, initial }: { investigations: import("@/types").Investigation[]; initial: import("@/types").Investigation }) {
  const [invId, setInvId] = useState(initial.id);
  const inv = investigations.find((i) => i.id === invId) ?? initial;
  const [picked, setPicked] = useState<string[]>(inv.candidates.slice(0, 2).map((c) => c.id));
  const cands = useMemo(() => inv.candidates.filter((c) => picked.includes(c.id)), [inv, picked]);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? (p.length > 1 ? p.filter((x) => x !== id) : p) : p.length < 3 ? [...p, id] : p));

  const narrative = useMemo(() => {
    if (cands.length < 2) return "Select at least two candidates.";
    const sorted = [...cands].sort((a, b) => totalScore(b) - totalScore(a));
    const top = sorted[0]!, next = sorted[1]!;
    const diffs = top.scores.map((s, i) => ({ d: s.dimension, v: s.value - next.scores[i]!.value })).sort((a, b) => b.v - a.v);
    const lead = diffs[0]!, lag = diffs[diffs.length - 1]!;
    return `${top.name} leads ${next.name} by ${totalScore(top) - totalScore(next)} points overall, driven mostly by ${lead.d.toLowerCase()} (+${lead.v}).${lag.v < 0 ? ` ${next.name} is stronger on ${lag.d.toLowerCase()} (${lag.v}).` : ""} Uncertainty is ${top.uncertainty} vs ${next.uncertainty}. ${inv.isDemo ? "All values are illustrative demo scores." : "Scores are calculated screening proxies; weights are assumptions."}`;
  }, [cands, inv.isDemo]);

  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-14 md:px-10">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3"><DemoBadge isDemo={inv.isDemo} mode={inv.dataMode} /><span className="label-tech text-muted-foreground">Comparison</span></div>
            <h1 className="display-lg">Compare candidate locations.</h1>
          </div>
          <div className="flex gap-1 border border-border bg-paper p-1" role="tablist">
            {investigations.map((i) => (
              <button key={i.id} role="tab" aria-selected={i.id === inv.id} type="button" onClick={() => { setInvId(i.id); setPicked(i.candidates.slice(0, 2).map((c) => c.id)); }} className={cn("px-3 py-1.5 text-sm transition-colors", i.id === inv.id ? "bg-foreground text-background" : "hover:bg-muted")}>{i.area.name}</button>
            ))}
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          <span className="label-tech mr-2 self-center text-muted-foreground">Select 2–3</span>
          {inv.candidates.map((c) => {
            const k = picked.indexOf(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={k >= 0} onClick={() => toggle(c.id)} className={cn("flex items-center gap-2 border px-3 py-2 text-sm transition-colors", k >= 0 ? "border-foreground bg-paper" : "border-border text-muted-foreground hover:border-foreground/40")}>
                <span className={cn("size-2 rounded-full", k >= 0 ? DOT[k] : "bg-border")} /> {c.name}
              </button>
            );
          })}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="border border-border bg-paper p-6">
            <Radar cands={cands} />
            <p className="mt-6 border-t border-border pt-4 text-sm leading-relaxed">{narrative}</p>
          </div>
          <div className="h-[420px] border border-border">
            <InvestigationMap investigation={inv} activeLayers={inv.layers.map((l) => l.id)} highlightIds={picked} onSelect={toggle} key={inv.id} />
          </div>
        </div>

        <div className={cn("mt-8 grid gap-px border border-border bg-border", cands.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {cands.map((c, k) => (
            <div key={c.id} className="bg-paper p-6">
              <div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", DOT[k])} /><span className="label-tech text-muted-foreground">Rank 0{c.rank}</span></div>
              <h2 className="mt-2 text-xl font-medium">{c.name}</h2>
              <div className="mt-1 font-mono text-3xl">{totalScore(c)}</div>
              <dl className="mt-5 space-y-2 text-sm">
                {c.scores.map((s) => (
                  <div key={s.dimension} className="flex items-center gap-3">
                    <dt className="w-32 text-muted-foreground">{s.dimension}</dt>
                    <dd className="h-1 flex-1 bg-muted"><div className={cn("h-1 transition-all duration-500", DOT[k])} style={{ width: `${s.value}%` }} /></dd>
                    <span className="w-8 text-right font-mono text-xs">{s.value}</span>
                  </div>
                ))}
              </dl>
              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div><div className="label-tech mb-1 text-muted-foreground">Strengths</div><ul className="space-y-1">{c.strengths.map((s) => <li key={s}>+ {s}</li>)}</ul></div>
                <div><div className="label-tech mb-1 text-muted-foreground">Weaknesses</div><ul className="space-y-1">{c.weaknesses.map((s) => <li key={s}>− {s}</li>)}</ul></div>
              </div>
              <div className="label-tech mt-5 text-muted-foreground">Data uncertainty · {c.uncertainty}</div>
              <div className="mt-4"><EvidenceTrail items={inv.evidence} sources={inv.sources} filter={c.evidenceIds} /></div>
            </div>
          ))}
        </div>
        <div className="mt-8"><Link to="/investigations/$id" params={{ id: inv.id }} className="text-sm text-primary hover:underline">Open the full {inv.area.name} report →</Link></div>
      </main>
      <SiteFooter />
    </div>
  );
}
