"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useSidebar } from "@/components/ui/sidebar";

/** Element ids the shortcuts focus. */
export const IDEA_INPUT_ID = "idea";
export const SIDEBAR_SEARCH_ID = "sidebar-search";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/** Focus an element once it exists (after a navigation or while a sheet opens). Gives up after ~2s. */
function focusWhenReady(id: string): () => void {
  let frame = 0;
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) {
      el.focus();
      return;
    }
    if (++tries < 120) frame = requestAnimationFrame(attempt);
  };
  frame = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(frame);
}

const subscribeNothing = () => () => {};

/** "⌘" on Apple platforms, "Ctrl" elsewhere (and during server rendering). */
export function useModKey(): string {
  return useSyncExternalStore(
    subscribeNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"),
    () => "Ctrl",
  );
}

/**
 * App-wide keyboard shortcuts, mounted once in the (app) layout.
 * - Ctrl/Cmd+K: start a new plan and focus the idea box (works even while typing).
 * - `/`: focus the sidebar's plan search (ignored while typing in a field).
 */
export function Shortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, state, setOpen, setOpenMobile } = useSidebar();

  useEffect(() => {
    let cancelFocus: (() => void) | undefined;

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isMobile) setOpenMobile(false);
        if (pathname !== "/chat") router.push("/chat");
        cancelFocus?.();
        cancelFocus = focusWhenReady(IDEA_INPUT_ID);
        return;
      }

      if (e.key === "/" && !mod && !e.altKey && !isTyping(e.target)) {
        // On desktop the sidebar is always mounted: no search box means no plans to search yet.
        // On mobile it lives in a closed sheet, so open it and focus the box if it appears.
        if (!isMobile && !document.getElementById(SIDEBAR_SEARCH_ID)) return;
        e.preventDefault();
        if (isMobile) setOpenMobile(true);
        else if (state === "collapsed") setOpen(true);
        cancelFocus?.();
        cancelFocus = focusWhenReady(SIDEBAR_SEARCH_ID);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelFocus?.();
    };
  }, [router, pathname, isMobile, state, setOpen, setOpenMobile]);

  return null;
}
