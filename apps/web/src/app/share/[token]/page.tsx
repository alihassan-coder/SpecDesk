import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CloudOff, Link2Off } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { sharedFileUrl, type SharedPlan } from "@/lib/share-api";
import { DEMO_PLAN } from "@/mocks/data";

export const metadata: Metadata = { title: "Shared plan", robots: { index: false } };

const DEMO_TOKEN = "demo-token";
const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** Read-only plan for anyone with the link. Public: fetched server-side with no session. */
export default function SharePage({ params }: PageProps<"/share/[token]">) {
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
      <Suspense fallback={<PlanSkeleton />}>
        <SharedPlanView params={params} />
      </Suspense>
    </div>
  );
}

type Loaded = { kind: "plan"; plan: SharedPlan } | { kind: "gone" } | { kind: "unavailable" };

async function loadSharedPlan(token: string): Promise<Loaded> {
  try {
    const res = await fetch(`${API_URL}/api/v1/share/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (res.status === 404) return { kind: "gone" };
    if (!res.ok) return { kind: "unavailable" };
    return { kind: "plan", plan: (await res.json()) as SharedPlan };
  } catch {
    return { kind: "unavailable" };
  }
}

async function SharedPlanView({ params }: { params: PageProps<"/share/[token]">["params"] }) {
  const { token } = await params;
  if (token === DEMO_TOKEN) return <PlanWorkspace plan={DEMO_PLAN} readOnly />;

  const loaded = await loadSharedPlan(token);
  if (loaded.kind === "gone") {
    return (
      <ShareProblem
        icon={<Link2Off />}
        title="This share link doesn't work any more"
        description="The owner may have turned sharing off. Ask them for a new link."
      />
    );
  }
  if (loaded.kind === "unavailable") {
    return (
      <ShareProblem
        icon={<CloudOff />}
        title="We couldn't load this plan"
        description="SpecDesk's server didn't answer. Refresh the page in a moment."
      />
    );
  }
  const { plan } = loaded;
  const zip = plan.files.find((f) => f.kind === "zip");
  return (
    <PlanWorkspace plan={plan} readOnly downloadAllHref={zip ? sharedFileUrl(token, zip.name) : undefined} />
  );
}

function ShareProblem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex min-h-[60svh] items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">Plan your own app</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
