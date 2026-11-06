"use client";

import { ThemeProvider } from "next-themes";
import { createContext, useCallback, useContext, useEffect } from "react";
import { type Appearance, CHAT_WIDTHS, DEFAULT_APPEARANCE, STORAGE_KEY, contrastText } from "@/lib/appearance";
import { createLocalStore } from "@/lib/local-store";

interface AppearanceContextValue {
  appearance: Appearance;
  update: (patch: Partial<Appearance>) => void;
  reset: () => void;
}

const store = createLocalStore<Appearance>(STORAGE_KEY, DEFAULT_APPEARANCE, (raw) => ({
  ...DEFAULT_APPEARANCE,
  ...(JSON.parse(raw) as Partial<Appearance>),
}));

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

const ACCENT_VARS = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--chart-1"];

function applyToDocument(a: Appearance) {
  const root = document.documentElement;
  if (a.accent) {
    for (const v of ACCENT_VARS) root.style.setProperty(v, a.accent);
    root.style.setProperty("--primary-foreground", contrastText(a.accent));
    root.style.setProperty("--sidebar-primary-foreground", contrastText(a.accent));
  } else {
    for (const v of [...ACCENT_VARS, "--primary-foreground", "--sidebar-primary-foreground"]) root.style.removeProperty(v);
  }
  root.style.setProperty("--radius", `${a.radius}rem`);
  root.style.setProperty("--chat-width", CHAT_WIDTHS[a.chatWidth]);
  root.dataset.density = a.density;
  root.dataset.font = a.font;
  root.dataset.reduceMotion = String(a.reduceMotion);
}

/** next-themes (light/dark/system) + SpecDesk appearance preferences. */
export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const appearance = store.useValue();

  // Syncs React state → DOM (external system). No setState here.
  useEffect(() => applyToDocument(appearance), [appearance]);

  const update = useCallback((patch: Partial<Appearance>) => store.write({ ...store.read(), ...patch }), []);
  const reset = useCallback(() => store.write(DEFAULT_APPEARANCE), []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AppearanceContext.Provider value={{ appearance, update, reset }}>{children}</AppearanceContext.Provider>
    </ThemeProvider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside <AppearanceProvider>");
  return ctx;
}
