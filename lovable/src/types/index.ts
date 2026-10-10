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
}

export interface DataSource {
  id: string;
  name: string;
  publisher: string;
  url: string;
  kind: "public-dataset" | "api" | "derived";
  /** "sample" = illustrative reference; not fetched in demo mode */
  status: "sample" | "fetched";
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
}

export interface Investigation {
  id: string;
  title: string;
  question: InvestigationQuestion;
  area: GeographicArea;
  status: "complete" | "running" | "draft";
  createdAt: string;
  steps: AgentExecutionStep[];
  candidates: CandidateLocation[];
  sources: DataSource[];
  evidence: EvidenceItem[];
  layers: MapLayer[];
  report: InvestigationReport;
  isDemo: boolean;
}
