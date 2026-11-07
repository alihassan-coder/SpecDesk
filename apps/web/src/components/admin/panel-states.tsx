"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows while an admin list loads. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
