"use client";

import { CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Budget steps, small jobs first. The last step means "this much or more". */
const STEPS = [300, 500, 750, 1000, 1500, 2500, 4000, 6000, 8000, 12000, 20000, 35000, 50000];

/** Same size names the planners use (apps/api/pricing.yaml `sizes`). */
function sizeFor(amount: number): { label: string; hint: string } {
  if (amount <= 1500) return { label: "Basic", hint: "A few days: a landing page, a bot, a small automation" };
  if (amount <= 8000) return { label: "Small", hint: "A few weeks: one main feature done well" };
  if (amount <= 35000) return { label: "Intermediate", hint: "1–3 months: a few user types or a real workflow" };
  return { label: "Big", hint: "Several months: many roles, integrations or regulation" };
}

export function budgetLabel(index: number): string {
  const amount = STEPS[index];
  return index === STEPS.length - 1 ? `${formatMoney(amount)}+` : `Up to ${formatMoney(amount)}`;
}

/**
 * The budget pill in the idea box: a slider in a popover. `value` is the step index (or null for
 * "not set"); the parent sends `budgetLabel(value)` to the API, where the planners use it to size
 * the first version.
 */
export function BudgetPicker({ value, onChange }: { value: number | null; onChange: (index: number | null) => void }) {
  const index = value ?? 5;
  const size = sizeFor(STEPS[index]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={cn("h-8 gap-1.5 rounded-lg px-2 font-normal sm:px-2.5", value !== null && "bg-primary/10 text-primary hover:bg-primary/15")}
        >
          <CircleDollarSign className="size-4" />
          <span className={cn("max-w-32 truncate", value === null && "sr-only sm:not-sr-only")}>
            {value === null ? "Budget" : budgetLabel(value)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium" id="budget-label">
            Budget
          </p>
          <p className="text-sm tabular-nums">{budgetLabel(index)}</p>
        </div>
        <Slider
          className="mt-4"
          min={0}
          max={STEPS.length - 1}
          step={1}
          value={[index]}
          onValueChange={([i]) => onChange(i)}
          aria-labelledby="budget-label"
          aria-valuetext={budgetLabel(index)}
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{formatMoney(STEPS[0])}</span>
          <span>{formatMoney(STEPS[STEPS.length - 1])}+</span>
        </div>
        <div className="mt-4 rounded-md bg-muted px-3 py-2">
          <p className="text-sm font-medium">{size.label} project</p>
          <p className="text-xs text-muted-foreground">{size.hint}</p>
        </div>
        <div className="mt-3 flex justify-between gap-2">
          <p className="text-xs text-muted-foreground">We plan the first version to fit it.</p>
          {value !== null && (
            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(null)}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
