/**
 * Appearance preferences (Settings → Appearance), applied to <html> as CSS variables / data attributes.
 * Light / dark / system is handled separately by next-themes.
 */

export type Density = "comfortable" | "compact";
export type FontChoice = "geist" | "inter" | "system";
export type ChatWidth = "narrow" | "default" | "wide";

export interface Appearance {
  /** null = the theme's default blue */
  accent: string | null;
  radius: number; // rem
  font: FontChoice;
  density: Density;
  chatWidth: ChatWidth;
  reduceMotion: boolean;
}

export const ACCENT_PRESETS: { name: string; hex: string | null; swatch: string }[] = [
  { name: "Blue", hex: null, swatch: "#2563eb" },
  { name: "Violet", hex: "#7c3aed", swatch: "#7c3aed" },
  { name: "Green", hex: "#16a34a", swatch: "#16a34a" },
  { name: "Orange", hex: "#ea580c", swatch: "#ea580c" },
  { name: "Rose", hex: "#e11d48", swatch: "#e11d48" },
  { name: "Neutral", hex: "#171717", swatch: "#171717" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  accent: null,
  radius: 0.625,
  font: "geist",
  density: "comfortable",
  chatWidth: "default",
  reduceMotion: false,
};

export const CHAT_WIDTHS: Record<ChatWidth, string> = {
  narrow: "640px",
  default: "768px",
  wide: "960px",
};

/** Readable text colour (near-black or white) on top of a given background. */
export function contrastText(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#171717" : "#fafafa";
}

export const STORAGE_KEY = "specdesk.appearance.v2";
