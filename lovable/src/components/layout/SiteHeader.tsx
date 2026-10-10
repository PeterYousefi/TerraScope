import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/api/client";

const NAV = [
  { to: "/investigate", label: "Investigate" },
  { to: "/compare", label: "Compare" },
  { to: "/methodology", label: "Methodology" },
  { to: "/about", label: "About" },
] as const;

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="relative grid size-6 place-items-center rounded-full border border-current">
        <span className="size-1.5 rounded-full bg-signal" />
      </span>
      <span
        className={cn(
          "text-[15px] font-medium tracking-tight",
          tone === "dark" ? "text-ink-foreground" : "text-foreground",
        )}
      >
        SiteSignal <span className="text-muted-foreground">AI</span>
      </span>
    </Link>
  );
}

export function SiteHeader({
  tone = "light",
  fixed = false,
}: {
  tone?: "light" | "dark";
  fixed?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <header
      className={cn(
        "z-40 w-full",
        fixed ? "fixed inset-x-0 top-0" : "sticky top-0",
        dark
          ? "text-ink-foreground"
          : "border-b border-border bg-background/85 text-foreground backdrop-blur",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 md:px-10">
        <Logo tone={tone} />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "label-tech transition-colors",
                dark
                  ? "text-ink-muted hover:text-ink-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              activeProps={{ className: dark ? "!text-ink-foreground" : "!text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <span
              className={cn(
                "label-tech hidden border px-2 py-1 sm:inline",
                dark ? "border-ink-border text-signal" : "border-signal/60 text-foreground",
              )}
            >
              Demo mode
            </span>
          )}
          <Link
            to="/investigate"
            className={cn("label-tech md:hidden", dark ? "text-ink-foreground" : "text-foreground")}
          >
            Open app
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <Logo />
        <nav className="flex flex-wrap gap-6">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="label-tech text-muted-foreground hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="label-tech text-muted-foreground">
          Portfolio project · demo data is illustrative
        </p>
      </div>
    </footer>
  );
}
