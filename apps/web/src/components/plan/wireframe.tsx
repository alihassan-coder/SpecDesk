import type { WireBlock } from "@/mocks/types";
import { cn } from "@/lib/utils";

const height: Record<WireBlock["kind"], string> = {
  nav: "h-6",
  header: "h-7",
  text: "h-5",
  input: "h-7",
  button: "h-7",
  card: "h-16",
  list: "h-20",
  image: "h-24",
  chart: "h-20",
  tabs: "h-6",
};

/** Low-fi wireframe drawn from a block list — deliberately sketchy, so nobody mistakes it for final design. */
export function Wireframe({ blocks, className }: { blocks: WireBlock[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-4 gap-1.5 rounded-lg border bg-background p-2", className)} aria-hidden="true">
      {blocks.map((b, i) => (
        <div
          key={i}
          style={{ gridColumn: `span ${b.span ?? 4}` }}
          className={cn(
            "flex items-center justify-center rounded-sm border border-dashed border-muted-foreground/30 px-1 text-[10px] text-muted-foreground",
            height[b.kind],
            b.kind === "button" && "border-solid border-primary/60 bg-primary/15 text-foreground",
            b.kind === "image" && "bg-muted",
            b.kind === "chart" && "bg-[linear-gradient(to_top,var(--muted)_40%,transparent_40%)]",
          )}
        >
          <span className="truncate">{b.label ?? b.kind}</span>
        </div>
      ))}
    </div>
  );
}
