import Link from "next/link";
import { cn } from "@/lib/utils";

/** The glyph: a prism cube with three shaded faces — the product you're building. */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M12 3.6 19.4 7.8 12 12 4.6 7.8z" fill="currentColor" />
      <path d="M4.6 7.8 12 12v8.4L4.6 16.2z" fill="currentColor" opacity="0.72" />
      <path d="M19.4 7.8v8.4L12 20.4V12z" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

/**
 * App mark: the cube on a glossy gradient tile (top sheen + inner ring).
 * The gradient is derived from --primary, so it follows the accent colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[9px] text-white ring-1 ring-white/20 ring-inset [&_svg]:size-5",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(180deg, rgb(255 255 255 / 0.22), transparent 45%), linear-gradient(135deg, color-mix(in oklab, var(--primary) 70%, white) 0%, var(--primary) 45%, color-mix(in oklab, var(--primary) 70%, #1e1b4b) 100%)",
      }}
    >
      <LogoGlyph />
    </span>
  );
}

export function Logo({ href = "/", className, subtitle }: { href?: string; className?: string; subtitle?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="grid leading-tight">
        <span className="text-base font-semibold tracking-tight">SpecDesk</span>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </Link>
  );
}
