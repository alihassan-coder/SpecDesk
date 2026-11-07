"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, ExternalLink, FastForward, Globe, LayoutDashboard, Loader2, Pencil, RefreshCw, Square } from "lucide-react";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { SendButton, promptSurface } from "@/components/prompt/prompt-parts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ApiError,
  api,
  streamEvents,
  type AnsweredRound,
  type ChatDetail,
  type ChatTurn,
  type LivePlan,
  type Research,
  type SseEvent,
} from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";
import { formatRange } from "@/lib/format";
import { formatDuration } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { LIVE_AGENT_IDS } from "@/mocks/data";
import type { PlanFile, QuestionRound as Round, StreamEvent } from "@/mocks/types";
import { AgentTimeline } from "./agent-timeline";
import { ArtifactPanel } from "./artifact-panel";
import { AssistantMessage, UserBubble } from "./chat-view";
import { FileCards } from "./file-cards";
import { MessageActions, TextAction } from "./message-actions";
import { QuestionRound, recommendedAnswers, type Answers } from "./question-round";
import { ErrorCard } from "./status-cards";

/** What the screen is waiting for right now. */
type Busy = null | "reading" | "thinking" | "planning" | "researching";
/** What Retry / Continue repeats. */
type Step = { kind: "load" } | { kind: "interview" } | { kind: "plan" } | { kind: "message"; text: string } | { kind: "answers" };

const asError = (e: unknown): HumanError => (e instanceof ApiError ? e.error : humanize("server_error"));

const STOPPED: HumanError = {
  code: "stopped",
  title: "Stopped",
  message: "Nothing is lost — what's done so far is saved.",
  action: "Press Continue to pick up where it stopped.",
};

/**
 * A real planning chat. Until the founder has described an app, it's a normal conversation (the
 * front desk answers "hi"); then the interviewer's question rounds; then the planning agents.
 * Everything streams from the API, and a refresh picks up where it stands without new model calls.
 */
export function LiveChat({ chatId }: { chatId: string }) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [stage, setStage] = useState<ChatDetail["stage"]>("interviewing");
  const [conversation, setConversation] = useState<ChatTurn[]>([]);
  const [rounds, setRounds] = useState<AnsweredRound[]>([]);
  const [pending, setPending] = useState<Round | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({}); // interviewer's "why", per round
  const [editing, setEditing] = useState<number | null>(null); // round being edited
  const [brief, setBrief] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<StreamEvent[]>([]);
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [researchNote, setResearchNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ error: HumanError; retry: Step } | null>(null);
  const [draft, setDraft] = useState("");
  const [openFile, setOpenFile] = useState<PlanFile | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false); // survives React's dev double-mount, so nothing runs twice
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // ---------- streaming ----------

  const handle = useCallback((e: SseEvent, roundNumber: number) => {
    const data = (e.data ?? {}) as Record<string, unknown>;
    switch (e.event) {
      case "assistant.message":
        setConversation((c) => [...c, { role: "assistant", text: String(data.text) }]);
        setStage("needs_idea");
        return;
      case "agent.status":
      case "agent.note":
      case "agent.reasoning":
        if (data.agent === "triage") return;
        if (data.agent === "interviewer") {
          setStage("interviewing");
          if (e.event === "agent.note") setNotes((n) => ({ ...n, [roundNumber]: String(data.text) }));
          return;
        }
        if (data.agent === "researcher") {
          if (e.event === "agent.note") setResearchNote(String(data.text));
          return;
        }
        setAgentEvents((prev) => [...prev, { type: e.event, ...data } as StreamEvent]);
        return;
      case "question.round":
        setPending(data.round as Round);
        setStage("interviewing");
        return;
      case "interview.done":
        setBrief(String(data.brief ?? ""));
        setStage("ready");
        return;
      case "file.ready":
        setFiles((prev) => {
          const file = data.file as PlanFile;
          return prev.some((f) => f.id === file.id) ? prev : [...prev, file];
        });
        return;
      case "research.done":
        setResearch(data as unknown as Research);
        return;
      case "done":
        void api.getPlan(String(data.planId)).then(
          (p) => {
            setPlan(p);
            if (p.research) setResearch(p.research);
          },
          (err: unknown) => setError({ error: asError(err), retry: { kind: "load" } }),
        );
        return;
      case "error":
        throw new ApiError(data as unknown as HumanError, 0);
    }
  }, []);

  /** Run one stream. Returns "ok", "stopped" or "failed" (the error is already shown). */
  const run = useCallback(
    async (path: string, body: unknown, roundNumber: number, mode: Exclude<Busy, null>, retry: Step, onEvent?: (e: SseEvent) => void) => {
      setError(null);
      setBusy(mode);
      const controller = new AbortController();
      abort.current = controller;
      try {
        await streamEvents(path, (e) => {
          onEvent?.(e);
          handle(e, roundNumber);
        }, { body, signal: controller.signal });
      } catch (err) {
        setError({ error: asError(err), retry });
        return "failed" as const;
      } finally {
        setBusy(null);
        abort.current = null;
      }
      if (controller.signal.aborted) {
        setError({ error: STOPPED, retry });
        return "stopped" as const;
      }
      return "ok" as const;
    },
    [handle],
  );

  const runPlan = useCallback(async () => {
    setAgentEvents([]);
    await run(`/chats/${chatId}/plan`, undefined, 0, "planning", { kind: "plan" });
  }, [chatId, run]);

  /** Interview streams end with the next round, a reply to "hi", or the finished brief. */
  const runInterview = useCallback(
    async (path: string, body: unknown, roundNumber: number, retry: Step, mode: "reading" | "thinking" = "thinking") => {
      let finished = false;
      const result = await run(path, body, roundNumber, mode, retry, (e) => {
        if (e.event === "interview.done") finished = true;
      });
      if (result === "ok" && finished) await runPlan(); // the plan starts on its own
    },
    [run, runPlan],
  );

  // ---------- first load ----------

  const load = useCallback(async () => {
    setError(null);
    let detail: ChatDetail;
    try {
      detail = await api.getChat(chatId);
    } catch (err) {
      setError({ error: asError(err), retry: { kind: "load" } });
      return;
    }
    setChat(detail);
    setStage(detail.stage);
    setConversation(detail.conversation);
    setRounds(detail.rounds);
    setPending(detail.pending);
    setBrief(detail.brief);

    if (detail.planId || detail.brief) await runPlan(); // finished plans only re-send files + id
    else if (detail.stage === "needs_idea") return; // waiting for them to describe the app
    else if (!detail.pending) await runInterview(`/chats/${chatId}/interview`, undefined, detail.rounds.length + 1, { kind: "interview" }, "reading");
  }, [chatId, runInterview, runPlan]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // ---------- actions ----------

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setDraft("");
    setConversation((c) => [...c, { role: "user", text: trimmed }]);
    void runInterview(`/chats/${chatId}/messages`, { text: trimmed }, 1, { kind: "message", text: trimmed }, "reading");
  };

  const submitAnswers = (answers: Answers, finish = false) => {
    if (!pending) return;
    const answered = { round: pending, answers };
    setRounds((r) => [...r, answered]);
    setPending(null);
    void runInterview(`/chats/${chatId}/answers`, { answers, finish }, pending.round + 1, { kind: "answers" });
  };

  const submitEdit = (roundNumber: number, answers: Answers) => {
    const target = rounds.find((r) => r.round.round === roundNumber);
    if (!target) return;
    setEditing(null);
    setRounds((r) => [...r.filter((x) => x.round.round < roundNumber), { round: target.round, answers }]);
    setPending(null);
    void runInterview(`/chats/${chatId}/rounds/${roundNumber}/answers`, { answers }, roundNumber + 1, { kind: "load" });
  };

  const regenerate = (roundNumber: number) => {
    setRounds((r) => r.filter((x) => x.round.round < roundNumber));
    setPending(null);
    void runInterview(`/chats/${chatId}/rounds/${roundNumber}/regenerate`, undefined, roundNumber, { kind: "load" });
  };

  const runResearch = async () => {
    if (!plan) return;
    setResearchNote(null);
    await run(`/plans/${plan.id}/research`, undefined, 0, "researching", { kind: "load" });
  };

  const retry = () => {
    if (!error) return;
    const step = error.retry;
    if (step.kind === "load") void load();
    if (step.kind === "plan") void runPlan();
    if (step.kind === "interview") void runInterview(`/chats/${chatId}/interview`, undefined, rounds.length + 1, step);
    if (step.kind === "message") {
      setConversation((c) => c.slice(0, -1)); // sendMessage adds it back
      setError(null);
      sendMessage(step.text);
    }
    if (step.kind === "answers") {
      // The answers may not have reached the server: reload to see where it stands.
      void load();
    }
  };

  const rate = (target: string) => (rating: "up" | "down") => api.sendFeedback(chatId, target, rating);

  // Follow new content.
  const contentCount =
    conversation.length + rounds.length + (pending ? 1 : 0) + agentEvents.length + files.length + (plan ? 1 : 0) + (research ? 1 : 0) + (error ? 1 : 0) + (busy ? 1 : 0);
  useEffect(() => {
    const el = scrollRef.current;
    if (contentCount > 0) el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [contentCount]);

  // ---------- render ----------

  if (!chat) {
    return (
      <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-4 px-4 pt-6 sm:px-6">
        {error ? (
          <ErrorCard error={error.error} onRetry={retry} />
        ) : (
          <>
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </>
        )}
      </div>
    );
  }

  const planning = busy === "planning" || agentEvents.length > 0;
  const canChange = !plan && !planning && !busy; // answers can't change once the plan exists
  const showPanel = !!openFile && !isMobile;
  const fileHref = (f: PlanFile) => (plan ? api.fileUrl(plan.id, f.name) : undefined);
  const chatting = stage === "needs_idea";
  const lastRound = pending?.round ?? rounds[rounds.length - 1]?.round.round;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <h1 className="sr-only">{chat.title}</h1>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-6 px-4 pt-6 pb-44 sm:px-6">
            <UserBubble text={chat.conversation.length || conversation.length ? firstMessage(chat) : chat.idea} />

            {conversation.map((t, i) =>
              t.role === "user" ? (
                <UserBubble key={i} text={t.text} />
              ) : (
                <div key={i} className="space-y-1">
                  <AssistantMessage>{t.text}</AssistantMessage>
                  <MessageActions text={t.text} className="pl-9" />
                </div>
              ),
            )}

            {rounds.map((r) => {
              const n = r.round.round;
              if (editing === n) {
                return (
                  <div key={n} className="space-y-2">
                    <AssistantMessage>{`**Change your answers for round ${n}.** Later questions will be asked again.`}</AssistantMessage>
                    <QuestionRound round={r.round} initial={r.answers} onSubmit={(a) => submitEdit(n, a)} />
                    <div className="pl-9">
                      <TextAction onClick={() => setEditing(null)}>Cancel</TextAction>
                    </div>
                  </div>
                );
              }
              return (
                <RoundBlock key={n} round={r.round} note={notes[n]} answers={r.answers} first={n === 1}>
                  <MessageActions onRate={rate(`round:${n}`)}>
                    {canChange && (
                      <TextAction onClick={() => setEditing(n)}>
                        <Pencil /> Edit answers
                      </TextAction>
                    )}
                  </MessageActions>
                </RoundBlock>
              );
            })}

            {pending && editing === null && (
              <RoundBlock round={pending} note={notes[pending.round]} first={pending.round === 1} onSubmit={(a) => submitAnswers(a)}>
                <MessageActions onRate={rate(`round:${pending.round}`)}>
                  <TextAction onClick={() => regenerate(pending.round)} disabled={!!busy}>
                    <RefreshCw /> Ask different questions
                  </TextAction>
                  <TextAction onClick={() => submitAnswers(recommendedAnswers(pending), true)} disabled={!!busy}>
                    <FastForward /> Generate plan now
                  </TextAction>
                </MessageActions>
              </RoundBlock>
            )}

            {(busy === "reading" || busy === "thinking") && (
              <Working text={busy === "reading" ? "Reading your message…" : lastRound ? "Reading your answers…" : "Thinking about your idea…"} onStop={() => abort.current?.abort()} />
            )}

            {brief !== null && planning && (
              <>
                <AssistantMessage>{plan ? "Here's what the agents worked out." : "Got it. **The agents are planning it now** — this takes about a minute."}</AssistantMessage>
                {agentEvents.length > 0 ? (
                  <AgentTimeline events={agentEvents} running={busy === "planning"} agentIds={LIVE_AGENT_IDS} />
                ) : (
                  busy === "planning" && <Working text="Starting the planners…" />
                )}
                {busy === "planning" && (
                  <div className="pl-9">
                    <Button size="sm" variant="outline" onClick={() => abort.current?.abort()}>
                      <Square className="size-3.5" /> Stop
                    </Button>
                  </div>
                )}
              </>
            )}

            {plan && (
              <PlanReady
                plan={plan}
                onBook={() => setBookingOpen(true)}
                onRate={rate("plan")}
                onResearch={() => void runResearch()}
                researching={busy === "researching"}
                hasResearch={!!research}
              />
            )}

            {files.length > 0 && (
              <div className="pl-9">
                <FileCards files={files} activeId={openFile?.id} onOpen={setOpenFile} />
              </div>
            )}

            {busy === "researching" && <Working text={researchNote ?? "Searching the web for competitors… this can take a minute."} onStop={() => abort.current?.abort()} />}
            {research && <ResearchCard research={research} />}

            {error && <ErrorCard error={error.error} onRetry={retry} retryLabel={error.error.code === "stopped" ? "Continue" : undefined} />}
          </div>
        </div>

        <Composer
          chatting={chatting}
          busy={!!busy}
          draft={draft}
          setDraft={setDraft}
          onSend={() => sendMessage(draft)}
          hint={
            plan ? (
              <span>
                Change the scope in the{" "}
                <Link href={`/plan/${plan.id}`} className="text-foreground underline underline-offset-4">
                  plan
                </Link>
                . Chatting with the architect is coming next.
              </span>
            ) : pending ? (
              "Answer the question above — your pick is already selected, so you can just press Enter."
            ) : (
              "Working on it…"
            )
          }
        />
      </div>

      {showPanel && openFile && (
        <div className="hidden h-full w-[44%] max-w-2xl min-w-[360px] border-l lg:block">
          <ArtifactPanel file={openFile} onClose={() => setOpenFile(null)} downloadHref={fileHref(openFile)} siblings={files} />
        </div>
      )}

      {isMobile && (
        <Sheet open={!!openFile} onOpenChange={(o) => !o && setOpenFile(null)}>
          <SheetContent side="bottom" className="h-[85svh] p-0">
            <SheetTitle className="sr-only">{openFile?.name ?? "File preview"}</SheetTitle>
            {openFile && <ArtifactPanel file={openFile} onClose={() => setOpenFile(null)} downloadHref={fileHref(openFile)} siblings={files} />}
          </SheetContent>
        </Sheet>
      )}

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} planTitle={plan?.title ?? chat.title} />
    </div>
  );
}

/** The very first thing they typed (the chat's idea becomes the combined text once accepted). */
function firstMessage(chat: ChatDetail): string {
  const firstUser = chat.idea.split("\n\n")[0];
  return firstUser || chat.idea;
}

function Composer({
  chatting,
  busy,
  draft,
  setDraft,
  onSend,
  hint,
}: {
  chatting: boolean;
  busy: boolean;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  hint: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/90 to-transparent pt-10 pb-4 sm:pb-6">
      <div className="pointer-events-auto mx-auto w-full max-w-[var(--chat-width)] px-3 sm:px-6">
        {chatting ? (
          <form
            className={cn(promptSurface, "flex items-end gap-1 p-2 pl-3")}
            onSubmit={(e) => {
              e.preventDefault();
              onSend();
            }}
          >
            <label htmlFor="composer" className="sr-only">
              Describe your app
            </label>
            <Textarea
              id="composer"
              rows={1}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Describe your app: what it does and who it's for…"
              className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0 sm:text-sm dark:bg-transparent"
            />
            <SendButton disabled={!draft.trim() || busy} />
          </form>
        ) : (
          <div className={cn(promptSurface, "px-4 py-3 text-sm text-muted-foreground")}>{hint}</div>
        )}
      </div>
    </div>
  );
}

function RoundBlock({
  round,
  note,
  answers,
  first,
  onSubmit,
  children,
}: {
  round: Round;
  note?: string;
  answers?: Answers;
  first: boolean;
  onSubmit?: (a: Answers) => void;
  children?: React.ReactNode;
}) {
  const count = round.questions.length;
  const intro = first
    ? `**${count} quick ${count === 1 ? "question" : "questions"}** first — my pick is already selected, so you can just press **Enter**.`
    : `**${count} more.**`;
  return (
    <div className="space-y-2">
      <AssistantMessage>{note ? `${note}\n\n${intro}` : intro}</AssistantMessage>
      <QuestionRound round={round} answered={answers} onSubmit={onSubmit ?? (() => undefined)} />
      {children && <div className="pl-9">{children}</div>}
    </div>
  );
}

function Working({ text, onStop }: { text: string; onStop?: () => void }) {
  return (
    <div className="flex items-center gap-3 pl-9 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <span className="min-w-0 flex-1">{text}</span>
      {onStop && (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onStop}>
          <Square className="size-3" /> Stop
        </Button>
      )}
    </div>
  );
}

function PlanReady({
  plan,
  onBook,
  onRate,
  onResearch,
  researching,
  hasResearch,
}: {
  plan: LivePlan;
  onBook: () => void;
  onRate: (r: "up" | "down") => Promise<unknown>;
  onResearch: () => void;
  researching: boolean;
  hasResearch: boolean;
}) {
  const mvp = plan.features.filter((f) => f.included).length;
  const later = plan.features.length - mvp;
  const risk = plan.risks[0]?.title;
  const text = `**Your plan is ready.**

- **Price:** ${formatRange(plan.estimate.priceMin, plan.estimate.priceMax)}
- **Timeline:** ${plan.estimate.duration ?? formatDuration(plan.estimate)}${plan.sizeLabel ? ` · ${plan.sizeLabel} project` : ""}
- **First version:** ${mvp} features, ${later} saved for later${risk ? `\n\nBiggest risk: **${risk}**.` : ""}`;
  return (
    <div className="space-y-1">
      <AssistantMessage>
        {text}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/plan/${plan.id}`}>
              <LayoutDashboard /> Open plan
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={onBook}>
            <CalendarCheck /> Book a call
          </Button>
        </div>
      </AssistantMessage>
      <MessageActions text={text.replace(/\*\*/g, "")} onRate={onRate} className="pl-9">
        <TextAction onClick={onResearch} disabled={researching}>
          <Globe /> {hasResearch ? "Research again" : "Research competitors"}
        </TextAction>
      </MessageActions>
    </div>
  );
}

function ResearchCard({ research }: { research: Research }) {
  const text = [research.summary, ...research.competitors.map((c) => `${c.name} (${c.url}): ${c.note}`)].join("\n");
  return (
    <div className="space-y-1">
      <AssistantMessage>
        <p className="font-medium">From the web</p>
        {research.summary && <p className="mt-1 text-sm text-muted-foreground">{research.summary}</p>}
        {research.competitors.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No clear competitors turned up. That can mean an open market — or a niche worth checking by hand.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {research.competitors.map((c) => (
              <li key={c.url} className="rounded-lg border p-3">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                  {c.name} <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                </a>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.note}</p>
              </li>
            ))}
          </ul>
        )}
      </AssistantMessage>
      <MessageActions text={text} className="pl-9" />
    </div>
  );
}
