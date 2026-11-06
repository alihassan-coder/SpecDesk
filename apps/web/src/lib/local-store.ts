import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store for per-browser preferences, read with useSyncExternalStore
 * (no setState-in-effect, no hydration mismatch: the server snapshot is always the fallback).
 */
export function createLocalStore<T>(key: string, fallback: T, parse: (raw: string) => T = (r) => JSON.parse(r) as T) {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null | undefined;
  let cachedValue: T = fallback;

  const read = (): T => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return fallback;
    }
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      try {
        cachedValue = raw == null ? fallback : parse(raw);
      } catch {
        cachedValue = fallback;
      }
    }
    return cachedValue;
  };

  const write = (value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked — value still applies for this render via cache */
      cachedRaw = JSON.stringify(value);
      cachedValue = value;
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => e.key === key && listener();
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  const useValue = () => useSyncExternalStore(subscribe, read, () => fallback);

  return { useValue, write, read };
}
