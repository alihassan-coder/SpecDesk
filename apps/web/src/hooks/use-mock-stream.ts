"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StreamEvent } from "@/mocks/types";

/**
 * Plays a scripted list of events on timers, like the real SSE stream will.
 * M4 swaps this for an EventSource on `/api/v1/chats/{id}/stream` with the same event shapes.
 */
export function useMockStream(script: { delay: number; event: StreamEvent }[], speed = 1) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunning(false);
  }, []);

  const start = useCallback(() => {
    stop();
    setEvents([]);
    setRunning(true);
    let at = 0;
    script.forEach(({ delay, event }, i) => {
      at += delay / speed;
      timers.current.push(
        setTimeout(() => {
          setEvents((prev) => [...prev, event]);
          if (i === script.length - 1) setRunning(false);
        }, at),
      );
    });
  }, [script, speed, stop]);

  useEffect(() => stop, [stop]);

  return { events, running, start, stop };
}
