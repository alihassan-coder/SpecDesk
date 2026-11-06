/** User appearance settings. Applied as CSS variables / data attributes on <html>. Saved per user in M3+. */

export type ThemeMode = "dark" | "light" | "system";
export type Density = "comfortable" | "compact";
export type FontChoice = "archivo" | "inter" | "system";
export type ChatWidth = "narrow" | "default" | "wide";

export interface Appearance {
  theme: ThemeMode;
  accent: string; // hex
  radius: number; // rem
  font: FontChoice;
  density: Density;
  chatWidth: ChatWidth;
  reduceMotion: boolean;
}

export const ACCENT_PRESETS = [
  { name: "Highlighter", hex: "#F5B544" },
  { name: "Signal", hex: "#6CC6E8" },
  { name: "Mint", hex: "#5FD4A6" },
  { name: "Coral", hex: "#F27A6B" },
  { name: "Violet", hex: "#A78BFA" },
  { name: "Paper", hex: "#E8ECF4" },
];

export const DEFAULT_APPEARANCE: Appearance = {
  theme: "dark",
  accent: "#F5B544",
  radius: 0.5,
  font: "archivo",
  density: "comfortable",
  chatWidth: "default",
  reduceMotion: false,
};

export const CHAT_WIDTHS: Record<ChatWidth, string> = {
  narrow: "640px",
  default: "760px",
  wide: "960px",
};

/** Pick readable text (ink or paper) for a given accent background. */
export function contrastText(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0C1220" : "#F6F7FA";
}

export const STORAGE_KEY = "specdesk.appearance";
