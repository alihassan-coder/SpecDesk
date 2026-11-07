import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { HumanError } from "@/lib/errors";

/**
 * Authenticated proxy: browser → /api/v1/<path> → FastAPI ${API_URL}/api/v1/<path>.
 * The session cookie never leaves Next; FastAPI gets a short-lived JWT instead.
 * Responses are streamed through untouched so SSE isn't buffered.
 */

const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

function errorResponse(status: number, error: HumanError): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

const SIGN_IN_REQUIRED: HumanError = {
  code: "sign_in_required",
  title: "Please sign in",
  message: "You need to be signed in to do that.",
  action: "Sign in with your email to continue.",
};

const API_UNREACHABLE: HumanError = {
  code: "api_unreachable",
  title: "SpecDesk's server isn't answering",
  message: "The website couldn't reach the planning API. It may be stopped or restarting.",
  action: "Start the API with `uv run uvicorn app.main:app --reload --port 8000` in apps/api",
};

async function forward(request: Request, ctx: RouteContext<"/api/v1/[...path]">): Promise<Response> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return errorResponse(401, SIGN_IN_REQUIRED);
  const { token } = await auth.api.getToken({ headers: requestHeaders });

  const { path } = await ctx.params;
  const target = `${API_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${new URL(request.url).search}`;

  const outgoing = new Headers({ authorization: `Bearer ${token}` });
  for (const name of ["content-type", "accept", "last-event-id"]) {
    const value = request.headers.get(name);
    if (value) outgoing.set(name, value);
  }
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: outgoing,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: request.signal, // client hangs up → stop the upstream stream too
      cache: "no-store",
      redirect: "manual",
    });
  } catch (err) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("[api proxy] upstream unreachable:", err instanceof Error ? err.message : err);
    return errorResponse(503, API_UNREACHABLE);
  }

  const out = new Headers({ "cache-control": "no-cache, no-transform" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) out.set("content-disposition", disposition);
  if (contentType?.startsWith("text/event-stream")) out.set("x-accel-buffering", "no");

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
