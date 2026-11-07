"use client";

import { useCallback, useEffect, useState } from "react";
import { toHumanError } from "@/lib/admin-api";
import type { HumanError } from "@/lib/errors";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: HumanError }
  | { status: "ready"; data: T };

/**
 * Load one admin endpoint on mount. `load` must be a stable reference (e.g. `adminApi.leads`).
 * Returns the state, a `retry`, and `setData` to apply a server response locally after a mutation.
 */
export function useAdminResource<T>(load: () => Promise<T>) {
  const [state, setState] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      (e: unknown) => {
        if (!cancelled) setState({ status: "error", error: toHumanError(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  const setData = useCallback((update: (data: T) => T) => {
    setState((s) => (s.status === "ready" ? { status: "ready", data: update(s.data) } : s));
  }, []);

  return { state, retry, setData };
}
