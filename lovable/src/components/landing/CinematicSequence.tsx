import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PHASE, band, sceneState, seg } from "@/components/three/sceneState";
import { CITY_LABELS } from "@/components/three/cityLabels";
import { Button } from "@/components/ui/button";

const CinematicCanvas = lazy(() => import("@/components/three/CinematicCanvas"));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const REVEALS = [
  { at: 0.6, label: "Existing charging stations" },
  { at: 0.66, label: "Activity density" },
  { at: 0.71, label: "Major road connections" },
  { at: 0.76, label: "Infrastructure gaps" },
  { at: 0.8, label: "Candidate locations" },
];

const CAPS = [
  { at: [0.86, 0.905], k: "01", t: "Observe", d: "Gather geographic signals from public data." },
  {
    at: [0.905, 0.945],
    k: "02",
    t: "Investigate",
    d: "Coordinate specialized AI reasoning steps.",
  },
  { at: [0.945, 1.01], k: "03", t: "Verify", d: "Trace conclusions back to evidence and sources." },
];

export function CinematicSequence() {
  const pinRef = useRef<HTMLDivElement>(null);
  const els = useRef<Record<string, HTMLElement | null>>({});
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const r = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sceneState.reduced = r;
    sceneState.lite = window.innerWidth < 768;
    sceneState.p = 0;
    setReduced(r);
    setWebgl(hasWebGL());
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      sceneState.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      sceneState.pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
      const t = sceneState.tooltipEl;
      if (t) t.style.transform = `translate3d(${e.clientX + 16}px, ${e.clientY - 12}px, 0)`;
      const d = sceneState.drag;
      if (d.active) {
        const dx = e.clientX - d.lastX;
        d.lastX = e.clientX;
        d.velocity = dx * 0.25;
      }
    };
    const onUp = () => (sceneState.drag.active = false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (webgl === null || reduced || !pinRef.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const apply = (p: number) => {
      const e = els.current;
      const set = (k: string, o: number, y = 0) => {
        const el = e[k];
        if (!el) return;
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        el.style.pointerEvents = o > 0.5 ? "auto" : "none";
      };
      const s1 = 1 - seg(p, 0.03, 0.1);
      set("s1", s1, -(1 - s1) * 60);
      set("hint", 1 - seg(p, 0, 0.03));
      const s2 = band(p, 0.2, 0.42, 0.04);
      set("s2", s2, (1 - s2) * 30);
      set("reticle", band(p, 0.26, 0.47, 0.04));
      set("veil", band(p, PHASE.veilPeak, PHASE.veilPeak, 0.055));
      set("s3", band(p, 0.58, 0.83, 0.03));
      REVEALS.forEach((r, i) => set(`r${i}`, 0.25 + 0.75 * seg(p, r.at, r.at + 0.02)));
      const s4 = seg(p, 0.85, 0.88);
      set("s4", s4, (1 - s4) * 30);
      CAPS.forEach((c, i) => set(`c${i}`, 0.3 + 0.7 * band(p, c.at[0]!, c.at[1]!, 0.01)));
      const bar = e["progress"];
      if (bar) bar.style.transform = `scaleX(${p})`;
    };
    apply(0);
    const ctx = gsap.context(() => {
      const state = { p: 0 };
      gsap.to(state, {
        p: 1,
        ease: "none",
        scrollTrigger: {
          trigger: pinRef.current,
          start: "top top",
          end: sceneState.lite ? "+=520%" : "+=750%",
          pin: true,
          scrub: 1.1,
        },
        onUpdate: () => {
          sceneState.p = state.p;
          apply(state.p);
        },
      });
    });
    return () => {
      ctx.revert();
      sceneState.p = 0;
    };
  }, [webgl, reduced]);

  const reg = (k: string) => (el: HTMLElement | null) => {
    els.current[k] = el;
  };

  return (
    <div ref={pinRef} className="relative h-svh w-full overflow-hidden bg-ink text-ink-foreground">
      <div
        className="absolute inset-0 touch-pan-y"
        onPointerDown={(e) => {
          if (sceneState.p < 0.05) {
            sceneState.drag.active = true;
            sceneState.drag.lastX = e.clientX;
          }
        }}
      >
        {webgl && (
          <Suspense fallback={null}>
            <CinematicCanvas />
          </Suspense>
        )}
        {webgl === false && <div className="grid-paper absolute inset-0 opacity-10" aria-hidden />}
      </div>

      {/* 3D-anchored labels, positioned by LabelProjector */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {CITY_LABELS.map((l) => (
          <div
            key={l.id}
            ref={(el) => {
              sceneState.labelEls[l.id] = el;
            }}
            className="absolute left-0 top-0 opacity-0 will-change-transform"
          >
            <div className="-mt-9 ml-2 whitespace-nowrap border-l border-signal pl-2">
              <div className="label-tech text-ink-foreground">{l.text}</div>
              {l.sub && <div className="label-tech text-ink-muted">{l.sub}</div>}
            </div>
          </div>
        ))}
      </div>
      <div
        ref={(el) => {
          sceneState.tooltipEl = el;
        }}
        className="pointer-events-none fixed left-0 top-0 z-50 border border-ink-border bg-ink/90 px-3 py-2 opacity-0 transition-opacity"
      >
        <div data-sub className="label-tech text-signal" />
        <div data-name className="text-sm font-medium" />
      </div>

      {/* veil masks the planetary → city camera switch */}
      <div ref={reg("veil")} className="pointer-events-none absolute inset-0 bg-ink opacity-0" />

      {/* SCENE 1 */}
      <div ref={reg("s1")} className="pointer-events-none absolute inset-0 flex items-center">
        <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
          <div className="max-w-2xl">
            <div className="label-tech mb-6 flex items-center gap-3 text-ink-muted">
              <span className="h-px w-8 bg-signal" /> SiteSignal AI · Geospatial investigation
            </div>
            <h1 className="display-xl">Every place has a story hidden in its data.</h1>
            <p className="mt-8 max-w-lg text-base leading-relaxed text-ink-muted md:text-lg">
              SiteSignal turns geographic questions into evidence-backed investigations. Explore
              infrastructure, demand, accessibility, and opportunity through an AI-powered spatial
              intelligence system.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild variant="signal" size="lg">
                <Link to="/investigate">
                  Start an investigation <ArrowRight />
                </Link>
              </Button>
              <Button
                variant="ghostInk"
                size="lg"
                onClick={() =>
                  window.scrollBy({
                    top: window.innerHeight * 2.4,
                    behavior: reduced ? "auto" : "smooth",
                  })
                }
              >
                Explore the experience
              </Button>
            </div>
            {webgl === false && (
              <p className="label-tech mt-6 text-ink-muted">
                3D is unavailable on this device — the full app still works.
              </p>
            )}
          </div>
        </div>
      </div>
      <div
        ref={reg("hint")}
        className="pointer-events-none absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-ink-muted"
      >
        <span className="label-tech">Scroll to descend</span>
        <ArrowDown className="size-4 animate-bounce" />
      </div>
      <div className="label-tech pointer-events-none absolute bottom-8 right-6 hidden text-ink-muted md:block">
        Drag to rotate · click a marker
      </div>

      {/* SCENE 2 */}
      <div ref={reg("s2")} className="pointer-events-none absolute inset-x-0 bottom-0 opacity-0">
        <div className="mx-auto max-w-[1400px] px-6 pb-16 md:px-10">
          <h2 className="display-lg max-w-3xl">
            From the entire planet to the question that matters.
          </h2>
          <p className="mt-5 max-w-md text-ink-muted">
            Start broad. Find the signals. Follow the evidence down to the street.
          </p>
        </div>
      </div>
      <div
        ref={reg("reticle")}
        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0"
      >
        <div className="relative size-40 md:size-56">
          <span className="absolute left-0 top-0 h-5 w-5 border-l border-t border-signal" />
          <span className="absolute right-0 top-0 h-5 w-5 border-r border-t border-signal" />
          <span className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-signal" />
          <span className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-signal" />
          <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 bg-signal" />
          <span className="absolute left-1/2 top-1/2 h-6 w-px -translate-y-1/2 bg-signal" />
          <div className="absolute left-full top-0 ml-4 whitespace-nowrap">
            <div className="label-tech text-signal">30.2672° N / 97.7431° W</div>
            <div className="label-tech mt-1 text-ink-foreground">Austin, Texas</div>
            <div className="label-tech mt-1 text-ink-muted">Target acquired</div>
          </div>
        </div>
      </div>

      {/* SCENE 3 */}
      <div
        ref={reg("s3")}
        className="pointer-events-none absolute left-6 top-24 opacity-0 md:left-10"
      >
        <div className="label-tech mb-4 text-signal">Austin · infrastructure reveal</div>
        <ol className="space-y-2">
          {REVEALS.map((r, i) => (
            <li key={r.label} ref={reg(`r${i}`)} className="flex items-center gap-3 text-sm">
              <span className="label-tech text-ink-muted">0{i + 1}</span>
              {r.label}
            </li>
          ))}
        </ol>
        <div className="label-tech mt-6 text-ink-muted">Illustrative demo layers</div>
      </div>

      {/* SCENE 4 */}
      <div ref={reg("s4")} className="pointer-events-none absolute inset-x-0 bottom-0 opacity-0">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-6 pb-14 md:grid-cols-[1.2fr_1fr] md:px-10">
          <h2 className="display-lg">A map shows you where. Intelligence helps explain why.</h2>
          <div className="grid gap-5 self-end">
            {CAPS.map((c, i) => (
              <div
                key={c.t}
                ref={reg(`c${i}`)}
                className="flex gap-4 border-t border-ink-border pt-4"
              >
                <span className="label-tech text-signal">{c.k}</span>
                <div>
                  <div className="text-lg font-medium">{c.t}</div>
                  <div className="text-sm text-ink-muted">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 h-px bg-ink-border">
        <div ref={reg("progress")} className="h-px origin-left scale-x-0 bg-signal" />
      </div>
    </div>
  );
}
