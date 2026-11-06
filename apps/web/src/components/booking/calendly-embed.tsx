"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useDemoSession } from "@/components/providers/demo-session";
import { Skeleton } from "@/components/ui/skeleton";
import { calendlyEmbedUrl, isCalendlyEvent } from "@/lib/calendly";
import { cn } from "@/lib/utils";

/** Calendly inline embed (official embed URL), prefilled with the user and plan. */
export function CalendlyEmbed({
  planTitle,
  date,
  onScheduled,
  className,
}: {
  planTitle?: string;
  date?: Date;
  onScheduled?: () => void;
  className?: string;
}) {
  const { name, email } = useDemoSession();
  const { resolvedTheme } = useTheme();
  const [loaded, setLoaded] = useState(false);

  // Calendly posts events from the iframe; we only listen (external system → toast).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (isCalendlyEvent(e, "calendly.event_scheduled")) {
        toast.success("Call booked", { description: "Check your email for the calendar invite. Talk soon!" });
        onScheduled?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onScheduled]);

  const src = calendlyEmbedUrl({
    name: name === "Guest" ? undefined : name,
    email: email || undefined,
    planTitle,
    date,
    dark: resolvedTheme === "dark",
  });

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-background", className)}>
      {!loaded && (
        <div className="absolute inset-0 grid grid-rows-[auto_auto_1fr] gap-3 p-6" aria-hidden="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-full w-full" />
        </div>
      )}
      <iframe
        key={src}
        title="Book a call with Calendly"
        src={src}
        onLoad={() => setLoaded(true)}
        className={cn("size-full transition-opacity", loaded ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
