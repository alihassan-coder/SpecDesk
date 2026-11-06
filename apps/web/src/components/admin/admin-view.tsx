"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, CircleDashed, KeyRound, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useDemoSession } from "@/components/providers/demo-session";
import { LeadsPanel } from "./leads-panel";
import { SettingRow } from "@/components/settings/setting-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AGENT_MODELS, AGENTS, CHATS, MODEL_OPTIONS, PROVIDER_KEYS, type KeySource } from "@/mocks/data";

const STATS = [
  { label: "New leads", value: "12", hint: "This week" },
  { label: "Plans generated", value: "48", hint: "This month" },
  { label: "Calls booked", value: "9", hint: "This month" },
  { label: "AI cost", value: "$31.40", hint: "This month" },
];

export function AdminView() {
  const { role } = useDemoSession();

  if (role !== "admin") {
    return (
      <Empty className="m-6 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldAlert />
          </EmptyMedia>
          <EmptyTitle>Admins only</EmptyTitle>
          <EmptyDescription>Sign in with an admin email.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href="/chat">Back to your plans</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="gap-2">
            <CardHeader>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{s.hint}</CardContent>
          </Card>
        ))}
      </div>

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
          <Card>
            <CardHeader>
              <CardTitle>All plans</CardTitle>
              <CardDescription>All plans.</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemGroup className="rounded-lg border">
                {CHATS.map((c, i) => (
                  <div key={c.id} className="contents">
                    {i > 0 && <ItemSeparator />}
                    <Item>
                      <ItemContent>
                        <ItemTitle>{c.title}</ItemTitle>
                        <ItemDescription className="capitalize">{c.status}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/chat/${c.id}`}>Open</Link>
                        </Button>
                      </ItemActions>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="mt-4">
          <ModelSettings />
        </TabsContent>
        <TabsContent value="keys" className="mt-4">
          <KeySettings />
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <PricingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModelSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-64 font-mono text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MODEL_OPTIONS.map((m) => (
          <SelectItem key={m} value={m} className="font-mono text-xs">
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ModelSettings() {
  const [models, setModels] = useState(AGENT_MODELS);
  const [fallback, setFallback] = useState("openai/gpt-5");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Model per agent</CardTitle>
        <CardDescription>Pick a model for each agent.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {AGENTS.map((a, i) => (
            <div key={a.id} className="contents">
              {i > 0 && <FieldSeparator />}
              <SettingRow id={`model-${a.id}`} title={a.name}>
                <ModelSelect id={`model-${a.id}`} value={models[a.id]} onChange={(v) => setModels((m) => ({ ...m, [a.id]: v }))} />
              </SettingRow>
            </div>
          ))}
          <FieldSeparator />
          <SettingRow id="model-fallback" title="Fallback" description="If a model fails">
            <ModelSelect id="model-fallback" value={fallback} onChange={setFallback} />
          </SettingRow>
        </FieldGroup>
      </CardContent>
      <CardFooter className="border-t">
        <Button size="sm" onClick={() => toast.success("Models saved", { description: "New chats use these models right away." })}>
          Save models
        </Button>
      </CardFooter>
    </Card>
  );
}

const sourceLabel: Record<KeySource, string> = { db: "Saved here", env: "From .env", missing: "Not set" };

function KeySettings() {
  const [keys, setKeys] = useState(PROVIDER_KEYS);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const save = (provider: string) => {
    const value = drafts[provider]?.trim();
    if (!value) return;
    setKeys((ks) => ks.map((k) => (k.provider === provider ? { ...k, masked: `••••${value.slice(-4)}`, source: "db", ok: null } : k)));
    setDrafts((d) => ({ ...d, [provider]: "" }));
    toast.success("Key saved", { description: "Stored encrypted. Only the last 4 characters are ever shown." });
  };

  const test = async (provider: string) => {
    setTesting(provider);
    await new Promise((r) => setTimeout(r, 900));
    setTesting(null);
    setKeys((ks) => ks.map((k) => (k.provider === provider ? { ...k, ok: true } : k)));
    toast.success("Key works", { description: "The provider answered a test request." });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider API keys</CardTitle>
        <CardDescription>Encrypted. Used before .env keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="rounded-lg border">
          {keys.map((k, i) => (
            <div key={k.provider} className="contents">
              {i > 0 && <ItemSeparator />}
              <Item>
                <ItemMedia variant="icon">
                  <KeyRound />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {k.label}
                    <Badge variant={k.source === "missing" ? "outline" : "secondary"}>{sourceLabel[k.source]}</Badge>
                  </ItemTitle>
                  <ItemDescription className="font-mono">{k.masked ?? "No key yet"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {k.ok ? (
                    <CircleCheck className="size-4 text-success" aria-label="Working" />
                  ) : (
                    <CircleDashed className="size-4 text-muted-foreground" aria-label="Not tested" />
                  )}
                  <Button variant="outline" size="sm" onClick={() => void test(k.provider)} disabled={k.source === "missing" || testing === k.provider}>
                    {testing === k.provider && <Spinner />} Test
                  </Button>
                  {k.source === "db" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setKeys((ks) => ks.map((x) => (x.provider === k.provider ? { ...x, masked: null, source: "missing", ok: null } : x)));
                        toast("Key removed", { description: "SpecDesk will use the .env key if there is one." });
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </ItemActions>
                <ItemFooter className="gap-2">
                  <Input
                    aria-label={`New ${k.label} key`}
                    type="password"
                    autoComplete="off"
                    placeholder={k.masked ? "Paste a new key to replace it" : "Paste API key"}
                    value={drafts[k.provider] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [k.provider]: e.target.value }))}
                    className="font-mono"
                  />
                  <Button size="sm" onClick={() => save(k.provider)} disabled={!drafts[k.provider]?.trim()}>
                    Save
                  </Button>
                </ItemFooter>
              </Item>
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function PricingSettings() {
  const fields = [
    { id: "rate", label: "Hourly rate (USD)", value: "35", hint: "Blended rate across the team" },
    { id: "buffer", label: "Risk buffer (%)", value: "20", hint: "Added to every estimate" },
    { id: "spread", label: "Range spread (±%)", value: "15", hint: "Width of the price range" },
    { id: "base", label: "Base hours", value: "60", hint: "Setup, design system, CI/CD, deploy" },
    { id: "week", label: "Hours per engineer-week", value: "30", hint: "Effective throughput" },
    { id: "mobile", label: "Mobile multiplier", value: "1.25", hint: "Applied when the plan includes mobile apps" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing engine</CardTitle>
        <CardDescription>Turns feature sizes into price and time.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="grid gap-6 sm:grid-cols-2">
          {fields.map((f) => (
            <Field key={f.id}>
              <FieldLabel htmlFor={`price-${f.id}`}>{f.label}</FieldLabel>
              <Input id={`price-${f.id}`} defaultValue={f.value} inputMode="decimal" className="tabular-nums" />
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
      <CardFooter className="border-t">
        <Button size="sm" onClick={() => toast.success("Pricing saved", { description: "Applies to new plans and scope changes." })}>
          Save pricing
        </Button>
      </CardFooter>
    </Card>
  );
}
