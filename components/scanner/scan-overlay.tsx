"use client";

import { useEffect } from "react";
import {
  BadgeX,
  CalendarX2,
  CheckCircle2,
  QrCode,
  UserX,
  XCircle,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import type { ScanOutcome } from "@/lib/db/indexeddb";

/**
 * The verdict, full-bleed.
 *
 * Read at arm's length, in a moving queue, often at night. So: the whole
 * viewport floods with one colour, the word is enormous, and the name is the
 * only supporting detail at a glance. Everything else is secondary.
 *
 * These are the only two places in the product where saturated green and red
 * appear — the palette holds them back everywhere else precisely so that this
 * moment is unambiguous.
 */
export function ScanOverlay({
  outcome,
  onDismiss,
  autoDismissMs = 2200,
}: {
  outcome: ScanOutcome | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}) {
  useEffect(() => {
    if (!outcome) return;

    // A refusal holds longer — the marshal has to read the original check-in
    // time off the screen and have a conversation about it.
    const hold = outcome.kind === "admitted" ? autoDismissMs : autoDismissMs + 1800;
    const timer = window.setTimeout(onDismiss, hold);

    return () => window.clearTimeout(timer);
  }, [outcome, onDismiss, autoDismissMs]);

  if (!outcome) return null;

  const view = describe(outcome);

  return (
    <div
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
      className={`no-select animate-in fade-in zoom-in-[0.98] fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 text-center duration-150 ${view.surface}`}
    >
      <view.Icon className="size-20" strokeWidth={1.75} />

      <div>
        <div className="display text-[3.5rem] uppercase leading-[0.9]">
          {view.headline}
        </div>
        <div className="mt-4 text-xl font-medium opacity-85">{view.name}</div>
      </div>

      {view.detail ? (
        <div className="max-w-xs rounded-md bg-black/15 px-4 py-3 font-mono text-[13px] leading-relaxed">
          {view.detail}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-10 font-mono text-[10px] uppercase tracking-[0.24em] opacity-50">
        Tap to continue
      </div>
    </div>
  );
}

function describe(outcome: ScanOutcome) {
  switch (outcome.kind) {
    case "admitted":
      return {
        surface: "bg-[#3FD68A] text-[#04140c]",
        Icon: CheckCircle2,
        headline: "Admitted",
        name: outcome.ticket.user_name,
        detail: outcome.ticket.seat_label ? `Seat ${outcome.ticket.seat_label}` : null,
      };

    case "duplicate":
      return {
        surface: "bg-[#FF4D5E] text-[#2a0508]",
        Icon: XCircle,
        headline: "Already in",
        name: outcome.ticket.user_name,
        detail: `Scanned at ${formatDateTime(outcome.originalCheckIn)}`,
      };

    case "cancelled":
      return {
        surface: "bg-[#FF4D5E] text-[#2a0508]",
        Icon: BadgeX,
        headline: outcome.ticket.status === "refunded" ? "Refunded" : "Cancelled",
        name: outcome.ticket.user_name,
        detail: "Voided before the event. Do not admit.",
      };

    case "wrong_event":
      return {
        surface: "bg-[#FF4D5E] text-[#2a0508]",
        Icon: CalendarX2,
        headline: "Wrong event",
        name: outcome.ticket.user_name,
        detail: "Valid pass — for a different event.",
      };

    case "not_found":
      return {
        surface: "bg-[#FF4D5E] text-[#2a0508]",
        Icon: UserX,
        headline: "Not on list",
        name: "Unknown pass",
        detail: "Not in the downloaded roster. Re-download if it is stale.",
      };

    case "unreadable":
      return {
        surface: "bg-[#FFB34D] text-[#211502]",
        Icon: QrCode,
        headline: "Not a pass",
        name: "Unrecognised code",
        detail: "That QR was not issued by KU Events.",
      };
  }
}
