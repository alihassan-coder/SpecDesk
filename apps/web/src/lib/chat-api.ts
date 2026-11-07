/**
 * Sidebar chat management: rename and delete. Goes through the same `/api/v1/*` proxy as
 * src/lib/api.ts. DELETE answers 204 with no body, which `request` (it always parses JSON)
 * can't handle, so it has its own small fetch.
 */
import { ApiError, request, type LiveChatSummary } from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";

export type RenamedChat = Pick<LiveChatSummary, "id" | "title" | "status" | "updatedAt" | "planId">;

export const TITLE_MAX = 200;

export function renameChat(id: string, title: string): Promise<RenamedChat> {
  return request<RenamedChat>(`/chats/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title: title.trim() }),
  });
}

export async function deleteChat(id: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/chats/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    throw new ApiError(humanize("network"), 0);
  }
  if (res.ok) return;
  throw new ApiError(await errorFrom(res), res.status);
}

async function errorFrom(res: Response): Promise<HumanError> {
  try {
    const body: unknown = await res.json();
    const err = (body as { error?: Partial<HumanError> }).error;
    if (err?.code && err.title && err.message && err.action) return err as HumanError;
  } catch {
    // not JSON — fall through
  }
  return humanize(res.status === 404 ? "not_found" : "server_error");
}

/** Title + next action for a toast, whatever was thrown. */
export function toastError(e: unknown, fallbackTitle: string): { title: string; description: string } {
  if (e instanceof ApiError) return { title: e.error.title, description: `${e.error.message} ${e.error.action}` };
  const generic = humanize("server_error");
  return { title: fallbackTitle, description: `${generic.message} ${generic.action}` };
}
