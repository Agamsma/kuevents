import type { Timestamp } from "firebase/firestore";

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

const IST = "Asia/Kolkata";

export function formatDate(ms: number | null): string {
  if (ms === null) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: IST,
  }).format(ms);
}

export function formatTime(ms: number | null): string {
  if (ms === null) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  }).format(ms);
}

export function formatDateTime(ms: number | null): string {
  if (ms === null) return "—";
  return `${formatDate(ms)}, ${formatTime(ms)}`;
}

/**
 * Day-of-month and month abbreviation, for the date block on an event card.
 *
 * Both go through the same IST formatter as everything else. Deriving the day
 * from `new Date(ms).getDate()` instead would read the viewer's local timezone,
 * so a student abroad — or anyone testing with their clock off IST — could see
 * a card dated one day away from the date printed on their own pass.
 */
export function formatDayNum(ms: number | null): string {
  if (ms === null) return "--";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    timeZone: IST,
  }).format(ms);
}

export function formatMonthAbbr(ms: number | null): string {
  if (ms === null) return "";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    timeZone: IST,
  })
    .format(ms)
    .toUpperCase();
}

/** Clock-style HH:MM:SS for the live badge on a pass. */
export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(ms);
}

export function formatInr(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise);
}

/** `TKT-8F2A` style short code for reading a ticket id aloud at the gate. */
export function shortCode(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}
