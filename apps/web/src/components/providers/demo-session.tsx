"use client";

import { createContext, useContext } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { createLocalStore } from "@/lib/local-store";
import type { Role } from "@/mocks/types";

/**
 * M1 only: a fake session so every view can be reviewed.
 * Replaced in M3 by Better Auth's session (role derived server-side from ADMIN_EMAILS).
 */
interface DemoSession {
  role: Role;
  name: string;
  email: string;
  setRole: (role: Role) => void;
}

const PEOPLE: Record<Role, { name: string; email: string }> = {
  guest: { name: "Guest", email: "" },
  founder: { name: "Sara Ahmed", email: "sara@rehabit.io" },
  admin: { name: "Ali Hassan", email: "alihassan.coder@gmail.com" },
};

const roleStore = createLocalStore<Role>("specdesk.demoRole", "guest", (raw) => {
  const r = JSON.parse(raw) as Role;
  return r in PEOPLE ? r : "guest";
});

const Ctx = createContext<DemoSession | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const role = roleStore.useValue();
  return <Ctx.Provider value={{ role, ...PEOPLE[role], setRole: roleStore.write }}>{children}</Ctx.Provider>;
}

/**
 * Returns the guest session while this component hydrates (matching the server HTML),
 * then the real one. Needed because Suspense boundaries can hydrate after the provider
 * has already switched to the stored role.
 */
export function useDemoSession(): DemoSession {
  const ctx = useContext(Ctx);
  const hydrated = useHydrated();
  if (!ctx) throw new Error("useDemoSession must be used inside <DemoSessionProvider>");
  return hydrated ? ctx : { role: "guest", ...PEOPLE.guest, setRole: ctx.setRole };
}
