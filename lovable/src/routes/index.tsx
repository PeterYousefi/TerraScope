import { createFileRoute, Link, ClientOnly } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CinematicSequence } from "@/components/landing/CinematicSequence";
import { InvestigationPreview } from "@/components/landing/InvestigationPreview";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SiteSignal AI — Ask a question. Investigate a place." },
      { name: "description", content: "A cinematic 3D geospatial investigation platform that turns location questions into evidence-backed findings." },
      { property: "og:title", content: "SiteSignal AI — Ask a question. Investigate a place." },
      { property: "og:description", content: "From planetary scale to the street: explore infrastructure, demand and opportunity with transparent evidence." },
    ],
  }),
  component: Landing,
});

function HeroFallback() {
  return (
    <div className="flex h-svh items-center bg-ink text-ink-foreground">
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <h1 className="display-xl max-w-2xl">Every place has a story hidden in its data.</h1>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <main>
      <SiteHeader tone="dark" fixed />
      <ClientOnly fallback={<HeroFallback />}>
        <CinematicSequence />
      </ClientOnly>
      <div className="h-40 bg-dusk" aria-hidden />
      <InvestigationPreview />
      <section className="border-t border-border bg-paper">
        <div className="mx-auto max-w-[1400px] px-6 py-28 md:px-10 md:py-40">
          <div className="label-tech mb-6 text-muted-foreground">06 · Begin</div>
          <h2 className="display-xl max-w-4xl">Stop guessing where. Start understanding why.</h2>
          <p className="mt-8 max-w-md text-lg text-muted-foreground">Investigate any place through the signals that shape it.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="default" size="lg"><Link to="/investigate">Open SiteSignal <ArrowRight /></Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/methodology">See how it works</Link></Button>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
