import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Bloom layer for the prompt beam. Put inside an element with the `data-beam` attribute (see globals.css). */
export function BeamBloom() {
  return <div data-beam-bloom aria-hidden="true" />;
}

/** Square send button: grey while empty, solid primary when there's something to send. */
export function SendButton({ disabled, label = "Send" }: { disabled: boolean; label?: string }) {
  return (
    <Button
      type="submit"
      size="icon"
      className="ml-0.5 size-9 shrink-0 rounded-xl transition-transform active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 [&_svg]:size-[18px]"
      disabled={disabled}
      aria-label={label}
    >
      <Send className="-translate-x-px translate-y-px" />
    </Button>
  );
}

/** Card surface shared by the idea box and the chat composer. */
export const promptSurface = "w-full rounded-2xl border bg-card text-left shadow-sm transition-colors focus-within:border-ring/60";
