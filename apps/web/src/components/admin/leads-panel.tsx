"use client";

import { useMemo, useState } from "react";
import { Copy, FileText, Mail, MessagesSquare, Search, Sparkles, UserPlus, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ListSkeleton } from "./panel-states";
import { useAdminResource } from "./use-admin-resource";
import { ErrorCard } from "@/components/chat/status-cards";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, formatUsd, LEAD_STATUSES, toHumanError, type AdminLead, type LeadStatus } from "@/lib/admin-api";
import { formatDate, formatDateTime, formatRange, formatRelative, formatTime } from "@/lib/format";

const statusVariant: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  booked: "secondary",
  contacted: "outline",
  won: "secondary",
  lost: "destructive",
};

const displayName = (l: AdminLead) => l.name?.trim() || l.email;

const initials = (l: AdminLead) => {
  const source = l.name?.trim() || l.email.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

function toastError(e: unknown) {
  const err = toHumanError(e);
  toast.error(err.title, { description: `${err.message} ${err.action}` });
}

export function LeadsPanel() {
  const { state, retry, setData } = useAdminResource(adminApi.leads);
  const [now] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const leads = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (!q || [l.name, l.email, l.idea, l.budget].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [leads, query, status]);

  const open = leads.find((l) => l.id === openId) ?? null;
  const replace = (row: AdminLead) => setData((ls) => ls.map((l) => (l.id === row.id ? row : l)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads</CardTitle>
        <CardDescription>Everyone who signed up. Click a row for details.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.status === "loading" && <ListSkeleton rows={5} label="Loading leads" />}
        {state.status === "error" && <ErrorCard error={state.error} onRetry={retry} />}
        {state.status === "ready" && leads.length === 0 && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyTitle>No leads yet</EmptyTitle>
              <EmptyDescription>They appear when someone signs up.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {state.status === "ready" && leads.length > 0 && (
          <>
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
                  {LEAD_STATUSES.map((s) => (
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
                      <TableHead className="hidden md:table-cell">Latest idea</TableHead>
                      <TableHead className="hidden sm:table-cell">Budget</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Signed up</TableHead>
                      <TableHead className="hidden lg:table-cell">Last active</TableHead>
                      <TableHead className="hidden text-right sm:table-cell">Plans</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((l) => (
                      <TableRow
                        key={l.id}
                        tabIndex={0}
                        onClick={() => setOpenId(l.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setOpenId(l.id);
                          }
                        }}
                        className="cursor-pointer"
                        aria-label={`Open ${displayName(l)}`}
                      >
                        <TableCell className="max-w-48 sm:max-w-64">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-8">
                              <AvatarFallback>{initials(l)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{displayName(l)}</div>
                              {l.name?.trim() && <div className="truncate text-xs text-muted-foreground">{l.email}</div>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-56 truncate md:table-cell">
                          {l.idea ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="hidden tabular-nums sm:table-cell">
                          {l.budget ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[l.status]} className="capitalize">
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="tabular-nums">{formatDate(l.signedUpAt)}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{formatTime(l.signedUpAt)}</div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {l.lastActiveAt ? formatRelative(l.lastActiveAt, now) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">{l.plans.length}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>

      <LeadSheet lead={open} now={now} onClose={() => setOpenId(null)} onSaved={replace} />
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
  now,
  onClose,
  onSaved,
}: {
  lead: AdminLead | null;
  now: Date;
  onClose: () => void;
  onSaved: (lead: AdminLead) => void;
}) {
  const [notesDraft, setNotesDraft] = useState<{ id: string; text: string } | null>(null);
  const [saving, setSaving] = useState<"status" | "notes" | null>(null);
  const notes = lead ? (notesDraft?.id === lead.id ? notesDraft.text : (lead.notes ?? "")) : "";

  const patch = async (id: string, kind: "status" | "notes", body: { status?: LeadStatus; notes?: string }) => {
    setSaving(kind);
    try {
      onSaved(await adminApi.updateLead(id, body));
      if (kind === "notes") {
        setNotesDraft(null);
        toast.success("Notes saved");
      }
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Sheet open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {lead && (
          <>
            <SheetHeader className="border-b">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback>{initials(lead)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{displayName(lead)}</SheetTitle>
                  <SheetDescription className="truncate">
                    {lead.chats} {lead.chats === 1 ? "chat" : "chats"} · {formatUsd(lead.costUsd)} AI cost
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Select
                  value={lead.status}
                  disabled={saving === "status"}
                  onValueChange={(v) => void patch(lead.id, "status", { status: v as LeadStatus })}
                >
                  <SelectTrigger size="sm" className="w-36 capitalize" aria-label="Lead status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {saving === "status" && <Spinner aria-label="Saving status" />}
                {lead.budget && <Badge variant="outline">{lead.budget}</Badge>}
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
                      <span className="truncate">{lead.email}</span> <Copy className="size-3 shrink-0" aria-hidden="true" />
                    </button>
                  </DetailRow>
                  <DetailRow icon={UserPlus} label="Signed up">
                    {formatDateTime(lead.signedUpAt)}
                  </DetailRow>
                  <DetailRow icon={MessagesSquare} label="Last active">
                    {lead.lastActiveAt ? `${formatRelative(lead.lastActiveAt, now)} · ${formatDateTime(lead.lastActiveAt)}` : "Not yet"}
                  </DetailRow>
                </div>
              </section>

              {lead.idea && (
                <>
                  <Separator />
                  <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" /> Latest idea
                    </h3>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{lead.idea}</p>
                  </section>
                </>
              )}

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">Plans</h3>
                {lead.plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plans generated yet.</p>
                ) : (
                  <ItemGroup className="gap-2">
                    {lead.plans.map((p) => (
                      <Item key={p.id} variant="outline" size="sm">
                        <ItemMedia variant="icon">
                          <FileText />
                        </ItemMedia>
                        <ItemContent className="min-w-0">
                          <ItemTitle>
                            <span className="truncate">{p.title}</span> <Badge variant="secondary">{p.version}</Badge>
                          </ItemTitle>
                          <ItemDescription className="tabular-nums">
                            {formatRange(p.priceMin, p.priceMax)} · {p.weeks} weeks
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                )}
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
                disabled={saving === "notes" || notes === (lead.notes ?? "")}
                onClick={() => void patch(lead.id, "notes", { notes })}
              >
                {saving === "notes" && <Spinner />} Save notes
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
