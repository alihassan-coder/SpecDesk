import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Real chats/plans (UUID ids), settings and admin need a session. */
function needsSession(pathname: string): boolean {
  const [section, id] = pathname.split("/").filter(Boolean);
  if (section === "settings" || section === "admin") return true;
  return (section === "chat" || section === "plan") && !!id && UUID.test(id);
}

/** Demo routes with mock data (/chat/demo, /chat/c2, /plan/demo…) are for guests only. */
function isDemoRoute(pathname: string): boolean {
  const [section, id] = pathname.split("/").filter(Boolean);
  return (section === "chat" || section === "plan") && !!id && id !== "new" && !UUID.test(id);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isDemoRoute(pathname)) {
    // Signed-in people never see mock data: send them to their own plans.
    const session = await auth.api.getSession({ headers: request.headers });
    return session ? NextResponse.redirect(new URL("/chat", request.url)) : NextResponse.next();
  }
  if (!needsSession(pathname)) return NextResponse.next();

  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/chat/:id", "/plan/:id", "/settings/:path*", "/admin/:path*"],
};
