"use client";

import { useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** The small row under an assistant message: copy, thumbs up/down, plus any extra actions. */
export function MessageActions({
  text,
  onRate,
  children,
  className,
}: {
  /** Plain text to copy. Omit to hide the copy button. */
  text?: string;
  /** Called once with the rating; omit to hide the thumbs. */
  onRate?: (rating: "up" | "down") => Promise<unknown>;
  /** Extra buttons, e.g. "Ask again". */
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<"up" | "down" | null>(null);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy", { description: "Your browser blocked clipboard access. Select the text and copy it instead." });
    }
  };

  const rate = async (r: "up" | "down") => {
    if (!onRate || rated) return;
    setRated(r);
    try {
      await onRate(r);
      toast.success(r === "up" ? "Thanks — glad it helped" : "Thanks — we'll use this to improve");
    } catch {
      setRated(null);
      toast.error("Couldn't save your feedback", { description: "Try again in a moment." });
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-0.5 text-muted-foreground", className)}>
      {text && (
        <IconAction label={copied ? "Copied" : "Copy"} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}
        </IconAction>
      )}
      {onRate && (
        <>
          <IconAction label="Good" onClick={() => void rate("up")} pressed={rated === "up"} disabled={!!rated && rated !== "up"}>
            <ThumbsUp />
          </IconAction>
          <IconAction label="Not good" onClick={() => void rate("down")} pressed={rated === "down"} disabled={!!rated && rated !== "down"}>
            <ThumbsDown />
          </IconAction>
        </>
      )}
      {children}
    </div>
  );
}

function IconAction({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-7 [&_svg]:size-3.5", pressed && "text-foreground")}
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A small text button for the actions row (e.g. "Ask again", "Edit answers"). */
export function TextAction({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground [&_svg]:size-3.5" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
