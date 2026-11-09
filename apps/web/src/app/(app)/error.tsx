"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** A page inside the app crashed: keep the sidebar, explain, offer a way back. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>This page hit a problem</EmptyTitle>
          <EmptyDescription>
            It&apos;s not something you did, and your plans are safe. Try again, or go back to your plans.
            {error.digest && <span className="mt-2 block font-mono text-xs">Reference: {error.digest}</span>}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/chat">Your plans</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
