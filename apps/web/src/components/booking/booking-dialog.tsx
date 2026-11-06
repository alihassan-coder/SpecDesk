"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useDemoSession } from "@/components/providers/demo-session";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToday } from "@/hooks/use-today";
import { calendlyBookingUrl } from "@/lib/calendly";

/** Sample times. M6 swaps these for real availability from the Calendly API. */
const TIMES = ["10:00", "11:00", "13:00", "14:30", "16:00"];

/**
 * Fast booking popup: pick a weekday and a time instantly (no Calendly iframe),
 * then continue on Calendly with the day and contact details prefilled.
 */
export function BookingDialog({
  open,
  onOpenChange,
  date: initialDate,
  planTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: Date;
  planTitle?: string;
}) {
  const { name, email } = useDemoSession();
  const today = useToday();
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState<string>("");

  const close = (next: boolean) => {
    if (!next) {
      setTime("");
      setDate(initialDate);
    }
    onOpenChange(next);
  };

  const continueToCalendly = () => {
    const href = calendlyBookingUrl({ name: name === "Guest" ? undefined : name, email: email || undefined, planTitle, date });
    window.open(href, "_blank", "noopener,noreferrer");
    close(false);
  };

  const dayLabel = date?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Book a free call</DialogTitle>
          <DialogDescription>30 minutes{planTitle ? ` · ${planTitle}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setTime("");
            }}
            disabled={today ? [{ before: today }, { dayOfWeek: [0, 6] }] : undefined}
            className="rounded-lg border p-2"
          />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{dayLabel ?? "Pick a day"}</p>
            <ToggleGroup
              type="single"
              variant="outline"
              value={time}
              onValueChange={setTime}
              disabled={!date}
              className="grid w-full grid-cols-3 gap-2 sm:grid-cols-2"
              aria-label="Time"
            >
              {TIMES.map((t) => (
                <ToggleGroupItem key={t} value={t} className="tabular-nums data-[state=on]:border-primary data-[state=on]:text-primary">
                  {t}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button asChild variant="ghost">
            <Link href="/book" onClick={() => close(false)}>
              Open full page <ExternalLink />
            </Link>
          </Button>
          <Button onClick={continueToCalendly} disabled={!date || !time}>
            Continue {date && time ? `· ${dayLabel} ${time}` : ""} <ArrowRight />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
