import { useState } from "react";
import { Check, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import type { AgentExecutionStep, CandidateLocation, DataSource, EvidenceItem } from "@/types";
import { totalScore } from "@/lib/demo/fixtures";
import { cn } from "@/lib/utils";

export function DemoBadge({ className }: { className?: string }) {
  return <span className={cn("label-tech inline-flex border border-signal/60 bg-signal/10 px-1.5 py-0.5 text-foreground", className)}>Demo data</span>;
}

export function ScoreBars({ c, compact }: { c: CandidateLocation; compact?: boolean }) {
  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {c.scores.map((s) => (
        <div key={s.dimension}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted-foreground">{s.dimension} <span className="opacity-60">×{s.weight}</span></span>
            <span className="font-mono">{s.value}</span>
          </div>
          <div className="h-1 bg-muted">
            <div className="h-1 origin-left bg-primary transition-transform duration-700" style={{ transform: `scaleX(${s.value / 100})` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Timeline({ steps, current = steps.length }: { steps: AgentExecutionStep[]; current?: number }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "running" : "pending";
        return (
          <li key={s.id} className="relative">
            <span className={cn("absolute -left-[27px] top-0.5 grid size-3.5 place-items-center rounded-full border bg-paper", state === "done" ? "border-primary bg-primary text-primary-foreground" : state === "running" ? "border-primary" : "border-border")}>
              {state === "done" && <Check className="size-2" />}
              {state === "running" && <Loader2 className="size-2 animate-spin text-primary" />}
            </span>
            <div className="label-tech text-muted-foreground">{s.agent}</div>
            <div className={cn("text-sm transition-colors", state === "pending" ? "text-muted-foreground/60" : "text-foreground")}>{s.label}</div>
            {state !== "pending" && <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>}
          </li>
        );
      })}
    </ol>
  );
}

export function EvidenceTrail({ items, sources, filter }: { items: EvidenceItem[]; sources: DataSource[]; filter?: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = filter ? items.filter((e) => filter.includes(e.id)) : items;
  return (
    <ul className="divide-y divide-border border-y border-border">
      {list.map((e) => {
        const src = sources.find((s) => s.id === e.sourceId);
        const isOpen = open === e.id;
        return (
          <li key={e.id}>
            <button type="button" onClick={() => setOpen(isOpen ? null : e.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 py-3 text-left hover:bg-muted/50">
              <span className="label-tech mt-0.5 text-primary">{e.id.toUpperCase()}</span>
              <span className="flex-1 text-sm">{e.claim}</span>
              <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && src && (
              <div className="mb-3 ml-9 border-l-2 border-signal pl-3 text-xs text-muted-foreground">
                <div className="text-foreground">{src.name} — {src.publisher}</div>
                <div className="mt-1">Status: sample reference · {src.freshness}</div>
                <a href={src.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">Publisher page <ExternalLink className="size-3" /></a>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SourceList({ sources }: { sources: DataSource[] }) {
  return (
    <ul className="space-y-2">
      {sources.map((s) => (
        <li key={s.id} className="flex items-center gap-3 text-sm">
          <span className="size-1.5 rounded-full bg-signal" aria-hidden />
          <a href={s.url} target="_blank" rel="noreferrer" className="flex-1 hover:text-primary">{s.publisher}</a>
          <span className="label-tech text-muted-foreground">Not fetched</span>
        </li>
      ))}
    </ul>
  );
}

export function CandidateRow({ c, active, onHover, onSelect }: { c: CandidateLocation; active?: boolean; onHover?: (id: string | null) => void; onSelect?: (id: string) => void }) {
  return (
    <button
      type="button"
      onMouseEnter={() => onHover?.(c.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(c.id)}
      onClick={() => onSelect?.(c.id)}
      className={cn("w-full border-l-2 px-3 py-3 text-left transition-colors", active ? "border-signal bg-muted" : "border-transparent hover:bg-muted/60")}
    >
      <div className="flex items-baseline gap-3">
        <span className="label-tech text-muted-foreground">0{c.rank}</span>
        <span className="flex-1 text-sm font-medium">{c.name}</span>
        <span className="font-mono text-sm">{totalScore(c)}</span>
      </div>
      {active && (
        <div className="mt-3 pl-7">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{c.rationale}</p>
          <ScoreBars c={c} compact />
          <div className="label-tech mt-3 text-muted-foreground">Uncertainty · {c.uncertainty}</div>
        </div>
      )}
    </button>
  );
}
