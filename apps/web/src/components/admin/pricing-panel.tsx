"use client";

import { ListSkeleton } from "./panel-states";
import { useAdminResource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { adminApi, type Pricing } from "@/lib/admin-api";

function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n} ${currency}`;
  }
}

/** Buffer/spread may be a fraction (0.2) or a percent (20); show both as "20%". */
const percent = (n: number) => `${Math.round((n <= 1 ? n * 100 : n) * 10) / 10}%`;

function rows(p: Pricing) {
  return [
    { label: "Hourly rate", value: money(p.hourly_rate, p.currency), hint: "Blended rate across the team" },
    { label: "Risk buffer", value: percent(p.buffer), hint: "Added to every estimate" },
    { label: "Range spread", value: `±${percent(p.spread)}`, hint: "Width of the price range" },
    { label: "Prices round to", value: money(p.price_round_to, p.currency), hint: "Keeps ranges readable" },
    { label: "Base hours", value: `${p.base_hours} h`, hint: "Setup, design system, CI/CD, deploy" },
    { label: "Hours per week", value: `${p.hours_per_week} h`, hint: "Effective throughput per engineer" },
    { label: "Team size", value: String(p.team_size), hint: "Engineers working in parallel" },
    { label: "Minimum timeline", value: `${p.min_weeks} weeks`, hint: "Shortest plan we quote" },
  ];
}

export function PricingPanel() {
  const { state, retry } = useAdminResource(adminApi.pricing);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing engine</CardTitle>
        <CardDescription>Turns feature sizes into price and time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.status === "loading" && <ListSkeleton label="Loading pricing" />}
        {state.status === "error" && <ErrorCard error={state.error} onRetry={retry} />}
        {state.status === "ready" && (
          <>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {rows(state.data).map((r) => (
                <div key={r.label} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <dt className="text-sm font-medium">{r.label}</dt>
                    <p className="text-xs text-muted-foreground">{r.hint}</p>
                  </div>
                  <dd className="shrink-0 text-sm tabular-nums">{r.value}</dd>
                </div>
              ))}
            </dl>
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Hours per feature size</h3>
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["S", "M", "L", "XL"] as const).map((size) => (
                  <div key={size} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">Size {size}</dt>
                    <dd className="text-lg font-medium tabular-nums">{state.data.complexity_hours[size]} h</dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="border-t text-sm text-muted-foreground">
        <p>
          Edit <code className="font-mono text-xs">apps/api/pricing.yaml</code> to change pricing.
        </p>
      </CardFooter>
    </Card>
  );
}
