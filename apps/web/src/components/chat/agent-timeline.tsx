"use client";

import { useMemo, useState } from "react";
import { Brain, Check, ChevronDown, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AGENTS } from "@/mocks/data";
import type { AgentId, AgentStatus, StreamEvent } from "@/mocks/types";
import { cn } from "@/lib/utils";

interface AgentState {
  status: AgentStatus;
  notes: string[];
  reasoning: string[];
}

export function deriveAgents(events: StreamEvent[]) {
  const state = new Map<AgentId, AgentState>();
  for (const a of AGENTS) if (a.id !== "interviewer") state.set(a.id, { status: "queued", notes: [], reasoning: [] });
  for (const e of events) {
    if (e.type !== "agent.status" && e.type !== "agent.note" && e.type !== "agent.reasoning") continue;
    const s = state.get(e.agent);
    if (!s) continue;
    if (e.type === "agent.status") s.status = e.status;
    if (e.type === "agent.note") s.notes.push(e.text);
    if (e.type === "agent.reasoning") s.reasoning.push(e.text);
  }
  return state;
}

const StatusIcon = ({ status }: { status: AgentStatus }) => {
  if (status === "done") return <Check className="size-4 text-success" />;
  if (status === "working") return <Loader2 className="size-4 animate-spin text-primary" />;
  if (status === "error") return <TriangleAlert className="size-4 text-destructive" />;
  return <CircleDashed className="size-4 text-muted-foreground/60" />;
};

const statusLabel: Record<AgentStatus, string> = {
  queued: "Waiting",
  working: "Working",
  done: "Done",
  error: "Needs attention",
};

export function AgentTimeline({ events, running }: { events: StreamEvent[]; running: boolean }) {
  const agents = useMemo(() => deriveAgents(events), [events]);
  const done = [...agents.values()].filter((a) => a.status === "done").length;
  const total = agents.size;
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="glass overflow-hidden rounded-2xl">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="flex items-center gap-3">
          {running ? (
            <span className="animate-pulse size-2 rounded-full bg-primary" aria-hidden="true" />
          ) : (
            <Check className="size-4 text-success" aria-hidden="true" />
          )}
          <span className="text-sm font-medium">{running ? "Agents are drafting your plan" : "Plan drafted by 7 agents"}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {done}/{total}
          </span>
        </div>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>

      <div className="h-0.5 bg-border" aria-hidden="true">
        <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>

      <CollapsibleContent>
        <ol className="space-y-1 p-2" aria-live="polite">
          {AGENTS.filter((a) => a.id !== "interviewer").map((meta) => {
            const s = agents.get(meta.id)!;
            return (
              <li
                key={meta.id}
                className={cn(
                  "rounded-lg px-3 py-2.5 transition-colors",
                  s.status === "working" && "bg-muted",
                )}
              >
                <div className="flex items-center gap-3">
                  <StatusIcon status={s.status} />
                  <span className={cn("text-sm font-medium", s.status === "queued" && "text-muted-foreground")}>{meta.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{meta.job}</span>
                  <span className="sr-only">— {statusLabel[s.status]}</span>
                </div>

                {s.notes.length > 0 && (
                  <ul className="mt-1.5 space-y-1 pl-7">
                    {s.notes.map((n) => (
                      <li key={n} className="text-sm text-foreground/90">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}

                {s.reasoning.length > 0 && <ReasoningBlock texts={s.reasoning} streaming={s.status === "working"} />}
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ReasoningBlock({ texts, streaming }: { texts: string[]; streaming: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1.5 pl-7">
      <CollapsibleTrigger className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Brain className="size-3.5" />
        {streaming ? "Thinking…" : "Why it decided this"}
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
          {texts.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
