"use client";

// app/time/_lib/useNow.ts
// ─────────────────────────────────────────────────────────────────────────────
// One second-interval for the whole console. The header clock and every live
// elapsed time derive their display from this single `now`, per the handoff
// README: never increment a counter, always recompute from (now - startedAt),
// so a backgrounded tab or a dropped frame can't drift the numbers.
//
// `now` starts null and is only filled in after mount. Server-rendered HTML has
// no clock, so this avoids a hydration mismatch on every tick-driven string.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

export function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return now;
}

/** "HH:MM" wall clock, or a placeholder before the first client tick. */
export function wallClock(now: number | null): string {
  if (now === null) return "--:--";
  return new Date(now).toTimeString().slice(0, 5);
}

/**
 * Elapsed time since a "HH:MM" clock-in earlier today, rendered "H:MM".
 * Clamped at zero so a shift that starts later today reads 0:00 rather than
 * counting backwards.
 */
export function elapsedSince(clockIn: string, now: number | null): string {
  if (now === null) return "—";
  const [h, m] = clockIn.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";

  const start = new Date(now);
  start.setHours(h, m, 0, 0);

  const mins = Math.max(0, Math.floor((now - start.getTime()) / 60000));
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
}
