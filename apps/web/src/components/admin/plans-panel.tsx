"use client";

import { useState } from "react";
import { ListSkeleton } from "./panel-states";
import type { Resource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import type { ChatStatus, Overview } from "@/lib/admin-api";
import { formatRange, formatRelative } from "@/lib/format";

const statusVariant: Record<ChatStatus, "default" | "secondary" | "outline" | "destructive"> = {
  interviewing: "outline",
  generating: "secondary",
  ready: "default",
  failed: "destructive",
};

/** Newest 50 chats across all users. Plan pages are owner-only, so rows don't link anywhere. */
export function PlansPanel({ state, onRetry }: { state: Resource<Overview>; onRetry: () => void }) {
  const [now] = useState(() => new Date());

  return (
    <Card>
      <CardHeader>
        <CardTitle>All plans</CardTitle>
        <CardDescription>The 50 most recent chats across every user.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && <ListSkeleton label="Loading plans" />}
        {state.status === "error" && <ErrorCard error={state.error} onRetry={onRetry} />}
        {state.status === "ready" &&
          (state.data.plans.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No plans yet</EmptyTitle>
                <EmptyDescription>They appear here as soon as someone starts a chat.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="rounded-lg border">
              {state.data.plans.map((p, i) => (
                <div key={p.chatId} className="contents">
                  {i > 0 && <ItemSeparator />}
                  <Item className="flex-wrap">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="max-w-full">
                        <span className="truncate">{p.title}</span>
                      </ItemTitle>
                      <ItemDescription className="truncate">
                        {p.ownerEmail ?? "Unknown owner"} · {formatRelative(p.updatedAt, now)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-wrap">
                      {p.priceMin !== null && p.priceMax !== null && (
                        <span className="text-sm tabular-nums">{formatRange(p.priceMin, p.priceMax)}</span>
                      )}
                      {p.weeks !== null && <span className="text-sm text-muted-foreground tabular-nums">{p.weeks} wk</span>}
                      <Badge variant={statusVariant[p.status]} className="capitalize">
                        {p.status}
                      </Badge>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </ItemGroup>
          ))}
      </CardContent>
    </Card>
  );
}
