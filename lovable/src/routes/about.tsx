import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — SiteSignal AI" },
      {
        name: "description",
        content:
          "A portfolio-scale engineering project exploring agentic AI, geographic data, and evidence provenance.",
      },
      { property: "og:title", content: "About — SiteSignal AI" },
      { property: "og:description", content: "Why SiteSignal exists and how it is built." },
    ],
  }),
  component: About,
});

const THEMES = [
  "Agentic AI systems",
  "Geographic data",
  "Tool orchestration",
  "Evidence provenance",
  "Explainable ranking",
  "Full-stack engineering",
  "Local development",
];

function About() {
  return (
    <div className="min-h-svh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 md:px-10">
        <section className="grid gap-12 border-b border-border py-20 md:grid-cols-[1fr_1.3fr]">
          <div className="label-tech text-muted-foreground">About the project</div>
          <div>
            <h1 className="display-lg">An instrument for asking better questions about places.</h1>
            <p className="mt-8 text-lg leading-relaxed text-muted-foreground">
              SiteSignal AI is a portfolio-scale engineering project. It explores how AI agents can
              plan a geographic investigation, call real data tools, and produce conclusions a
              reader can trace back to sources — instead of a confident paragraph with nothing
              behind it.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Austin EV charging investigations connect to a local Python backend that retrieves
              public datasets and calculates opportunity-area scores. Missing keys and provider
              failures remain visible. The cinematic landing previews use explicitly labeled
              illustrative data.
            </p>
          </div>
        </section>
        <section className="grid gap-12 border-b border-border py-20 md:grid-cols-[1fr_1.3fr]">
          <div className="label-tech text-muted-foreground">Intersections</div>
          <ol className="divide-y divide-border border-y border-border">
            {THEMES.map((t, i) => (
              <li
                key={t}
                className="flex items-baseline gap-6 py-4 text-2xl font-medium tracking-tight"
              >
                <span className="label-tech text-signal">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </section>
        <section className="grid gap-12 py-20 md:grid-cols-[1fr_1.3fr]">
          <div className="label-tech text-muted-foreground">Architecture</div>
          <div className="space-y-6 text-muted-foreground">
            <p>
              <span className="text-foreground">Frontend —</span> React, TypeScript, Tailwind, React
              Three Fiber for the 3D narrative, GSAP ScrollTrigger for scroll-scrubbed camera,
              MapLibre GL for the workspace.
            </p>
            <p>
              <span className="text-foreground">API layer —</span> a typed client connects to the
              local backend via <code className="font-mono text-foreground">VITE_API_BASE_URL</code>
              .
            </p>
            <p>
              <span className="text-foreground">Local backend —</span> FastAPI, HTTPX,
              SQLAlchemy/SQLite, Shapely and PyProj, with optional structured OpenAI planning and
              evidence selection.
            </p>
            <p className="label-tech">
              Scope · Austin EV charging opportunity areas; property feasibility remains unassessed.
            </p>
            <div className="flex gap-3 pt-4">
              <Button asChild variant="ink">
                <Link to="/methodology">Read the methodology</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/investigate">Try the workspace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
