/**
 * Read-only share links. Turning a link on/off goes through the authenticated `/api/v1` proxy;
 * reading a shared plan is public and happens server-side on the share page.
 */
import { request, type LivePlan } from "@/lib/api";

/** What `GET /api/v1/share/{token}` returns: the plan without its private chat id. */
export type SharedPlan = Omit<LivePlan, "chatId">;

/** Turns sharing on (or reuses the existing link) and returns the full URL to copy. */
export async function createShareLink(planId: string): Promise<string> {
  const { path } = await request<{ token: string; path: string }>(`/plans/${planId}/share`, { method: "POST" });
  return `${window.location.origin}${path}`;
}

/** Turns sharing off: the old link stops working. */
export async function revokeShareLink(planId: string): Promise<void> {
  await request<{ token: null }>(`/plans/${planId}/share`, { method: "DELETE" });
}

/** Public download route on this site (streams from the API, see share/[token]/files/[name]). */
export function sharedFileUrl(token: string, name: string): string {
  return `/share/${encodeURIComponent(token)}/files/${encodeURIComponent(name)}`;
}
