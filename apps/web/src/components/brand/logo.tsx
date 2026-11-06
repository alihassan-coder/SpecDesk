import Link from "next/link";
import { cn } from "@/lib/utils";

/** The glyph: three inputs converging into one result — many agents, one plan. */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M6.6 6.5C11.5 6.5 11 12 15.5 12M6.6 17.5C11.5 17.5 11 12 15.5 12M6.6 12H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4.75" cy="6.5" r="1.75" fill="currentColor" />
      <circle cx="4.75" cy="12" r="1.75" fill="currentColor" />
      <circle cx="4.75" cy="17.5" r="1.75" fill="currentColor" />
      <circle cx="18.25" cy="12" r="3.25" fill="currentColor" />
    </svg>
  );
}

/** App mark: glyph on a primary rounded square (follows the accent colour). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground", className)}>
      <LogoGlyph className="size-5" />
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
