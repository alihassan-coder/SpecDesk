/**
 * Public file download for a shared plan: browser → /share/<token>/files/<name> → FastAPI.
 * No session needed — the share token is the key. The browser never sees the API URL.
 */

const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export async function GET(request: Request, ctx: RouteContext<"/share/[token]/files/[name]">): Promise<Response> {
  const { token, name } = await ctx.params;
  const target = `${API_URL}/api/v1/share/${encodeURIComponent(token)}/files/${encodeURIComponent(name)}`;

  let upstream: Response;
  try {
    upstream = await fetch(target, { cache: "no-store", signal: request.signal, redirect: "manual" });
  } catch {
    return Response.json(
      {
        error: {
          code: "api_unreachable",
          title: "We couldn't get that file",
          message: "SpecDesk's server didn't answer.",
          action: "Try the download again in a moment.",
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const out = new Headers({ "cache-control": "no-store" });
  for (const header of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(header);
    if (value) out.set(header, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
