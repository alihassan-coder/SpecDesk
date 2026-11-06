"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Copy,
  Download,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageSquareText,
  Search,
  Sparkles,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { LEADS, MOCK_NOW } from "@/mocks/data";
import type { Lead, LeadActivity } from "@/mocks/types";
import { formatDate, formatDateTime, formatRange, formatRelative, formatTime } from "@/lib/format";

const STATUSES: Lead["status"][] = ["new", "booked", "contacted", "won", "lost"];

const statusVariant: Record<Lead["status"], "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  booked: "secondary",
  contacted: "outline",
  won: "secondary",
  lost: "destructive",
};

const activityIcon: Record<LeadActivity["kind"], LucideIcon> = {
  signup: UserPlus,
  plan: Sparkles,
  version: FileText,
  file: Download,
  booking: CalendarCheck,
  email: Mail,
  note: MessageSquareText,
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function LeadsPanel() {
  const [leads, setLeads] = useState(LEADS);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Lead["status"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (!q || [l.name, l.email, l.company, l.idea, l.country].some((v) => v.toLowerCase().includes(q))),
    );
  }, [leads, query, status]);

  const open = leads.find((l) => l.id === openId) ?? null;
  const update = (id: string, patch: Partial<Lead>) => setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Click a row for details.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => toast("CSV export arrives in M6")}>
            <Download /> Export CSV
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads…"
              className="pl-8"
              aria-label="Search leads"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No leads match</EmptyTitle>
              <EmptyDescription>Try a different search or status.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Founder</TableHead>
                  <TableHead className="hidden md:table-cell">Idea</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Signed up</TableHead>
                  <TableHead className="hidden lg:table-cell">Last active</TableHead>
                  <TableHead className="hidden sm:table-cell">Call</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow
                    key={l.id}
                    tabIndex={0}
                    onClick={() => setOpenId(l.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpenId(l.id)}
                    className="cursor-pointer"
                    aria-label={`Open ${l.name}`}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback>{initials(l.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{l.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {l.company} · {l.country}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 truncate md:table-cell">{l.idea}</TableCell>
                    <TableCell className="tabular-nums">{l.budget}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[l.status]} className="capitalize">
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="tabular-nums">{formatDate(l.signedUpAt)}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{formatTime(l.signedUpAt)}</div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{formatRelative(l.lastActiveAt, MOCK_NOW)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {l.call ? (
                        <div>
                          <div className="tabular-nums">{formatDate(l.call.at)}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {formatTime(l.call.at)} · {l.call.status}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <LeadSheet lead={open} onClose={() => setOpenId(null)} onUpdate={update} />
    </Card>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="truncate">{children}</div>
      </div>
    </div>
  );
}

function LeadSheet({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => void;
}) {
  const [notesDraft, setNotesDraft] = useState<{ id: string; text: string } | null>(null);
  const notes = lead ? (notesDraft?.id === lead.id ? notesDraft.text : (lead.notes ?? "")) : "";

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {lead && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{lead.name}</SheetTitle>
                  <SheetDescription className="truncate">
                    {lead.role} · {lead.company}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Select value={lead.status} onValueChange={(v) => onUpdate(lead.id, { status: v as Lead["status"] })}>
                  <SelectTrigger size="sm" className="w-36 capitalize" aria-label="Lead status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline">{lead.budget}</Badge>
                <Badge variant="outline">{lead.downloads} downloads</Badge>
              </div>
            </SheetHeader>

            <div className="space-y-6 p-4">
              <section className="space-y-3">
                <h3 className="text-sm font-medium">Contact</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailRow icon={Mail} label="Email">
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-1.5 hover:underline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(lead.email).catch(() => undefined);
                        toast.success("Email copied");
                      }}
                    >
                      <span className="truncate">{lead.email}</span> <Copy className="size-3 shrink-0" />
                    </button>
                  </DetailRow>
                  <DetailRow icon={Building2} label="Company">
                    {lead.company}
                  </DetailRow>
                  <DetailRow icon={MapPin} label="Country">
                    {lead.country}
                  </DetailRow>
                  <DetailRow icon={CalendarClock} label="Timezone">
                    {lead.timezone}
                  </DetailRow>
                  <DetailRow icon={Globe} label="Came from">
                    {lead.source}
                  </DetailRow>
                  <DetailRow icon={UserPlus} label="Signed up">
                    {formatDateTime(lead.signedUpAt)}
                  </DetailRow>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last active {formatRelative(lead.lastActiveAt, MOCK_NOW)} · {formatDateTime(lead.lastActiveAt)}
                </p>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Call</h3>
                {lead.call ? (
                  <Item variant="outline">
                    <ItemMedia variant="icon">
                      <Video />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{formatDateTime(lead.call.at)}</ItemTitle>
                      <ItemDescription className="capitalize">{lead.call.status} · 30 min</ItemDescription>
                    </ItemContent>
                    {lead.call.meetUrl && lead.call.status === "scheduled" && (
                      <ItemActions>
                        <Button asChild size="sm">
                          <a href={lead.call.meetUrl} target="_blank" rel="noreferrer">
                            Join
                          </a>
                        </Button>
                      </ItemActions>
                    )}
                  </Item>
                ) : (
                  <p className="text-sm text-muted-foreground">No call booked yet.</p>
                )}
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Plans</h3>
                <ItemGroup className="gap-2">
                  {lead.plans.map((p) => (
                    <Item key={p.id} variant="outline" size="sm">
                      <ItemMedia variant="icon">
                        <FileText />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          {p.title} <Badge variant="secondary">{p.version}</Badge>
                        </ItemTitle>
                        <ItemDescription className="tabular-nums">
                          {formatRange(p.priceMin, p.priceMax)} · {p.weeks} weeks
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/chat/${p.id}`}>Open</Link>
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </ItemGroup>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Activity</h3>
                <ol className="relative space-y-4 border-l pl-6">
                  {[...lead.activity].reverse().map((a) => {
                    const Icon = activityIcon[a.kind];
                    return (
                      <li key={a.at + a.text} className="relative">
                        <span className="absolute top-0 -left-[37px] flex size-6 items-center justify-center rounded-full border bg-background">
                          <Icon className="size-3 text-primary" aria-hidden="true" />
                        </span>
                        <p className="text-sm">{a.text}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(a.at)}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <Separator />

              <Field>
                <FieldLabel htmlFor="lead-notes">Notes</FieldLabel>
                <Textarea
                  id="lead-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotesDraft({ id: lead.id, text: e.target.value })}
                  placeholder="Anything the team should know before the call…"
                />
              </Field>
            </div>

            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              <Button variant="outline" asChild>
                <a href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your ${lead.plans[0]?.title ?? "SpecDesk"} plan`)}`}>
                  <Mail /> Email
                </a>
              </Button>
              <Button
                onClick={() => {
                  onUpdate(lead.id, { notes });
                  setNotesDraft(null);
                  toast.success("Lead saved");
                }}
              >
                Save notes
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
