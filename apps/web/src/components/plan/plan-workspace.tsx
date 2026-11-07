"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarCheck, Download, ExternalLink, Share2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Feature, Moscow, Plan, PlanVersion } from "@/mocks/types";
import { formatMoney, formatRange } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Wireframe } from "./wireframe";

const MOSCOW: { key: Moscow; label: string; hint: string }[] = [
  { key: "must", label: "Must have", hint: "The MVP doesn't work without these" },
  { key: "should", label: "Should have", hint: "Important, but the MVP can launch without them" },
  { key: "could", label: "Could have", hint: "Nice extras for a later version" },
  { key: "wont", label: "Not yet", hint: "Out of scope for now" },
];

const impactTone = { high: "border-destructive/50 text-destructive", medium: "border-primary/50 text-primary", low: "text-muted-foreground" };

export function PlanWorkspace({
  plan,
  readOnly = false,
  onSaveVersion,
  downloadAllHref,
}: {
  plan: Plan;
  readOnly?: boolean;
  /** Live plans: saves the scope on the server, which prices it and returns the new version. */
  onSaveVersion?: (included: Record<string, boolean>, change: string) => Promise<PlanVersion>;
  /** Live plans: the ZIP with every file. */
  downloadAllHref?: string;
}) {
  const [features, setFeatures] = useState<Feature[]>(plan.features);
  const [baseline, setBaseline] = useState<Feature[]>(plan.features);
  const [versions, setVersions] = useState<PlanVersion[]>(plan.versions);
  const [bookingOpen, setBookingOpen] = useState(false);

  const saved = useMemo(() => estimate(baseline, plan), [baseline, plan]);
  const live = estimate(features, plan);
  const dirty = features.some((f, i) => f.included !== baseline[i].included);
  const latest = versions[versions.length - 1];

  const toggle = (id: string) => setFeatures((fs) => fs.map((f) => (f.id === id ? { ...f, included: !f.included } : f)));

  const [saving, setSaving] = useState(false);

  const saveVersion = async () => {
    const n = versions.length + 1;
    const added = features.filter((f, i) => f.included && !baseline[i].included).map((f) => f.name);
    const removed = features.filter((f, i) => !f.included && baseline[i].included).map((f) => f.name);
    const change = [
      added.length ? `Added ${added.join(", ")}.` : "",
      removed.length ? `Moved ${removed.join(", ")} to later.` : "",
      `${signedMoney(live.priceMax - saved.priceMax)}, ${signedWeeks(live.weeks - saved.weeks)}.`,
    ]
      .filter(Boolean)
      .join(" ");
    let version: PlanVersion = {
      id: `v${n}`,
      label: `v${n} · Your edit`,
      createdAt: new Date().toISOString(),
      priceMin: live.priceMin,
      priceMax: live.priceMax,
      weeks: live.weeks,
      change,
    };
    if (onSaveVersion) {
      setSaving(true);
      try {
        version = await onSaveVersion(Object.fromEntries(features.map((f) => [f.id, f.included])), change);
      } catch (e) {
        const err = e as { error?: { title: string; action: string } };
        toast.error(err.error?.title ?? "Couldn't save this version", { description: err.error?.action ?? "Try again in a moment." });
        return;
      } finally {
        setSaving(false);
      }
    }
    setVersions((v) => [...v, version]);
    setBaseline(features);
    toast.success(`Saved as v${n}`, { description: version.change || change });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-6 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{latest.label}</p>
          <h1 className="mt-1 text-4xl font-semibold">{plan.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{plan.oneLiner}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {!onSaveVersion && (
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${location.origin}/share/demo-token`).catch(() => undefined);
                  toast.success("Share link copied", { description: "Anyone with the link can view this plan. They can't edit it." });
                }}
              >
                <Share2 className="size-4" /> Share
              </Button>
            )}
            {downloadAllHref ? (
              <Button variant="outline" asChild>
                <a href={downloadAllHref} download>
                  <Download className="size-4" /> Download all
                </a>
              </Button>
            ) : (
              <Button variant="outline" onClick={() => toast.success("Preparing rehabit-specdesk.zip", { description: "This is the demo — sign in to get real files." })}>
                <Download className="size-4" /> Download all
              </Button>
            )}
            <Button onClick={() => setBookingOpen(true)}>
              <CalendarCheck className="size-4" /> Book a call
            </Button>
          </div>
        )}
      </div>

      {/* Live numbers */}
      <div className="sticky top-14 z-10 -mx-4 border-b bg-background/90 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6">
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Price range" value={formatRange(live.priceMin, live.priceMax)} delta={dirty ? signedMoney(live.priceMax - saved.priceMax) : undefined} up={live.priceMax > saved.priceMax} />
          <Stat label="Timeline" value={`${live.weeks} weeks`} delta={dirty ? signedWeeks(live.weeks - saved.weeks) : undefined} up={live.weeks > saved.weeks} />
          <Stat label="Effort" value={`${live.hours} hours`} sub={`incl. ${Math.round(plan.buffer * 100)}% buffer`} />
          <div>
            <dt className="text-xs text-muted-foreground">Readiness</dt>
            <dd className="mt-1 flex items-center gap-3">
              <span className="text-xl font-semibold tabular-nums">{plan.readiness}</span>
              <Progress value={plan.readiness} className="h-1.5 max-w-24" aria-label={`Readiness ${plan.readiness} out of 100`} />
            </dd>
          </div>
        </dl>
        {dirty && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" onClick={() => void saveVersion()} disabled={saving}>
              {saving ? "Saving…" : `Save as v${versions.length + 1}`}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFeatures(baseline)}>
              <Undo2 className="size-4" /> Undo
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="scope" className="mt-6">
        <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope">Features & scope</TabsTrigger>
          <TabsTrigger value="screens">Screens</TabsTrigger>
          <TabsTrigger value="stack">Tech stack</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 grid gap-10 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-semibold">The problem</h2>
            <p className="mt-2 text-muted-foreground">{plan.problem}</p>
            <h2 className="mt-8 text-lg font-semibold">Who it&apos;s for</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {plan.audience.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-semibold">Readiness: {plan.readiness}/100</h2>
            <ul className="mt-3 space-y-2">
              {plan.readinessNotes.map((n, i) => (
                <li key={n} className="flex gap-2 text-sm">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", i < 2 ? "bg-success" : "bg-primary")} aria-hidden="true" />
                  {n}
                </li>
              ))}
            </ul>
            <h2 className="mt-8 text-lg font-semibold">Assumptions</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {plan.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="scope" className="mt-6 space-y-8">
          {MOSCOW.map((group) => {
            const items = features.filter((f) => f.moscow === group.key);
            if (items.length === 0) return null;
            return (
              <section key={group.key}>
                <div className="flex items-baseline justify-between gap-4 border-b pb-2">
                  <h2 className="font-semibold">{group.label}</h2>
                </div>
                <ul className="divide-y">
                  {items.map((f) => (
                    <li key={f.id} className={cn("flex items-center gap-4 py-3", !f.included && "opacity-60")}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{f.name}</p>
                        <p className="text-sm text-muted-foreground">{f.description}</p>
                      </div>
                      <Badge variant="outline" className="font-mono tabular-nums">
                        {f.complexity} · {f.hours}h
                      </Badge>
                      <span className="hidden w-20 text-right text-sm text-muted-foreground tabular-nums sm:block">
                        {formatMoney(f.hours * plan.hourlyRate * (1 + plan.buffer))}
                      </span>
                      <Switch
                        checked={f.included}
                        onCheckedChange={() => toggle(f.id)}
                        disabled={readOnly}
                        aria-label={`Include ${f.name}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="screens" className="mt-6">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plan.screens.map((s) => (
              <li key={s.id}>
                <Wireframe blocks={s.wireframe} />
                <p className="mt-3 font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.purpose}</p>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="stack" className="mt-6">
          <ul className="divide-y rounded-lg border">
            {plan.stack.map((s) => (
              <li key={s.layer} className="grid gap-2 p-4 md:grid-cols-[160px_1fr]">
                <p className="text-sm text-muted-foreground">{s.layer}</p>
                <div>
                  <p className="font-semibold">{s.choice}</p>
                  <p className="mt-1 text-sm">{s.why}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="text-foreground/80">Considered:</span> {s.alternative}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6 space-y-8">
          <ol className="space-y-4">
            {plan.phases.map((p, i) => {
              const total = plan.phases.reduce((n, x) => n + x.weeks, 0);
              const before = plan.phases.slice(0, i).reduce((n, x) => n + x.weeks, 0);
              return (
                <li key={p.name} className="grid gap-2 md:grid-cols-[200px_1fr]">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      Weeks {before + 1}–{before + p.weeks}
                    </p>
                  </div>
                  <div>
                    <div className="relative h-7 rounded-lg bg-muted">
                      <div
                        className="absolute inset-y-0 rounded-lg bg-primary/70"
                        style={{ left: `${(before / total) * 100}%`, width: `${(p.weeks / total) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{p.deliverables.join(" · ")}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <section>
            <h2 className="font-semibold">Team</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {plan.team.map((t) => (
                <li key={t}>
                  <Badge variant="secondary">{t}</Badge>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="risks" className="mt-6">
          <ul className="space-y-3">
            {plan.risks.map((r) => (
              <li key={r.title} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{r.title}</p>
                  <Badge variant="outline" className={impactTone[r.impact]}>
                    {r.impact} impact
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{r.mitigation}</p>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="competitors" className="mt-6">
          <ul className="divide-y rounded-lg border">
            {plan.competitors.map((c) => (
              <li key={c.name} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.note}</p>
                </div>
                <Link href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  Visit <ExternalLink className="size-3.5" />
                </Link>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="versions" className="mt-6">
          <ol className="relative space-y-6 border-l pl-6">
            {[...versions].reverse().map((v, i, arr) => {
              const prev = arr[i + 1];
              return (
                <li key={v.id} className="relative">
                  <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
                  <p className="font-medium">{v.label}</p>
                  <p className="text-sm text-muted-foreground">{new Date(v.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="mt-2 text-sm">{v.change}</p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {formatRange(v.priceMin, v.priceMax)} · {v.weeks} weeks
                    {prev && (
                      <span className={cn("ml-2", v.priceMax < prev.priceMax ? "text-success" : "text-primary")}>
                        ({signedMoney(v.priceMax - prev.priceMax)} vs {prev.id})
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        </TabsContent>
      </Tabs>

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} planTitle={plan.title} />
    </div>
  );
}

function Stat({ label, value, delta, up, sub }: { label: string; value: string; delta?: string; up?: boolean; sub?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {delta && (
          <span className={cn("ml-2 inline-flex items-center text-xs tabular-nums", up ? "text-primary" : "text-success")}>
            {up ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {delta}
          </span>
        )}
        {sub && <span className="block text-xs text-muted-foreground">{sub}</span>}
      </dd>
    </div>
  );
}

const signedMoney = (n: number) => `${n >= 0 ? "+" : "−"}${formatMoney(Math.abs(n))}`;
const signedWeeks = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)} ${Math.abs(n) === 1 ? "week" : "weeks"}`;
