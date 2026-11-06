import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { Button } from "@/components/ui/button";
import { DEMO_PLAN } from "@/mocks/data";

export const metadata: Metadata = { title: `${DEMO_PLAN.title} plan`, robots: { index: false } };

/** Read-only plan for anyone with the link. M5: token lookup via GET /share/{token}. */
export default function SharePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">Shared plan · view only</span>
            <Button asChild size="sm">
              <Link href="/">Plan your own app</Link>
            </Button>
          </div>
        </div>
      </header>
      <PlanWorkspace plan={DEMO_PLAN} readOnly />
    </div>
  );
}
