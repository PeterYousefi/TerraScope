export type LngLat = [number, number];

export interface GeographicArea {
  name: string;
  region: string;
  center: LngLat;
  bounds: [LngLat, LngLat];
  zoom: number;
}

export interface InvestigationQuestion {
  text: string;
  type: "ev-charging" | "retail" | "mobility";
}

export type StepStatus = "pending" | "running" | "done";

export interface AgentExecutionStep {
  id: string;
  agent: string;
  label: string;
  detail: string;
  durationMs: number;
  timestamp?: string;
  status?: "running" | "done" | "failed" | "skipped";
}

export interface DataSource {
  id: string;
  name: string;
  publisher: string;
  url: string;
  kind: "public-dataset" | "api" | "derived";
  /** "sample" = illustrative reference; not fetched in demo mode */
  status: "sample" | "fetched" | "cached" | "failed";
  retrievedAt?: string;
  recordCount?: number;
  parameters?: Record<string, unknown>;
  warnings?: string[];
  freshness: string;
}

export interface EvidenceItem {
  id: string;
  sourceId: string;
  claim: string;
  candidateIds: string[];
}

export interface CandidateScore {
  dimension: string;
  value: number; // 0-100, illustrative
  weight: number;
}

export interface CandidateLocation {
  id: string;
  name: string;
  neighborhood: string;
  coords: LngLat;
  rank: number;
  scores: CandidateScore[];
  rationale: string;
  strengths: string[];
  weaknesses: string[];
  uncertainty: "low" | "medium" | "high";
  evidenceIds: string[];
  geometry?: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
  totalScore?: number;
  features?: Record<string, { value: number | null; unit: string; source: string; method: string; warning?: string | null }>;
  sourceRecordIds?: Record<string, string[]>;
}

export interface MapLayer {
  id: string;
  label: string;
  kind: "existing" | "demand" | "gap";
  color: "primary" | "signal" | "ink";
  points: { coords: LngLat; label: string; value?: number }[];
}

export interface InvestigationReport {
  summary: string;
  findings: string[];
  limitations: string[];
  rankingExplanation: string;
  aiGenerated?: boolean;
  aiStatus?: string;
  aiExplanation?: string[];
  sensitivity?: Record<string, { weightMultiplier: number; topCandidate: string; topChanged: boolean }>;
  weights?: Record<string, number>;
}

export interface Investigation {
  id: string;
  title: string;
  question: InvestigationQuestion;
  area: GeographicArea;
  status: "complete" | "running" | "draft" | "queued" | "completed" | "completed_with_warnings" | "failed";
  createdAt: string;
  steps: AgentExecutionStep[];
  candidates: CandidateLocation[];
  sources: DataSource[];
  evidence: EvidenceItem[];
  layers: MapLayer[];
  report: InvestigationReport;
  isDemo: boolean;
  dataMode?: "live" | "cached" | "mixed";
  warnings?: string[];
  records?: Record<string, unknown>;
}
