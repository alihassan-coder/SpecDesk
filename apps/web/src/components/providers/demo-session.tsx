"use client";

import { createContext, useContext } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { authClient } from "@/lib/auth-client";
import type { Role } from "@/mocks/types";

/**
 * The signed-in person, from Better Auth's session.
 * signed out → guest; signed in → founder; admin when the server says so
 * (`isAdmin` is computed from ADMIN_EMAILS in the customSession plugin, never on the client).
 * The name is kept for existing callers; the API is the only real authority on access.
 */
interface DemoSession {
  role: Role;
  name: string;
  email: string;
  /** True until the first session check finishes. */
  isPending: boolean;
}

const GUEST: DemoSession = { role: "guest", name: "Guest", email: "", isPending: true };

const Ctx = createContext<DemoSession | null>(null);

function displayName(name: string | null | undefined, email: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return email.split("@")[0] ?? email;
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  const value: DemoSession = user
    ? {
        role: user.isAdmin ? "admin" : "founder",
        name: displayName(user.name, user.email),
        email: user.email,
        isPending: false,
      }
    : { ...GUEST, isPending };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Returns the guest session while this component hydrates (matching the server HTML),
 * then the real one. Needed because Suspense boundaries can hydrate after the provider
 * has already received the session.
 */
export function useDemoSession(): DemoSession {
  const ctx = useContext(Ctx);
  const hydrated = useHydrated();
  if (!ctx) throw new Error("useDemoSession must be used inside <DemoSessionProvider>");
  return hydrated ? ctx : GUEST;
}
