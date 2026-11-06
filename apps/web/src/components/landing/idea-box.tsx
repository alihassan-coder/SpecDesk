"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const EXAMPLES = ["Camera rental marketplace", "AI notes for law firms", "School bus tracker", "Clinic booking app"];

/* ---- Browser speech recognition (built-in Web Speech API) ---- */
interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
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

export function IdeaBox({ next = "login", examples = true }: { next?: "login" | "chat"; examples?: boolean }) {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [depth, setDepth] = useState("balanced");
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeechSupported();

  useEffect(() => () => recRef.current?.stop(), []);

  const submit = () => {
    const text = idea.trim();
    if (!text) return;
    const q = `idea=${encodeURIComponent(text)}&depth=${depth}`;
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="glass rounded-3xl border-2 border-primary/25 p-2 transition-colors focus-within:border-primary/50 dark:border-primary/30 dark:focus-within:border-primary/60"
      >
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
          placeholder="Describe the app you want to build"
          rows={2}
          className="min-h-16 resize-none border-0 bg-transparent px-3 pt-2 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center gap-1 px-1">
          <Select value={depth} onValueChange={setDepth}>
            <SelectTrigger
              size="sm"
              className="h-8 w-auto gap-1 border-0 bg-transparent px-2 text-muted-foreground shadow-none hover:text-foreground dark:bg-transparent"
              aria-label="Question depth"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick plan</SelectItem>
              <SelectItem value="balanced">Balanced plan</SelectItem>
              <SelectItem value="thorough">Thorough plan</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-1">
            {speech && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("size-8 rounded-full", listening && "text-destructive")}
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
            <Button type="submit" size="icon" className="size-8 rounded-full" disabled={!idea.trim()} aria-label="Plan my app">
              <ArrowUp />
            </Button>
          </div>
        </div>
      </form>

      {examples && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <Button
              key={ex}
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full font-normal"
              onClick={() => {
                setIdea(ex);
                inputRef.current?.focus();
              }}
            >
              {ex}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
