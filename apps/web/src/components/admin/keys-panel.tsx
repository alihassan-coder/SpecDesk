"use client";

import { useState } from "react";
import { CircleCheck, CircleDashed, CircleX, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { ListSkeleton } from "./panel-states";
import { useAdminResource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { adminApi, toHumanError, type KeySource, type ProviderKey } from "@/lib/admin-api";

const sourceLabel: Record<KeySource, string> = { db: "Saved here", env: "From .env", missing: "Not set" };

type Busy = "save" | "remove" | "test";

function toastError(e: unknown) {
  const err = toHumanError(e);
  toast.error(err.title, { description: `${err.message} ${err.action}` });
}

export function KeysPanel() {
  const { state, retry, setData } = useAdminResource(adminApi.keys);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, Busy | undefined>>({});

  const replace = (row: ProviderKey) => setData((ks) => ks.map((k) => (k.provider === row.provider ? row : k)));

  const run = async (provider: string, kind: Busy, action: () => Promise<void>) => {
    setBusy((b) => ({ ...b, [provider]: kind }));
    try {
      await action();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy((b) => ({ ...b, [provider]: undefined }));
    }
  };

  const save = (k: ProviderKey) => {
    const value = drafts[k.provider]?.trim();
    if (!value) return;
    void run(k.provider, "save", async () => {
      replace(await adminApi.saveKey(k.provider, value));
      setDrafts((d) => ({ ...d, [k.provider]: "" }));
      toast.success("Key saved", { description: "Stored encrypted. Only the last 4 characters are ever shown." });
    });
  };

  const remove = (k: ProviderKey) =>
    void run(k.provider, "remove", async () => {
      const row = await adminApi.deleteKey(k.provider);
      replace(row);
      toast("Key removed", {
        description: row.source === "env" ? "SpecDesk now uses the key from the server's .env." : "This provider has no key now.",
      });
    });

  const test = (k: ProviderKey) =>
    void run(k.provider, "test", async () => {
      const result = await adminApi.testKey(k.provider);
      replace({ ...k, lastTestOk: result.ok });
      if (result.ok) toast.success("Key works", { description: result.message });
      else toast.error("Key didn't work", { description: result.message });
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider API keys</CardTitle>
        <CardDescription>A key saved here (encrypted) wins over the one in the server&apos;s .env.</CardDescription>
      </CardHeader>
      <CardContent>
        {state.status === "loading" && <ListSkeleton label="Loading API keys" />}
        {state.status === "error" && <ErrorCard error={state.error} onRetry={retry} />}
        {state.status === "ready" &&
          (state.data.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No providers configured</EmptyTitle>
                <EmptyDescription>Providers appear here once the API knows about them.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="rounded-lg border">
              {state.data.map((k, i) => {
                const b = busy[k.provider];
                const draft = drafts[k.provider] ?? "";
                return (
                  <div key={k.provider} className="contents">
                    {i > 0 && <ItemSeparator />}
                    <Item className="flex-wrap">
                      <ItemMedia variant="icon">
                        <KeyRound />
                      </ItemMedia>
                      <ItemContent className="min-w-0">
                        <ItemTitle>
                          {k.label}
                          <Badge variant={k.source === "missing" ? "outline" : "secondary"}>{sourceLabel[k.source]}</Badge>
                        </ItemTitle>
                        <ItemDescription className="truncate">
                          <span className="font-mono">{k.last4 ? `••••${k.last4}` : "No key yet"}</span>
                          <span className="text-muted-foreground"> · .env: </span>
                          <span className="font-mono">{k.envVar}</span>
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {k.lastTestOk === true && <CircleCheck className="size-4 text-success" aria-label="Last test passed" />}
                        {k.lastTestOk === false && <CircleX className="size-4 text-destructive" aria-label="Last test failed" />}
                        {k.lastTestOk === null && <CircleDashed className="size-4 text-muted-foreground" aria-label="Not tested" />}
                        <Button variant="outline" size="sm" onClick={() => test(k)} disabled={k.source === "missing" || !!b}>
                          {b === "test" && <Spinner />} Test
                        </Button>
                        {k.source === "db" && (
                          <Button variant="ghost" size="sm" onClick={() => remove(k)} disabled={!!b}>
                            {b === "remove" && <Spinner />} Remove
                          </Button>
                        )}
                      </ItemActions>
                      <ItemFooter className="gap-2">
                        <form
                          className="flex w-full gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            save(k);
                          }}
                        >
                          <Input
                            aria-label={`New ${k.label} key`}
                            type="password"
                            autoComplete="off"
                            placeholder={k.source === "missing" ? "Paste API key" : "Paste a new key to replace it"}
                            value={draft}
                            onChange={(e) => setDrafts((d) => ({ ...d, [k.provider]: e.target.value }))}
                            className="font-mono"
                          />
                          <Button type="submit" size="sm" disabled={!draft.trim() || !!b}>
                            {b === "save" && <Spinner />} Save
                          </Button>
                        </form>
                      </ItemFooter>
                    </Item>
                  </div>
                );
              })}
            </ItemGroup>
          ))}
      </CardContent>
    </Card>
  );
}
