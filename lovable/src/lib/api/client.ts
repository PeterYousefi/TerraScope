import type { Investigation } from "@/types";
import { getDemoInvestigation, investigations, matchQuestion } from "@/lib/demo/fixtures";

/**
 * Centralized API client. When VITE_API_BASE_URL is unset the app runs in
 * DEMO MODE using deterministic fixtures and makes no network requests.
 * Intended backend contracts (not yet existing):
 *   POST /api/investigations         GET /api/investigations/:id
 *   GET  /api/investigations/:id/events|candidates|evidence   GET /api/health
 */
const BASE = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.replace(/\/$/, "");

export const isDemoMode = !BASE;

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  async listInvestigations(): Promise<Investigation[]> {
    if (isDemoMode) return investigations;
    return http("/api/investigations");
  },
  async getInvestigation(id: string): Promise<Investigation | null> {
    if (isDemoMode) return getDemoInvestigation(id) ?? null;
    return http(`/api/investigations/${encodeURIComponent(id)}`);
  },
  async createInvestigation(question: string, area?: string): Promise<Investigation> {
    if (isDemoMode) return matchQuestion(`${question} ${area ?? ""}`);
    return http("/api/investigations", { method: "POST", body: JSON.stringify({ question, area }) });
  },
};
