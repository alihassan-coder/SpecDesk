/** Calendly booking link. Public, not a secret. Override with NEXT_PUBLIC_CALENDLY_URL. */
export const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/alihassan-plotap/free-call";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Builds the inline-embed URL Calendly's own widget.js uses, with prefill:
 * name, email, plan (custom answer a1) and an optional pre-selected date.
 */
export function calendlyEmbedUrl({
  name,
  email,
  planTitle,
  date,
  dark,
}: {
  name?: string;
  email?: string;
  planTitle?: string;
  date?: Date;
  dark?: boolean;
}) {
  const url = new URL(CALENDLY_URL);
  url.searchParams.set("embed_type", "Inline");
  url.searchParams.set("embed_domain", typeof window === "undefined" ? "localhost" : window.location.host);
  url.searchParams.set("hide_gdpr_banner", "1");
  if (name) url.searchParams.set("name", name);
  if (email) url.searchParams.set("email", email);
  if (planTitle) url.searchParams.set("a1", `Plan: ${planTitle}`);
  if (date) {
    url.searchParams.set("month", `${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
    url.searchParams.set("date", `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  if (dark) {
    url.searchParams.set("background_color", "0a0a0a");
    url.searchParams.set("text_color", "fafafa");
  }
  url.searchParams.set("primary_color", "2563eb");
  return url.toString();
}

/** Calendly posts these from the embed iframe (same events widget.js exposes). */
export function isCalendlyEvent(e: MessageEvent, name: string) {
  return e.origin === "https://calendly.com" && typeof e.data === "object" && e.data !== null && (e.data as { event?: string }).event === name;
}

/** Direct (non-embed) Calendly link that opens on a given day, prefilled. */
export function calendlyBookingUrl({ name, email, planTitle, date }: { name?: string; email?: string; planTitle?: string; date?: Date }) {
  const url = new URL(CALENDLY_URL);
  if (name) url.searchParams.set("name", name);
  if (email) url.searchParams.set("email", email);
  if (planTitle) url.searchParams.set("a1", `Plan: ${planTitle}`);
  if (date) {
    url.searchParams.set("month", `${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
    url.searchParams.set("date", `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
  }
  return url.toString();
}
