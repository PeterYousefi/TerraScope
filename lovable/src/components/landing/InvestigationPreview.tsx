import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { investigations, totalScore } from "@/lib/demo/fixtures";
import { toCity } from "@/components/three/sceneState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SEQ = [
  "Question received",
  "Area identified",
  "Infrastructure signals loaded",
  "Candidate zones evaluated",
  "Evidence organized",
  "Findings ready",
];
const inv = investigations[0]!;

/** Schematic map (SVG) — the live MapLibre map lives in the workspace. */
function SchematicMap({
  hover,
  onHover,
}: {
  hover: string | null;
  onHover: (id: string | null) => void;
}) {
  const P = (lon: number, lat: number) => {
    const [x, z] = toCity(lon, lat);
    return [300 + x * 14, 250 + z * 11] as const;
  };
  return (
    <svg
      viewBox="0 0 600 500"
      className="h-full w-full"
      role="img"
      aria-label="Schematic map of Austin demo layers"
    >
      <defs>
        <pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" className="stroke-border" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="600" height="500" fill="url(#g)" />
      <path
        d="M0 270 C120 250 220 300 320 262 S520 270 600 290"
        className="stroke-primary/25"
        strokeWidth="10"
        fill="none"
      />
      <path
        d="M350 500 L318 270 L322 150 L345 0"
        className="stroke-foreground/30"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M140 60 L270 70 L400 110 L460 250"
        className="stroke-foreground/20"
        strokeWidth="2"
        fill="none"
      />
      {inv.layers[0]!.points.map((p) => {
        const [x, y] = P(...p.coords);
        return <circle key={p.label} cx={x} cy={y} r="4" className="fill-foreground/60" />;
      })}
      {inv.layers[1]!.points.map((p) => {
        const [x, y] = P(...p.coords);
        return (
          <circle
            key={p.label}
            cx={x}
            cy={y}
            r={(p.value ?? 50) / 2.4}
            className="fill-primary/10 stroke-primary/40"
          />
        );
      })}
      {inv.candidates.map((c) => {
        const [x, y] = P(...c.coords);
        const on = hover === c.id;
        return (
          <g
            key={c.id}
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
            className="cursor-pointer"
          >
            <circle cx={x} cy={y} r={on ? 22 : 14} className="fill-signal/20 transition-all" />
            <circle
              cx={x}
              cy={y}
              r="9"
              className={cn("transition-colors", on ? "fill-foreground" : "fill-signal")}
            />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              className={cn(
                "text-[10px] font-semibold",
                on ? "fill-background" : "fill-foreground",
              )}
            >
              {c.rank}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function InvestigationPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(-1);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timers: number[] = [];
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.isIntersecting && step === -1) {
          timers = SEQ.map((_, i) => window.setTimeout(() => setStep(i), 450 + i * 650));
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, [step]);

  const done = step >= SEQ.length - 1;

  return (
    <section className="bg-background py-24 md:py-36">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="label-tech mb-4 text-muted-foreground">05 · The workspace</div>
            <h2 className="display-lg max-w-3xl">
              Where should Austin build its next EV charging station?
            </h2>
          </div>
          <Button asChild variant="ink" size="lg">
            <Link to="/investigate">
              Run it yourself <ArrowRight />
            </Link>
          </Button>
        </div>

        <div
          ref={ref}
          className="grid overflow-hidden border border-border bg-paper lg:grid-cols-[260px_1fr_340px]"
        >
          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
            <div className="label-tech mb-3 text-muted-foreground">Question</div>
            <p className="text-sm leading-relaxed">{inv.question.text}</p>
            <div className="label-tech mb-3 mt-8 text-muted-foreground">Investigation</div>
            <ol className="space-y-3">
              {SEQ.map((s, i) => (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-3 text-sm transition-colors",
                    i <= step ? "text-foreground" : "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-full border",
                      i < step || done
                        ? "border-primary bg-primary text-primary-foreground"
                        : i === step
                          ? "border-primary"
                          : "border-border",
                    )}
                  >
                    {i < step || (done && i === step) ? (
                      <Check className="size-2.5" />
                    ) : i === step ? (
                      <Loader2 className="size-2.5 animate-spin text-primary" />
                    ) : null}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <div className="relative aspect-[6/5] lg:aspect-auto">
            <SchematicMap hover={hover} onHover={setHover} />
            <div className="label-tech absolute left-4 top-4 bg-paper/90 px-2 py-1 text-muted-foreground">
              Austin, TX · demo layers
            </div>
          </div>
          <div className="border-t border-border p-5 lg:border-l lg:border-t-0">
            <div className="label-tech mb-4 text-muted-foreground">Ranked candidates</div>
            <ul
              className={cn(
                "space-y-1 transition-opacity duration-700",
                step >= 3 ? "opacity-100" : "opacity-20",
              )}
            >
              {inv.candidates.map((c) => (
                <li
                  key={c.id}
                  onMouseEnter={() => setHover(c.id)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "flex items-center gap-3 border-l-2 px-3 py-2.5 transition-colors",
                    hover === c.id ? "border-signal bg-muted" : "border-transparent",
                  )}
                >
                  <span className="label-tech text-muted-foreground">0{c.rank}</span>
                  <span className="flex-1 text-sm">{c.name}</span>
                  <span className="font-mono text-sm">{totalScore(c)}</span>
                </li>
              ))}
            </ul>
            <div
              className={cn(
                "mt-6 border-t border-border pt-4 transition-opacity duration-700",
                done ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="label-tech mb-2 text-muted-foreground">Explanation</div>
              <p className="text-sm leading-relaxed text-muted-foreground">{inv.report.summary}</p>
              <div className="label-tech mt-4 text-muted-foreground">
                Evidence · {inv.evidence.length} sample references
              </div>
            </div>
          </div>
        </div>
        <p className="label-tech mt-4 text-muted-foreground">
          Deterministic demo sequence · no live AI or external API calls
        </p>
      </div>
    </section>
  );
}
