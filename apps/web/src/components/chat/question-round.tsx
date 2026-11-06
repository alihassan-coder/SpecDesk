"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { Question, QuestionRound as Round } from "@/mocks/types";
import { cn } from "@/lib/utils";

export type Answers = Record<string, { optionId?: string; text?: string; skipped?: boolean }>;

export function recommendedAnswers(round: Round): Answers {
  return Object.fromEntries(round.questions.map((q) => [q.id, { optionId: q.recommended }]));
}

function answerLabel(q: Question, a?: Answers[string]) {
  if (!a || a.skipped) return "Skipped";
  if (a.text) return a.text;
  return q.options.find((o) => o.id === a.optionId)?.label ?? "—";
}

/**
 * One question at a time: pick an option (the recommended one is pre-selected),
 * then Next. Keys: 1–9 pick, Enter next, ← back. Answered rounds collapse to a summary.
 */
export function QuestionRound({
  round,
  onSubmit,
  answered,
}: {
  round: Round;
  onSubmit: (answers: Answers) => void;
  answered?: Answers;
}) {
  if (answered) return <RoundSummary round={round} answers={answered} />;
  return <Stepper round={round} onSubmit={onSubmit} />;
}

function Stepper({ round, onSubmit }: { round: Round; onSubmit: (answers: Answers) => void }) {
  const [answers, setAnswers] = useState<Answers>(() => recommendedAnswers(round));
  const [index, setIndex] = useState(0);
  const [otherOpen, setOtherOpen] = useState(false);

  const q = round.questions[index];
  const a = answers[q.id] ?? {};
  const last = index === round.questions.length - 1;
  const total = round.questions.length;

  const set = (value: Answers[string]) => setAnswers((prev) => ({ ...prev, [q.id]: value }));
  const go = (to: number) => {
    setOtherOpen(false);
    setIndex(to);
  };
  const next = (override?: Answers) => {
    if (last) onSubmit(override ?? answers);
    else go(index + 1);
  };
  const skip = () => {
    const updated = { ...answers, [q.id]: { skipped: true } };
    setAnswers(updated);
    next(updated);
  };

  return (
    <div
      className="glass rounded-2xl p-4 outline-none sm:p-5"
      tabIndex={-1}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).tagName === "INPUT") {
          if (e.key === "Enter") next();
          return;
        }
        const n = Number(e.key);
        if (n >= 1 && n <= q.options.length) set({ optionId: q.options[n - 1].id });
        if (e.key === "Enter") next();
        if (e.key === "ArrowLeft" && index > 0) go(index - 1);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          Question {index + 1} of {total}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {round.questions.map((x, i) => (
            <span
              key={x.id}
              className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : i < index ? "w-1.5 bg-primary/60" : "w-1.5 bg-foreground/15")}
            />
          ))}
        </div>
      </div>

      <div key={q.id} className="animate-in fade-in slide-in-from-right-2 duration-200 motion-reduce:animate-none">
        <h3 className="mt-3 text-base font-semibold sm:text-lg">{q.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{q.body}</p>

        <div className="mt-4 grid gap-2" role="radiogroup" aria-label={q.title}>
          {q.options.map((o, i) => {
            const selected = a.optionId === o.id && !a.skipped && !a.text;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setOtherOpen(false);
                  set({ optionId: o.id });
                }}
                onDoubleClick={() => next({ ...answers, [q.id]: { optionId: o.id } })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  selected ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] text-muted-foreground tabular-nums">
                  {selected ? <Check className="size-3.5 text-primary" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{o.label}</span>
                  {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
                </span>
                {o.id === q.recommended && (
                  <Badge variant="secondary" className="shrink-0">
                    Recommended
                  </Badge>
                )}
              </button>
            );
          })}

          {otherOpen || a.text ? (
            <Input
              autoFocus
              placeholder="Type your answer"
              value={a.text ?? ""}
              onChange={(e) => set({ text: e.target.value })}
              aria-label={`Your answer to: ${q.title}`}
              className="h-10 rounded-xl"
            />
          ) : (
            <button
              type="button"
              onClick={() => setOtherOpen(true)}
              className="rounded-xl border border-dashed px-3 py-2.5 text-left text-sm text-muted-foreground hover:text-foreground"
            >
              Something else…
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous question">
          <ArrowLeft />
        </Button>
        <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
          Skip
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => next()}>
          {last ? "Done" : "Next"} <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

function RoundSummary({ round, answers }: { round: Round; answers: Answers }) {
  const [open, setOpen] = useState(false);
  const first = round.questions[0];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-auto w-full max-w-md rounded-2xl border bg-muted/40">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm">
        <Check className="size-4 shrink-0 text-success" />
        <span className="shrink-0 font-medium">{round.questions.length} answers</span>
        <span className="truncate text-muted-foreground">· {answerLabel(first, answers[first.id])}…</span>
        <ChevronDown className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="space-y-2 border-t px-4 py-3 text-sm">
          {round.questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
              <dt className="text-muted-foreground">{q.title}</dt>
              <dd className="font-medium sm:text-right">{answerLabel(q, answers[q.id])}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Plain-text summary of a round. */
export function summarizeAnswers(round: Round, answers: Answers) {
  return round.questions.map((q) => `${q.title}: ${answerLabel(q, answers[q.id])}`).join("\n");
}
