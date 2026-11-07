"use client";

import { KeysPanel } from "./keys-panel";
import { LeadsPanel } from "./leads-panel";
import { ModelsPanel } from "./models-panel";
import { PlansPanel } from "./plans-panel";
import { PricingPanel } from "./pricing-panel";
import { useAdminResource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi, formatUsd, type Overview } from "@/lib/admin-api";

const count = new Intl.NumberFormat("en-US");

function statCards(stats: Overview["stats"]) {
  return [
    { label: "Users", value: count.format(stats.users), hint: "Signed up" },
    { label: "Chats", value: count.format(stats.chats), hint: "All time" },
    { label: "Plans generated", value: count.format(stats.plans), hint: "All time" },
    { label: "AI cost", value: formatUsd(stats.costUsd30d), hint: `Last 30 days · ${count.format(stats.agentRuns)} agent runs` },
  ];
}

/** Admin dashboard. Access is checked on the server before this renders (see app/(app)/admin/page.tsx). */
export function AdminView() {
  const overview = useAdminResource(adminApi.overview);
  const { state } = overview;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      {state.status === "error" ? (
        <ErrorCard error={state.error} onRetry={overview.retry} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy={state.status === "loading"}>
          {state.status === "loading"
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
            : statCards(state.data.stats).map((s) => (
                <Card key={s.label} className="gap-2">
                  <CardHeader>
                    <CardDescription>{s.label}</CardDescription>
                    <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
                </Card>
              ))}
        </div>
      )}

      <Tabs defaultValue="leads">
        <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit">
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="models">AI models</TabsTrigger>
          <TabsTrigger value="keys">API keys</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <LeadsPanel />
        </TabsContent>
        <TabsContent value="plans" className="mt-4">
          <PlansPanel state={state} onRetry={overview.retry} />
        </TabsContent>
        <TabsContent value="models" className="mt-4">
          <ModelsPanel />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <KeysPanel />
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <PricingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
