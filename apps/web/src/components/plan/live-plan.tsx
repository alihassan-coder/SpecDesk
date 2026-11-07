"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorCard } from "@/components/chat/status-cards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, type LivePlan } from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";
import { createShareLink } from "@/lib/share-api";
import { PlanWorkspace } from "./plan-workspace";

/** Loads a real plan from the API and shows it in the plan workspace. */
export function LivePlanView({ planId }: { planId: string }) {
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [error, setError] = useState<HumanError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.getPlan(planId).then(
      (p) => !cancelled && setPlan(p),
      (e: unknown) => !cancelled && setError(e instanceof ApiError ? e.error : humanize("server_error")),
    );
    return () => {
      cancelled = true;
    };
  }, [planId, attempt]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10 sm:px-6">
        <ErrorCard
          error={error}
          onRetry={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
        <Button asChild variant="ghost">
          <Link href="/chat">Back to your plans</Link>
        </Button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const zip = plan.files.find((f) => f.kind === "zip");
  return (
    <PlanWorkspace
      key={plan.version}
      // Web research (when the founder ran it) beats the critic's from-memory competitor list.
      plan={plan.research?.competitors.length ? { ...plan, competitors: plan.research.competitors } : plan}
      downloadAllHref={zip ? api.fileUrl(plan.id, zip.name) : undefined}
      onSaveVersion={(included, change) => api.saveVersion(plan.id, included, change)}
      onShare={() => createShareLink(plan.id)}
    />
  );
}
