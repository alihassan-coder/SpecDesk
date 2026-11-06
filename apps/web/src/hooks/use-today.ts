import { useSyncExternalStore } from "react";

let cachedKey = "";
let cachedToday: Date | null = null;

function getToday() {
  const now = new Date();
  const key = now.toDateString();
  if (key !== cachedKey) {
    cachedKey = key;
    cachedToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return cachedToday;
}

const noopSubscribe = () => () => {};

/**
 * Today's date (midnight, local) on the client; `null` during server prerender.
 * Keeps "current time" out of the prerendered static shell (Cache Components).
 */
export function useToday() {
  return useSyncExternalStore(noopSubscribe, getToday, () => null);
}
