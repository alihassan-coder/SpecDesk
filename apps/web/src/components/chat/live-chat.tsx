"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarCheck, LayoutDashboard, Loader2 } from "lucide-react";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { promptSurface } from "@/components/prompt/prompt-parts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError, api, streamEvents, type AnsweredRound, type ChatDetail, type LivePlan, type SseEvent } from "@/lib/api";
import { humanize, type HumanError } from "@/lib/errors";
import { formatRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIVE_AGENT_IDS } from "@/mocks/data";
import type { PlanFile, QuestionRound as Round, StreamEvent } from "@/mocks/types";
import { AgentTimeline } from "./agent-timeline";
import { ArtifactPanel } from "./artifact-panel";
import { AssistantMessage, UserBubble } from "./chat-view";
import { FileCards } from "./file-cards";
import { QuestionRound, type Answers } from "./question-round";
import { ErrorCard } from "./status-cards";

/** What the screen is doing right now. */
type Busy = null | "thinking" | "planning";
/** Which call to repeat when the founder presses Retry. */
type RetryStep = "interview" | "answers" | "plan" | "load";

const asError = (e: unknown): HumanError => (e instanceof ApiError ? e.error : humanize("server_error"));

/**
 * A real planning chat: interview rounds from the interviewer agent, then the planning agents,
 * all streamed from the API. A refresh picks up where the chat stands — no model call is repeated.
 */
export function LiveChat({ chatId }: { chatId: string }) {
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [rounds, setRounds] = useState<AnsweredRound[]>([]);
  const [pending, setPending] = useState<Round | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({}); // interviewer's "why", per round
  const [brief, setBrief] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<StreamEvent[]>([]);
  const [files, setFiles] = useState<PlanFile[]>([]);
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<{ error: HumanError; retry: RetryStep } | null>(null);
  const [openFile, setOpenFile] = useState<PlanFile | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const lastAnswers = useRef<Answers | null>(null);
  const started = useRef(false); // survives React's dev double-mount, so nothing runs twice
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // ---------- streaming ----------

  const handle = useCallback((e: SseEvent, roundNumber: number) => {
    const data = (e.data ?? {}) as Record<string, unknown>;
    switch (e.event) {
      case "agent.status":
      case "agent.note":
      case "agent.reasoning":
        if (data.agent === "interviewer") {
          if (e.event === "agent.note") setNotes((n) => ({ ...n, [roundNumber]: String(data.text) }));
          return;
        }
        setAgentEvents((prev) => [...prev, { type: e.event, ...data } as StreamEvent]);
        return;
      case "question.round":
        setPending(data.round as Round);
        return;
      case "interview.done":
        setBrief(String(data.brief ?? ""));
        return;
      case "file.ready":
        setFiles((prev) => {
          const file = data.file as PlanFile;
          return prev.some((f) => f.id === file.id) ? prev : [...prev, file];
        });
        return;
      case "done":
        void api.getPlan(String(data.planId)).then(setPlan, (err: unknown) => setError({ error: asError(err), retry: "load" }));
        return;
      case "error":
        throw new ApiError(data as unknown as HumanError, 0);
    }
  }, []);

  const runPlan = useCallback(async () => {
    setError(null);
    setBusy("planning");
    setAgentEvents([]);
    try {
      await streamEvents(`/chats/${chatId}/plan`, (e) => handle(e, 0));
    } catch (err) {
      setError({ error: asError(err), retry: "plan" });
    } finally {
      setBusy(null);
    }
  }, [chatId, handle]);

  const runInterview = useCallback(
    async (path: string, body: unknown, roundNumber: number, retry: RetryStep) => {
      setError(null);
      setBusy("thinking");
      let finished = false;
      try {
        await streamEvents(path, (e) => {
          if (e.event === "interview.done") finished = true;
          handle(e, roundNumber);
        }, { body });
      } catch (err) {
        setError({ error: asError(err), retry });
        return;
      } finally {
        setBusy(null);
      }
      if (finished) await runPlan(); // the plan starts on its own once the interview is done
    },
    [handle, runPlan],
  );

  // ---------- first load ----------

  const load = useCallback(async () => {
    setError(null);
    let detail: ChatDetail;
    try {
      detail = await api.getChat(chatId);
    } catch (err) {
      setError({ error: asError(err), retry: "load" });
      return;
    }
    setChat(detail);
    setRounds(detail.rounds);
    setPending(detail.pending);
    setBrief(detail.brief);

    if (detail.planId) {
      // Finished: the plan stream just re-sends its files and the plan id, no model calls.
      await runPlan();
    } else if (detail.brief) {
      await runPlan();
    } else if (!detail.pending) {
      await runInterview(`/chats/${chatId}/interview`, undefined, detail.rounds.length + 1, "interview");
    }
  }, [chatId, runInterview, runPlan]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  // ---------- actions ----------

  const submitAnswers = (answers: Answers) => {
    if (!pending) return;
    lastAnswers.current = answers;
    const answered = { round: pending, answers };
    setRounds((r) => [...r, answered]);
    setPending(null);
    void runInterview(`/chats/${chatId}/answers`, { answers }, pending.round + 1, "answers");
  };

  const retry = () => {
    if (!error) return;
    if (error.retry === "load") void load();
    if (error.retry === "plan") void runPlan();
    if (error.retry === "interview") void runInterview(`/chats/${chatId}/interview`, undefined, rounds.length + 1, "interview");
    if (error.retry === "answers" && lastAnswers.current) {
      // The answers didn't reach the server: put the round back so it can be sent again.
      const last = rounds[rounds.length - 1];
      if (last) {
        setRounds((r) => r.slice(0, -1));
        setPending(last.round);
      }
      setError(null);
    }
  };

  // Follow new content.
  const contentCount = rounds.length + (pending ? 1 : 0) + agentEvents.length + files.length + (plan ? 1 : 0) + (error ? 1 : 0);
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
  const showPanel = !!openFile && !isMobile;
  const fileHref = (f: PlanFile) => (plan ? api.fileUrl(plan.id, f.name) : undefined);

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <h1 className="sr-only">{chat.title}</h1>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-6 px-4 pt-6 pb-44 sm:px-6">
            <UserBubble text={chat.idea} />

            {rounds.map((r) => (
              <RoundBlock key={r.round.round} round={r.round} note={notes[r.round.round]} answers={r.answers} first={r.round.round === 1} />
            ))}

            {pending && <RoundBlock round={pending} note={notes[pending.round]} first={pending.round === 1} onSubmit={submitAnswers} />}

            {busy === "thinking" && <Thinking text={rounds.length === 0 ? "Reading your idea…" : "Reading your answers…"} />}

            {brief !== null && planning && (
              <>
                <AssistantMessage>{plan ? "Here's what the agents worked out." : "Got it. **The agents are planning it now** — this takes about a minute."}</AssistantMessage>
                {agentEvents.length > 0 ? (
                  <AgentTimeline events={agentEvents} running={busy === "planning"} agentIds={LIVE_AGENT_IDS} />
                ) : (
                  busy === "planning" && <Thinking text="Starting the planners…" />
                )}
              </>
            )}

            {plan && <PlanReady plan={plan} onBook={() => setBookingOpen(true)} />}

            {files.length > 0 && (
              <div className="pl-9">
                <FileCards files={files} activeId={openFile?.id} onOpen={setOpenFile} />
              </div>
            )}

            {error && <ErrorCard error={error.error} onRetry={retry} />}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/90 to-transparent pt-10 pb-4 sm:pb-6">
          <div className="pointer-events-auto mx-auto w-full max-w-[var(--chat-width)] px-3 sm:px-6">
            <div className={cn(promptSurface, "px-4 py-3 text-sm text-muted-foreground")}>
              {plan ? (
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
              )}
            </div>
          </div>
        </div>
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

function RoundBlock({
  round,
  note,
  answers,
  first,
  onSubmit,
}: {
  round: Round;
  note?: string;
  answers?: Answers;
  first: boolean;
  onSubmit?: (a: Answers) => void;
}) {
  const count = round.questions.length;
  const intro = first
    ? `**${count} quick ${count === 1 ? "question" : "questions"}** first — my pick is already selected, so you can just press **Enter**.`
    : `**${count} more.**`;
  return (
    <>
      <AssistantMessage>{note ? `${note}\n\n${intro}` : intro}</AssistantMessage>
      <QuestionRound round={round} answered={answers} onSubmit={onSubmit ?? (() => undefined)} />
    </>
  );
}

function Thinking({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 pl-9 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {text}
    </div>
  );
}

function PlanReady({ plan, onBook }: { plan: LivePlan; onBook: () => void }) {
  const mvp = plan.features.filter((f) => f.included).length;
  const later = plan.features.length - mvp;
  const risk = plan.risks[0]?.title;
  const text = `**Your plan is ready.**

- **Price:** ${formatRange(plan.estimate.priceMin, plan.estimate.priceMax)}
- **Timeline:** ${plan.estimate.weeks} weeks
- **First version:** ${mvp} features, ${later} saved for later${risk ? `\n\nBiggest risk: **${risk}**.` : ""}`;
  return (
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
  );
}
