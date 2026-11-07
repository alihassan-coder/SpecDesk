/**
 * Browser client for the SpecDesk API. Every call goes to `/api/v1/*` on this site; the Next.js
 * proxy (src/app/api/v1/[...path]/route.ts) adds the signed-in user's token and forwards to FastAPI.
 */
import { humanize, type HumanError } from "@/lib/errors";
import type { ChatSummary, Plan, PlanVersion, QuestionRound } from "@/mocks/types";

export class ApiError extends Error {
  constructor(
    public readonly error: HumanError,
    public readonly status: number,
  ) {
    super(error.title);
  }
}

export type Depth = "quick" | "balanced" | "thorough";

export interface LiveChatSummary extends Omit<ChatSummary, "status" | "updatedAt"> {
  status: ChatSummary["status"] | "failed";
  updatedAt: string | null;
  planId: string | null;
}

export interface AnsweredRound {
  round: QuestionRound;
  answers: Record<string, { optionId?: string; text?: string; skipped?: boolean }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ChatDetail extends LiveChatSummary {
  idea: string;
  /** needs_idea: still chatting (e.g. they said "hi"); interviewing; ready (brief written). */
  stage: "needs_idea" | "interviewing" | "ready";
  conversation: ChatTurn[];
  rounds: AnsweredRound[];
  pending: QuestionRound | null;
  brief: string | null;
}

export interface Research {
  summary: string;
  competitors: { name: string; url: string; note: string }[];
}

export interface LivePlan extends Plan {
  research: Research | null;
  chatId: string;
  version: string;
  estimate: { hours: number; priceMin: number; priceMax: number; weeks: number; days?: number; duration?: string; currency: string };
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body: unknown = await res.json();
    const err = (body as { error?: Partial<HumanError> }).error;
    if (err?.code && err.title && err.message && err.action) {
      return new ApiError(err as HumanError, res.status);
    }
  } catch {
    // not JSON — fall through
  }
  return new ApiError(humanize(res.status === 404 ? "not_found" : "server_error"), res.status);
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(humanize("network"), 0);
  }
  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}

export const api = {
  createChat: (body: { idea: string; depth?: Depth; platform?: string; budget?: string }) =>
    request<LiveChatSummary>("/chats", { method: "POST", body: JSON.stringify(body) }),
  listChats: () => request<LiveChatSummary[]>("/chats"),
  getChat: (id: string) => request<ChatDetail>(`/chats/${id}`),
  getPlan: (id: string) => request<LivePlan>(`/plans/${id}`),
  saveVersion: (id: string, included: Record<string, boolean>, change: string) =>
    request<PlanVersion>(`/plans/${id}/versions`, { method: "POST", body: JSON.stringify({ included, change }) }),
  sendFeedback: (chatId: string, target: string, rating: "up" | "down") =>
    request<{ status: string }>(`/chats/${chatId}/feedback`, { method: "POST", body: JSON.stringify({ target, rating }) }),
  fileUrl: (planId: string, name: string) => `/api/v1/plans/${planId}/files/${encodeURIComponent(name)}`,
};

/** One Server-Sent Event: its name and parsed JSON data. */
export interface SseEvent {
  event: string;
  data: unknown;
}

/**
 * POST to an SSE endpoint and call `onEvent` for each event as it arrives.
 * `EventSource` only supports GET, so this reads the response body stream instead.
 */
export async function streamEvents(
  path: string,
  onEvent: (e: SseEvent) => void,
  init?: { body?: unknown; signal?: AbortSignal },
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init?.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    throw new ApiError(humanize("network"), 0);
  }
  if (!res.ok || !res.body) throw await toApiError(res);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<string>;
    try {
      chunk = await reader.read();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      throw new ApiError(humanize("network"), 0);
    }
    if (chunk.done) break;
    buffer += chunk.value.replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const parsed = parseBlock(block);
      if (parsed) onEvent(parsed);
    }
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  const raw = data.join("\n");
  try {
    return { event, data: JSON.parse(raw) as unknown };
  } catch {
    return { event, data: raw };
  }
}

export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
