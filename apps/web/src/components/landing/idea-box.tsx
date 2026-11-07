"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, CircleDollarSign, Lightbulb, Mic, MonitorSmartphone, Paperclip, SlidersHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BeamBloom, SendButton, promptSurface } from "@/components/prompt/prompt-parts";

const EXAMPLES = [
  "A marketplace where photographers rent camera gear to each other",
  "An AI note-taker for law firms that drafts follow-up emails",
  "A school bus tracker that alerts parents before arrival",
  "A booking and home-exercise app for physiotherapists",
];

const PLATFORMS = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "both", label: "Web + mobile" },
];

const BUDGETS = [
  { value: "lt10", label: "Under $10k" },
  { value: "10-25", label: "$10k – $25k" },
  { value: "25-50", label: "$25k – $50k" },
  { value: "gt50", label: "$50k+" },
];

const DEPTHS = [
  { value: "quick", label: "Quick", hint: "Fewer questions" },
  { value: "balanced", label: "Balanced", hint: "Recommended" },
  { value: "thorough", label: "Thorough", hint: "Tighter estimate" },
];

/* ---- Browser speech recognition (built-in Web Speech API) ---- */
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const useSpeechSupported = () =>
  useSyncExternalStore(
    () => () => {},
    () => getRecognition() !== null,
    () => false,
  );

/** Small grey pill used in the toolbar (shadcn Button, secondary). */
function Pill({ icon: Icon, children, active, ...props }: React.ComponentProps<typeof Button> & { icon: typeof Lightbulb; active?: boolean }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn("h-8 gap-1.5 rounded-lg px-2 font-normal sm:px-2.5", active && "bg-primary/10 text-primary hover:bg-primary/15")}
      {...props}
    >
      <Icon className="size-4" />
      <span className={cn("max-w-28 truncate", !active && "sr-only sm:not-sr-only")}>{children}</span>
    </Button>
  );
}

export function IdeaBox({ next = "login" }: { next?: "login" | "chat" }) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [depth, setDepth] = useState("balanced");
  const [platform, setPlatform] = useState("");
  const [budget, setBudget] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const speech = useSpeechSupported();

  useEffect(() => () => recRef.current?.stop(), []);

  const submit = () => {
    const text = idea.trim();
    if (!text) return;
    const q = new URLSearchParams({ idea: text, depth });
    if (platform) q.set("platform", platform);
    if (budget) q.set("budget", budget);
    router.push(next === "chat" ? `/chat/new?${q}` : `/login?${q}`);
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    const base = idea;
    rec.onresult = (e) => {
      const said = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setIdea(base ? `${base} ${said}` : said);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const platformLabel = PLATFORMS.find((p) => p.value === platform)?.label;
  const budgetLabel = BUDGETS.find((b) => b.value === budget)?.label;

  return (
    <div data-beam="outer" className="mx-auto w-full max-w-2xl shadow-sm">
      <BeamBloom />
    <form
      data-beam
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(promptSurface, "p-3")}
    >
      <BeamBloom />
      <label htmlFor="idea" className="sr-only">
        Describe your app idea
      </label>
      <Textarea
        ref={inputRef}
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Describe the app you want to build…"
        rows={3}
        className="min-h-20 resize-none border-0 bg-transparent px-1 py-1 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
      />

      {file && (
        <div className="mt-1 mb-2 inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/50 py-1 pr-1 pl-2 text-xs">
          <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {/* depth */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground" aria-label="Plan depth">
                  <SlidersHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Plan depth</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Plan depth</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={depth} onValueChange={setDepth}>
              {DEPTHS.map((d) => (
                <DropdownMenuRadioItem key={d.value} value={d.value}>
                  <span className="flex flex-1 items-center justify-between gap-2">
                    {d.label}
                    <span className="text-xs text-muted-foreground">{d.hint}</span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {/* platform */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Pill icon={MonitorSmartphone} active={!!platform}>
                {platformLabel ?? "Platform"}
              </Pill>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup value={platform} onValueChange={setPlatform}>
                {PLATFORMS.map((p) => (
                  <DropdownMenuRadioItem key={p.value} value={p.value}>
                    {p.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* budget */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Pill icon={CircleDollarSign} active={!!budget}>
                {budgetLabel ?? "Budget"}
              </Pill>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup value={budget} onValueChange={setBudget}>
                {BUDGETS.map((b) => (
                  <DropdownMenuRadioItem key={b.value} value={b.value}>
                    {b.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* examples */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Pill icon={Lightbulb}>Examples</Pill>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
              {EXAMPLES.map((ex) => (
                <DropdownMenuItem
                  key={ex}
                  onSelect={() => {
                    setIdea(ex);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                >
                  {idea === ex && <Check />}
                  <span className="whitespace-normal">{ex}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.md,.txt,.png,.jpg,.jpeg"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground" onClick={() => fileRef.current?.click()} aria-label="Attach a brief">
                <Paperclip />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach a brief</TooltipContent>
          </Tooltip>
          {speech && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn("size-8 rounded-lg text-muted-foreground", listening && "text-destructive")}
                  onClick={toggleMic}
                  aria-label={listening ? "Stop dictation" : "Dictate your idea"}
                  aria-pressed={listening}
                >
                  {listening ? <Square className="size-3.5 fill-current" /> : <Mic />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{listening ? "Stop" : "Speak"}</TooltipContent>
            </Tooltip>
          )}
          <SendButton disabled={!idea.trim()} label="Plan my app" />
        </div>
      </div>
    </form>
    </div>
  );
}

