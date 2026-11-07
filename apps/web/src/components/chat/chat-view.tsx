"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, LayoutDashboard, Paperclip } from "lucide-react";
import { BookingDialog } from "@/components/booking/booking-dialog";
import { LogoMark } from "@/components/brand/logo";
import { SendButton, promptSurface } from "@/components/prompt/prompt-parts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMockStream } from "@/hooks/use-mock-stream";
import { DEMO_PLAN, PIPELINE_SCRIPT, ROUND_1, ROUND_2 } from "@/mocks/data";
import type { PlanFile, StreamEvent } from "@/mocks/types";
import { humanize, type HumanError } from "@/lib/errors";
import { formatRange } from "@/lib/format";
import { estimate } from "@/lib/pricing";
import { looksLikeSoftware } from "@/lib/scope-guard";
import { cn } from "@/lib/utils";
import { AgentTimeline } from "./agent-timeline";
import { ArtifactPanel } from "./artifact-panel";
import { FileCards } from "./file-cards";
import { Markdown } from "./markdown";
import { QuestionRound, recommendedAnswers, type Answers } from "./question-round";
import { ErrorCard } from "./status-cards";

type Phase = "off-topic" | "round1" | "round2" | "pipeline" | "ready" | "error";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const est = estimate(DEMO_PLAN.features, DEMO_PLAN);
const mvpCount = DEMO_PLAN.features.filter((f) => f.included).length;
const laterCount = DEMO_PLAN.features.length - mvpCount;

const COPY = {
  intro: `Nice idea. **${ROUND_1.questions.length} quick questions** first — my pick is already selected, so you can just press **Enter**.`,
  round2: "Two more, about how patients will use it.",
  planning: "Got it. **Seven agents** are planning it now.",
  ready: `**Your plan is ready.**

- **Price:** ${formatRange(est.priceMin, est.priceMax)}
- **Timeline:** ${est.weeks} weeks
- **MVP:** ${mvpCount} features, ${laterCount} saved for later

Biggest risk is **health data rules**. You can change the scope in the plan.`,
};

export function ChatView({
  idea,
  title,
  startFinished = false,
  forceError,
}: {
  idea: string;
  title: string;
  startFinished?: boolean;
  forceError?: string;
}) {
  const initialPhase: Phase = forceError ? "error" : !looksLikeSoftware(idea) ? "off-topic" : startFinished ? "ready" : "round1";
  const [phaseState, setPhase] = useState<Phase>(initialPhase);
  const [answers1, setAnswers1] = useState<Answers | undefined>(startFinished ? recommendedAnswers(ROUND_1) : undefined);
  const [answers2, setAnswers2] = useState<Answers | undefined>(startFinished ? recommendedAnswers(ROUND_2) : undefined);
  const [extra, setExtra] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [openFile, setOpenFile] = useState<PlanFile | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [error, setError] = useState<HumanError | null>(forceError ? humanize(forceError) : null);
  const stream = useMockStream(PIPELINE_SCRIPT, 1);
  const streamDone = stream.events.some((e) => e.type === "done");
  // Derived, not synced: the pipeline becomes "ready" as soon as the stream says done.
  const phase: Phase = phaseState === "pipeline" && streamDone ? "ready" : phaseState;
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef<number | null>(null);

  // Finished chats show the whole stream immediately.
  const events: StreamEvent[] = useMemo(
    () => (startFinished && phase === "ready" && stream.events.length === 0 ? PIPELINE_SCRIPT.map((s) => s.event) : stream.events),
    [startFinished, phase, stream.events],
  );

  const files = events.flatMap((e) => (e.type === "file.ready" ? [e.file] : []));
  const done = events.some((e) => e.type === "done");

  // Follow new content inside the conversation pane only when something new arrives.
  const contentCount = events.length + extra.length + (answers1 ? 1 : 0) + (answers2 ? 1 : 0);
  useEffect(() => {
    const prev = lastCount.current;
    lastCount.current = contentCount;
    if (prev === null || contentCount <= prev) return;
    const el = scrollRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [contentCount]);

  const sendDraft = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const reply =
      phase === "ready"
        ? "Noted. I'll apply that and save it as **v3** of the plan."
        : "Noted — I'll use that. Finish the questions above when you're ready.";
    setExtra((t) => [...t, { id: crypto.randomUUID(), role: "user", text }, { id: crypto.randomUUID(), role: "assistant", text: reply }]);
  };

  const showPanel = !!openFile && !isMobile;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
      <div className="relative flex min-w-0 flex-1 flex-col">
        <h1 className="sr-only">{title}</h1>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[var(--chat-width)] space-y-6 px-4 pt-6 pb-44 sm:px-6">
            <UserBubble text={idea} />

            {phase === "off-topic" ? (
              <ErrorCard error={humanize("not_software")} />
            ) : (
              <>
                <AssistantMessage>{COPY.intro}</AssistantMessage>

                {phase !== "error" && (
                  <QuestionRound
                    round={ROUND_1}
                    answered={answers1}
                    onSubmit={(a) => {
                      setAnswers1(a);
                      setPhase("round2");
                    }}
                  />
                )}

                {answers1 && (
                  <>
                    <AssistantMessage>{COPY.round2}</AssistantMessage>
                    <QuestionRound
                      round={ROUND_2}
                      answered={answers2}
                      onSubmit={(a) => {
                        setAnswers2(a);
                        setPhase("pipeline");
                        stream.start();
                      }}
                    />
                  </>
                )}

                {(phase === "pipeline" || phase === "ready") && (
                  <>
                    <AssistantMessage>{COPY.planning}</AssistantMessage>
                    <AgentTimeline events={events} running={stream.running} />
                  </>
                )}

                {done && (
                  <AssistantMessage>
                    {COPY.ready}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href="/plan/demo">
                          <LayoutDashboard /> Open plan
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setBookingOpen(true)}>
                        <CalendarCheck /> Book a call
                      </Button>
                    </div>
                  </AssistantMessage>
                )}

                {files.length > 0 && (
                  <div className="pl-9">
                    <FileCards files={files} activeId={openFile?.id} onOpen={setOpenFile} />
                  </div>
                )}

                {error && (
                  <ErrorCard
                    error={error}
                    onRetry={() => {
                      setError(null);
                      setPhase("round1");
                    }}
                  />
                )}
              </>
            )}

            {extra.map((t) =>
              t.role === "user" ? <UserBubble key={t.id} text={t.text} /> : <AssistantMessage key={t.id}>{t.text}</AssistantMessage>,
            )}
          </div>
        </div>

        {/* Floating composer */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-background via-background/90 to-transparent pt-10 pb-4 sm:pb-6">
          <form
            className="pointer-events-auto mx-auto w-full max-w-[var(--chat-width)] px-3 sm:px-6"
            onSubmit={(e) => {
              e.preventDefault();
              sendDraft();
            }}
          >
            <div>
              <div className={cn(promptSurface, "flex items-end gap-1 p-2 pl-3")}>
                <label htmlFor="composer" className="sr-only">
                  Message
                </label>
                <Textarea
                  id="composer"
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendDraft();
                    }
                  }}
                  placeholder={phase === "ready" ? "Ask for a change to the plan…" : "Add a detail or ask a question…"}
                  className="max-h-40 min-h-9 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus-visible:ring-0 sm:text-sm dark:bg-transparent"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 rounded-xl text-muted-foreground" aria-label="Attach a file">
                      <Paperclip />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach a file</TooltipContent>
                </Tooltip>
                <SendButton disabled={!draft.trim()} />
              </div>
            </div>
          </form>
        </div>
      </div>

      {showPanel && openFile && (
        <div className="hidden h-full w-[44%] max-w-2xl min-w-[360px] border-l lg:block">
          <ArtifactPanel file={openFile} onClose={() => setOpenFile(null)} />
        </div>
      )}

      {isMobile && (
        <Sheet open={!!openFile} onOpenChange={(o) => !o && setOpenFile(null)}>
          <SheetContent side="bottom" className="h-[85svh] p-0">
            <SheetTitle className="sr-only">{openFile?.name ?? "File preview"}</SheetTitle>
            {openFile && <ArtifactPanel file={openFile} onClose={() => setOpenFile(null)} />}
          </SheetContent>
        </Sheet>
      )}

      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} planTitle={DEMO_PLAN.title} />
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-primary-foreground">{text}</p>
    </div>
  );
}

function AssistantMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 size-6 rounded-md [&_svg]:size-4" />
      <div className="min-w-0 flex-1">{typeof children === "string" ? <Markdown>{children}</Markdown> : <MixedMessage>{children}</MixedMessage>}</div>
    </div>
  );
}

/** Lets a message start with Markdown text and add React nodes (e.g. buttons) after it. */
function MixedMessage({ children }: { children: React.ReactNode }) {
  const parts = Array.isArray(children) ? children : [children];
  return (
    <>
      {parts.map((p, i) => (typeof p === "string" ? <Markdown key={i}>{p}</Markdown> : <div key={i}>{p}</div>))}
    </>
  );
}
