"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HumanError } from "@/lib/errors";

export function ErrorCard({ error, onRetry }: { error: HumanError; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium">{error.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
          <p className="mt-1 text-sm">{error.action}</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
              <RotateCcw className="size-4" /> Retry
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
