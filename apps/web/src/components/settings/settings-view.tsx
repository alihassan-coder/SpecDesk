"use client";

import { useState } from "react";
import { Brain, Check, RotateCcw, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAppearance } from "@/components/providers/appearance-provider";
import { useDemoSession } from "@/components/providers/demo-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldSeparator, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCENT_PRESETS, type ChatWidth, type Density, type FontChoice } from "@/lib/appearance";
import { MEMORIES } from "@/mocks/data";
import { cn } from "@/lib/utils";
import { SettingRow } from "./setting-row";

export function SettingsView() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Tabs defaultValue="appearance">
        <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] sm:w-fit">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <AppearanceSettings />
        </TabsContent>
        <TabsContent value="planning" className="mt-4 space-y-4">
          <PlanningSettings />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <NotificationSettings />
        </TabsContent>
        <TabsContent value="memory" className="mt-4 space-y-4">
          <MemorySettings />
        </TabsContent>
        <TabsContent value="account" className="mt-4 space-y-4">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Appearance ---------------- */

const THEMES = [
  { value: "light", label: "Light", description: "" },
  { value: "dark", label: "Dark", description: "" },
  { value: "system", label: "System", description: "" },
];

function previewTone(dark: boolean) {
  return dark
    ? { bg: "bg-neutral-950", panel: "bg-neutral-800", line: "bg-neutral-700" }
    : { bg: "bg-neutral-100", panel: "bg-white", line: "bg-neutral-200" };
}

/** Mini app mock used in the theme picker. */
function PreviewHalf({ dark }: { dark: boolean }) {
  const t = previewTone(dark);
  return (
    <div className={cn("flex h-full gap-1.5 p-2", t.bg)}>
      <div className={cn("w-1/4 rounded-sm", t.panel)} />
      <div className={cn("flex flex-1 flex-col gap-1.5 rounded-sm p-1.5", t.panel)}>
        <div className={cn("h-1.5 w-2/3 rounded-full", t.line)} />
        <div className={cn("h-1.5 w-1/2 rounded-full", t.line)} />
        <div className="mt-auto h-2.5 w-1/3 rounded-full bg-primary" />
      </div>
    </div>
  );
}

function ThemePreview({ mode }: { mode: string }) {
  return (
    <div className="h-14 overflow-hidden rounded-md border sm:h-20" aria-hidden="true">
      {mode === "system" ? (
        <div className="grid h-full grid-cols-2">
          <PreviewHalf dark={false} />
          <PreviewHalf dark />
        </div>
      ) : (
        <PreviewHalf dark={mode === "dark"} />
      )}
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const { appearance: a, update, reset } = useAppearance();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={theme ?? "light"} onValueChange={setTheme} className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Theme">
            {THEMES.map((t) => (
              <FieldLabel key={t.value} htmlFor={`theme-${t.value}`} className="cursor-pointer">
                <Field className="gap-2 p-2 sm:gap-3 sm:p-3">
                  <ThemePreview mode={t.value} />
                  <div className="flex items-start justify-between gap-2">
                    <FieldContent>
                      <FieldTitle>{t.label}</FieldTitle>
                    </FieldContent>
                    <RadioGroupItem value={t.value} id={`theme-${t.value}`} />
                  </div>
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accent colour</CardTitle>
          <CardDescription>Buttons and highlights.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {ACCENT_PRESETS.map((p) => {
            const active = (a.accent ?? null) === p.hex;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => update({ accent: p.hex })}
                aria-label={p.name}
                aria-pressed={active}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "ring-2 ring-foreground",
                )}
                style={{ background: p.swatch }}
              >
                {active && <Check className="size-4 text-white" />}
              </button>
            );
          })}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="color"
              value={a.accent ?? "#2563eb"}
              onChange={(e) => update({ accent: e.target.value })}
              className="size-9 cursor-pointer rounded-full border bg-transparent p-0.5"
              aria-label="Custom accent colour"
            />
            Custom
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout and text</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SettingRow id="radius" title="Corner roundness" description={`${a.radius.toFixed(2)} rem`}>
              <Slider id="radius" min={0} max={1.25} step={0.125} value={[a.radius]} onValueChange={([v]) => update({ radius: v })} className="w-40" />
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="font" title="Font">
              <Select value={a.font} onValueChange={(v) => update({ font: v as FontChoice })}>
                <SelectTrigger id="font" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geist">Geist</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="density" title="Density">
              <ToggleGroup id="density" type="single" variant="outline" size="sm" value={a.density} onValueChange={(v) => v && update({ density: v as Density })}>
                <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
                <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
              </ToggleGroup>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="chat-width" title="Chat width">
              <ToggleGroup id="chat-width" type="single" variant="outline" size="sm" value={a.chatWidth} onValueChange={(v) => v && update({ chatWidth: v as ChatWidth })}>
                <ToggleGroupItem value="narrow">Narrow</ToggleGroupItem>
                <ToggleGroupItem value="default">Default</ToggleGroupItem>
                <ToggleGroupItem value="wide">Wide</ToggleGroupItem>
              </ToggleGroup>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="motion" title="Reduce motion">
              <Switch id="motion" checked={a.reduceMotion} onCheckedChange={(v) => update({ reduceMotion: v })} />
            </SettingRow>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw /> Reset to defaults
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/* ---------------- Planning ---------------- */

function PlanningSettings() {
  const [prefs, setPrefs] = useState({ reasoning: true, questions: "balanced", currency: "USD", platform: "ask", booking: true });
  const set = (patch: Partial<typeof prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Interview</CardTitle>
          <CardDescription>How the agents question you.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SettingRow id="depth" title="Question depth">
              <ToggleGroup id="depth" type="single" variant="outline" size="sm" value={prefs.questions} onValueChange={(v) => v && set({ questions: v })}>
                <ToggleGroupItem value="quick">Quick</ToggleGroupItem>
                <ToggleGroupItem value="balanced">Balanced</ToggleGroupItem>
                <ToggleGroupItem value="thorough">Thorough</ToggleGroupItem>
              </ToggleGroup>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="platform" title="Default platform">
              <Select value={prefs.platform} onValueChange={(v) => set({ platform: v })}>
                <SelectTrigger id="platform" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">Ask me each time</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="both">Web and mobile</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="reasoning" title="Show agent reasoning">
              <Switch id="reasoning" checked={prefs.reasoning} onCheckedChange={(v) => set({ reasoning: v })} />
            </SettingRow>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estimates</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <SettingRow id="currency" title="Currency">
              <Select value={prefs.currency} onValueChange={(v) => set({ currency: v })}>
                <SelectTrigger id="currency" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["USD", "EUR", "GBP", "AED", "PKR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
            <FieldSeparator />
            <SettingRow id="booking" title="Suggest a call when ready">
              <Switch id="booking" checked={prefs.booking} onCheckedChange={(v) => set({ booking: v })} />
            </SettingRow>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t">
          <Button size="sm" onClick={() => toast.success("Planning preferences saved")}>
            Save preferences
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}

/* ---------------- Notifications ---------------- */

function NotificationSettings() {
  const rows = [
    { id: "n-ready", title: "Plan is ready", description: "", on: true },
    { id: "n-version", title: "New version saved", description: "", on: false },
    { id: "n-call", title: "Call reminder", description: "", on: true },
    { id: "n-tips", title: "Product updates", description: "", on: false },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        <CardDescription>To your sign-in email.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {rows.map((r, i) => (
            <div key={r.id} className="contents">
              {i > 0 && <FieldSeparator />}
              <SettingRow id={r.id} title={r.title}>
                <Switch id={r.id} defaultChecked={r.on} />
              </SettingRow>
            </div>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

/* ---------------- Memory ---------------- */

function MemorySettings() {
  const [items, setItems] = useState(MEMORIES);
  return (
    <Card>
      <CardHeader>
        <CardTitle>What SpecDesk remembers</CardTitle>
        <CardDescription>
          Facts SpecDesk keeps so you don&apos;t repeat yourself.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Brain />
              </EmptyMedia>
              <EmptyTitle>Nothing remembered</EmptyTitle>
              <EmptyDescription>They appear as you plan.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="rounded-lg border">
            {items.map((m, i) => (
              <div key={m.id} className="contents">
                {i > 0 && <ItemSeparator />}
                <Item>
                  <ItemContent>
                    <ItemTitle>{m.text}</ItemTitle>
                    <ItemDescription>Saved {m.createdAt}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Badge variant={m.scope === "long" ? "secondary" : "outline"}>{m.scope === "long" ? "All plans" : "This plan"}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Forget: ${m.text}`}
                      onClick={() => {
                        setItems((xs) => xs.filter((x) => x.id !== m.id));
                        toast.success("Forgotten", { description: m.text });
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </ItemActions>
                </Item>
              </div>
            ))}
          </ItemGroup>
        )}
      </CardContent>
      {items.length > 0 && (
        <CardFooter className="border-t">
          <Button variant="outline" size="sm" onClick={() => setItems([])}>
            Forget everything
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

/* ---------------- Account ---------------- */

function AccountSettings() {
  const { role, name, email } = useDemoSession();
  if (role === "guest") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re exploring as a guest</CardTitle>
          <CardDescription>Sign in to save plans.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" defaultValue={name} />
            </Field>
            <Field>
              <FieldLabel htmlFor="acc-email">Email</FieldLabel>
              <Input id="acc-email" defaultValue={email} disabled />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="border-t">
          <Button size="sm" onClick={() => toast.success("Profile saved")}>
            Save profile
          </Button>
        </CardFooter>
      </Card>

      <Card className="ring-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Removes everything. Can&apos;t be undone.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="destructive" size="sm" onClick={() => toast("Account deletion arrives in M3")}>
            Delete my account
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
