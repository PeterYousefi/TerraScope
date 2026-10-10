import type { Investigation } from "@/types";
import { getDemoInvestigation, investigations, matchQuestion } from "@/lib/demo/fixtures";

const BASE = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000"
).replace(/\/$/, "");
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new Error(
      `Cannot connect to SiteSignal backend at ${BASE}. Start FastAPI on port 8000 and check CORS_ORIGINS.`,
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `API ${res.status}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listInvestigations(): Promise<Investigation[]> {
    return isDemoMode ? investigations : http("/api/investigations");
  },
  async getInvestigation(id: string): Promise<Investigation | null> {
    // Landing previews link to explicitly labeled demo reports.
    const demo = getDemoInvestigation(id);
    if (demo) return demo;
    return http(`/api/investigations/${encodeURIComponent(id)}`);
  },
  async capabilities(): Promise<{ aiAvailable: boolean; missingConfiguration: string[] }> {
    return http("/api/capabilities");
  },
  async createInvestigation(question: string, area?: string): Promise<Investigation> {
    if (isDemoMode) return matchQuestion(`${question} ${area ?? ""}`);
    return http("/api/investigations", {
      method: "POST",
      body: JSON.stringify({ question, area }),
    });
  },
};
