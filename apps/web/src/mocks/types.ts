// Shapes mirror the planned API / SSE contract (docs/ARCHITECTURE.md).

export type Role = "guest" | "founder" | "admin";

export type AgentId =
  | "interviewer"
  | "analyst"
  | "product"
  | "ux"
  | "architect"
  | "estimator"
  | "critic"
  | "backlog"
  | "researcher";

export type AgentStatus = "queued" | "working" | "done" | "error";

export interface Agent {
  id: AgentId;
  name: string;
  job: string;
}

export interface QuestionOption {
  id: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  title: string;
  body: string;
  options: QuestionOption[];
  recommended: string; // option id
  multi?: boolean;
}

export interface QuestionRound {
  round: number;
  questions: Question[];
}

export type Complexity = "S" | "M" | "L" | "XL";
export type Moscow = "must" | "should" | "could" | "wont";

export interface Feature {
  id: string;
  name: string;
  description: string;
  complexity: Complexity;
  moscow: Moscow;
  hours: number;
  included: boolean;
}

export interface Screen {
  id: string;
  name: string;
  purpose: string;
  wireframe: WireBlock[];
}

/** Minimal low-fi wireframe description: rows of blocks rendered as boxes. */
export interface WireBlock {
  kind: "nav" | "header" | "text" | "input" | "button" | "card" | "list" | "image" | "chart" | "tabs";
  span?: 1 | 2 | 3 | 4; // of a 4-col grid
  label?: string;
}

export interface StackChoice {
  layer: string;
  choice: string;
  why: string;
  alternative: string;
}

export interface Phase {
  name: string;
  weeks: number;
  deliverables: string[];
}

export interface Risk {
  title: string;
  impact: "low" | "medium" | "high";
  mitigation: string;
}

export interface Competitor {
  name: string;
  url: string;
  note: string;
}

export interface PlanVersion {
  id: string;
  label: string;
  createdAt: string;
  priceMin: number;
  priceMax: number;
  weeks: number;
  change: string;
}

export interface PlanFile {
  id: string;
  name: string;
  kind: "pdf" | "md" | "csv" | "json" | "mmd" | "zip";
  size: string;
  preview?: string;
}

export interface Plan {
  id: string;
  title: string;
  oneLiner: string;
  problem: string;
  audience: string[];
  readiness: number;
  readinessNotes: string[];
  features: Feature[];
  screens: Screen[];
  stack: StackChoice[];
  phases: Phase[];
  team: string[];
  hourlyRate: number;
  buffer: number; // e.g. 0.2 = 20%
  risks: Risk[];
  assumptions: string[];
  competitors: Competitor[];
  versions: PlanVersion[];
  files: PlanFile[];
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
  status: "interviewing" | "generating" | "ready";
}

/** Events played by the mock stream — same names as the real SSE contract. */
export type StreamEvent =
  | { type: "message"; role: "user" | "assistant"; text: string }
  | { type: "question.round"; round: QuestionRound }
  | { type: "agent.status"; agent: AgentId; status: AgentStatus }
  | { type: "agent.note"; agent: AgentId; text: string }
  | { type: "agent.reasoning"; agent: AgentId; text: string }
  | { type: "file.ready"; file: PlanFile }
  | { type: "booking.suggest"; reason: string }
  | { type: "error"; title: string; message: string; action: string }
  | { type: "done"; planId: string };

export interface LeadActivity {
  at: string; // ISO date-time
  kind: "signup" | "plan" | "version" | "file" | "booking" | "email" | "note";
  text: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  country: string;
  timezone: string;
  source: "Google" | "LinkedIn" | "Referral" | "Direct" | "X";
  idea: string;
  budget: string;
  status: "new" | "booked" | "contacted" | "won" | "lost";
  signedUpAt: string; // ISO date-time
  lastActiveAt: string; // ISO date-time
  plans: { id: string; title: string; version: string; priceMin: number; priceMax: number; weeks: number }[];
  call?: { at: string; status: "scheduled" | "done" | "no-show" | "cancelled"; meetUrl?: string };
  downloads: number;
  activity: LeadActivity[];
  notes?: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  text: string;
  scope: "long" | "short";
  createdAt: string;
}
