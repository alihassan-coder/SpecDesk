import { cn } from "@/lib/utils";

/** One faint, static glow at the top — enough for the glass header to read. */
export function Backdrop({ fixed = false }: { fixed?: boolean }) {
  return (
    <div className={cn("pointer-events-none inset-0 -z-10 overflow-hidden", fixed ? "fixed" : "absolute")} aria-hidden="true">
      <div className="absolute -top-64 left-1/2 h-[30rem] w-[56rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-primary/[0.08]" />
    </div>
  );
}
