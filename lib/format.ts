import type { Timestamp } from "firebase/firestore";

import { CAMPUS_LOCALE, CAMPUS_TIMEZONE } from "@/lib/constants";

/**
 * Firestore hands back `Timestamp` on the client, a plain `{seconds}` object
 * once serialised, epoch millis from our own caches, and ISO strings from the
 * API. Everything funnels through here so the rest of the app sees `number`.
 */
export function toMillis(
  value: Timestamp | Date | number | string | { seconds: number } | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "object" && "toMillis" in value) {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === "object" && "seconds" in value) {
    return value.seconds * 1000;
  }
  return null;
}

/**
 * Cached `Intl.DateTimeFormat` instances.
 *
 * Constructing one is expensive — it resolves locale data every time — and
 * these are called once per row per render. A directory of 50 events was
 * building 150 formatters on every keystroke in a filter box. They are
 * immutable and safe to share.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);

  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(CAMPUS_LOCALE, {
      timeZone: CAMPUS_TIMEZONE,
      ...options,
    });
    formatterCache.set(key, cached);
  }

  return cached;
}

export function formatDate(ms: number | null): string {
  if (ms === null) return "—";
  return formatter({ weekday: "short", day: "2-digit", month: "short" }).format(ms);
}

export function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  return formatter({ hour: "2-digit", minute: "2-digit", hour12: true }).format(ms);
}

export function formatDateTime(ms: number | null): string {
  if (ms === null) return "—";
  return `${formatDate(ms)}, ${formatTime(ms)}`;
}

/**
 * Day-of-month and month abbreviation, for the date block on an event card.
 *
 * Both go through the same campus-time formatter as everything else. Deriving
 * the day from `new Date(ms).getDate()` would read the viewer's local timezone,
 * so a student abroad could see a card dated a day away from their own pass.
 */
export function formatDayNum(ms: number | null): string {
  if (ms === null) return "--";
  return formatter({ day: "2-digit" }).format(ms);
}

export function formatMonthAbbr(ms: number | null): string {
  if (ms === null) return "";
  return formatter({ month: "short" }).format(ms).toUpperCase();
}

/** Clock-style HH:MM:SS for the live badge on a pass. */
export function formatClock(ms: number): string {
  return formatter({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(ms);
}

/**
 * "in 3 days", "tomorrow", "2 hours ago".
 *
 * Used where the exact timestamp matters less than the distance from now — a
 * student scanning the directory wants to know how soon, not the date.
 */
export function formatRelative(ms: number | null, now = Date.now()): string {
  if (ms === null) return "—";

  const diff = ms - now;
  const abs = Math.abs(diff);

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const rtf = new Intl.RelativeTimeFormat(CAMPUS_LOCALE, { numeric: "auto" });

  if (abs < HOUR) return rtf.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), "day");

  return formatDate(ms);
}

export function formatInr(rupees: number): string {
  return new Intl.NumberFormat(CAMPUS_LOCALE, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** `8F2A19` style short code, for reading a pass number aloud at the gate. */
export function shortCode(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}

/** Sorts names the way a person scanning a list expects. */
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, CAMPUS_LOCALE);
}
