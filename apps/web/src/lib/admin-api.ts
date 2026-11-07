/**
 * Admin API types and wrappers (`/api/v1/admin/*`). Every endpoint requires an admin
 * (the API answers 403 `admin_only` otherwise).
 */
import { ApiError, request } from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";

export type ChatStatus = "interviewing" | "generating" | "ready" | "failed";
export type LeadStatus = "new" | "booked" | "contacted" | "won" | "lost";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type KeySource = "db" | "env" | "missing";

export const LEAD_STATUSES: LeadStatus[] = ["new", "booked", "contacted", "won", "lost"];

export interface Overview {
  stats: { users: number; chats: number; plans: number; agentRuns: number; costUsd30d: string };
  plans: AdminPlanRow[];
}

export interface AdminPlanRow {
  chatId: string;
  planId: string | null;
  title: string;
  ownerEmail: string | null;
  status: ChatStatus;
  priceMin: number | null;
  priceMax: number | null;
  weeks: number | null;
  updatedAt: string;
}

export interface LeadPlan {
  id: string;
  title: string;
  version: string;
  priceMin: number;
  priceMax: number;
  weeks: number;
}

export interface AdminLead {
  id: string;
  name: string | null;
  email: string;
  signedUpAt: string;
  lastActiveAt: string | null;
  status: LeadStatus;
  notes: string | null;
  idea: string | null;
  budget: string | null;
  chats: number;
  costUsd: string;
  plans: LeadPlan[];
}

/** Snake_case, exactly as the API stores it. */
export interface CatalogModel {
  id: string;
  label: string;
  enabled: boolean;
  price: { input: string; output: string; cache_read: string | null; cache_write: string | null };
  capabilities: { structured_output: boolean; thinking: boolean; web_search: boolean };
}

export interface Catalog {
  models: CatalogModel[];
  default_model: string;
  fallback_models: string[];
  agent_models: Record<string, string>;
  agent_effort: Record<string, Effort>;
  disabled_providers: string[];
}

export interface ModelsResponse {
  catalog: Catalog;
  agents: string[];
  isDefault: boolean;
}

export interface ProviderKey {
  provider: string;
  label: string;
  envVar: string;
  source: KeySource;
  last4: string | null;
  lastTestOk: boolean | null;
  updatedAt: string | null;
}

export interface KeyTestResult {
  ok: boolean;
  message: string;
}

export interface Pricing {
  currency: string;
  hourly_rate: number;
  buffer: number;
  spread: number;
  price_round_to: number;
  base_hours: number;
  hours_per_week: number;
  team_size: number;
  min_weeks: number;
  complexity_hours: { S: number; M: number; L: number; XL: number };
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const adminApi = {
  overview: () => request<Overview>("/admin/overview"),
  leads: () => request<AdminLead[]>("/admin/leads"),
  updateLead: (id: string, patch: { status?: LeadStatus; notes?: string }) =>
    request<AdminLead>(`/admin/leads/${encodeURIComponent(id)}`, { method: "PATCH", ...json(patch) }),
  models: () => request<ModelsResponse>("/admin/models"),
  saveModels: (catalog: Catalog) => request<ModelsResponse>("/admin/models", { method: "PUT", ...json(catalog) }),
  keys: () => request<ProviderKey[]>("/admin/keys"),
  saveKey: (provider: string, key: string) =>
    request<ProviderKey>(`/admin/keys/${encodeURIComponent(provider)}`, { method: "PUT", ...json({ key }) }),
  deleteKey: (provider: string) =>
    request<ProviderKey>(`/admin/keys/${encodeURIComponent(provider)}`, { method: "DELETE" }),
  testKey: (provider: string) =>
    request<KeyTestResult>(`/admin/keys/${encodeURIComponent(provider)}/test`, { method: "POST" }),
  pricing: () => request<Pricing>("/admin/pricing"),
};

/** Any thrown value → a humanized error the UI can show. */
export function toHumanError(e: unknown): HumanError {
  return e instanceof ApiError ? e.error : humanize("server_error");
}

/** "0.012345" → "$0.0123"; small sums keep enough digits to be non-zero. */
export function formatUsd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const digits = n === 0 ? 2 : n < 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
