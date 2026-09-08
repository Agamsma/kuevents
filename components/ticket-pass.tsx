"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  buildQrPayload,
  buildRotatingPayload,
  liveWindowCode,
  msUntilNextWindow,
} from "@/lib/qr";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatTime,
  shortCode,
  toMillis,
} from "@/lib/format";
import type { EventDoc, TicketDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { PassLayer, Tilt } from "@/components/pass/tilt";

interface PassData {
  ticket: TicketDoc;
  event: EventDoc | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PassData };

/**
 * Ticks once a second so the pass shows a moving clock.
 *
 * A screenshot freezes this clock and the rolling code beside it, which is the
 * cheap tell a marshal can spot without touching anything. It does not make the
 * pass unshareable — the one-scan rule at the gate does that.
 */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return now;
}

/**
 * The liveness strip.
 *
 * Three things move: a pulsing dot, a rolling six-character code, and a running
 * clock. All three stop dead in a screenshot.
 */
function LiveStrip({ qrHash, now }: { qrHash: string; now: number }) {
  const code = liveWindowCode(qrHash, now);
  const remaining = Math.ceil(msUntilNextWindow(now) / 1000);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-admit/25 bg-admit/[0.07] px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex size-2">
          <span className="animate-live-pulse absolute inline-flex size-full rounded-full bg-admit" />
          <span className="relative inline-flex size-2 rounded-full bg-admit" />
        </span>
        <span className="font-mono text-[13px] font-medium tracking-[0.22em] text-admit tabular">
          {code}
        </span>
      </div>

      <span className="font-mono text-[10px] tracking-wider text-admit/60 tabular">
        {formatClock(now)} · {remaining.toString().padStart(2, "0")}s
      </span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-theme="paper"
      className="relative flex min-h-dvh flex-col items-center bg-paper px-4 py-8 text-ink sm:py-12"
    >
      {/*
       * A pass held up to the light. The crimson bloom behind it was a glow —
       * light emitted from the ground — which paper cannot do. This is the
       * warmth a sheet picks up from the room instead.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 50% at 50% -5%, #ffffff 0%, transparent 60%), radial-gradient(60% 40% at 50% 105%, #f6ece1 0%, transparent 65%)",
        }}
      />
      <div className="relative w-full max-w-[24rem]">{children}</div>
    </main>
  );
}

export function TicketPass({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const now = useNow();

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      try {
        const ticketSnap = await getDoc(doc(db, "tickets", ticketId));

        if (!ticketSnap.exists()) {
          if (!cancelled) {
            setState({ status: "error", message: "This pass does not exist." });
          }
          return;
        }

        const raw = ticketSnap.data();
        const ticket: TicketDoc = {
          ...(raw as TicketDoc),
          id: ticketSnap.id,
          check_in_time: toMillis(raw.check_in_time),
          created_at: toMillis(raw.created_at) ?? Date.now(),
        };

        // Firestore rules already refuse this read; a clear message beats a raw
        // permission error if the rules are ever loosened by accident.
        if (ticket.user_id !== user!.uid) {
          if (!cancelled) {
            setState({ status: "error", message: "This pass belongs to someone else." });
          }
          return;
        }

        const eventSnap = await getDoc(doc(db, "events", ticket.event_id));
        const event: EventDoc | null = eventSnap.exists()
          ? {
              ...(eventSnap.data() as EventDoc),
              id: eventSnap.id,
              starts_at: toMillis(eventSnap.data().starts_at) ?? 0,
              ends_at: toMillis(eventSnap.data().ends_at) ?? 0,
              created_at: toMillis(eventSnap.data().created_at) ?? 0,
            }
          : null;

        if (!cancelled) setState({ status: "ready", data: { ticket, event } });
      } catch (error) {
        console.error("[ticket] load failed", error);
        if (!cancelled) {
          setState({
            status: "error",
            message: "Could not load this pass. Check your connection and retry.",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [ticketId, user]);

  if (state.status === "loading") {
    return (
      <Shell>
        <div className="flex min-h-[60dvh] items-center justify-center">
          <Loader2 className="size-5 animate-spin text-ink-soft" />
        </div>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-5 text-center">
          <AlertTriangle className="size-8 text-refuse" />
          <p className="max-w-[16rem] text-sm leading-relaxed text-ink-dim">
            {state.message}
          </p>
          <Button variant="outline" asChild>
            <Link href="/tickets">
              <ArrowLeft className="size-4" />
              Your passes
            </Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const { ticket, event } = state.data;
  const isVoid = ticket.status !== "issued";
  /*
   * A rotating pass re-encodes every window; a static one never changes.
   *
   * `now` already ticks once a second for the live strip, so this recomputes
   * with it and the QR rolls over on its own. The secret is read from the
   * ticket document, which Firestore rules let only this holder read - it is
   * never in the QR, which is the whole point.
   */
  const rotates = Boolean(ticket.rotation_secret);
  const qrPayload = rotates
    ? buildRotatingPayload(ticket.qr_hash, ticket.rotation_secret!, now)
    : buildQrPayload(ticket.qr_hash);

  return (
    <Shell>
      <Link
        href="/tickets"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3" />
        All passes
      </Link>

      <article className="animate-stub-in">
        <Tilt>
        <Stub
          notched
          notchAt="calc(100% - 15.5rem)"
          className="overflow-hidden shadow-[0_24px_60px_-20px_#1a141640] [transform-style:preserve-3d]"
        >
          {/* ── The half you keep ────────────────────────────────────────── */}
          <div className="relative px-6 pb-7 pt-7 [transform-style:preserve-3d]">
            {/*
              The flame rule. Gold left the palette with the move to paper, so
              the one warm mark across the top of the pass is the emblem’s own
              gradient instead — the same red-into-orange the foil sweeps.
            */}
            <div
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, var(--ku-red) 0%, var(--ku-orange) 55%, var(--ku-red) 100%)",
              }}
            />

            <FieldLabel>Admit one · Karnavati University</FieldLabel>

            {/*
              The title rides highest of the printed matter. Depths climb with
              importance — label on the surface, title above it, QR proudest of
              all — so tilting the pass sorts it by what matters rather than
              just rotating a picture.
            */}
            <PassLayer z={26}>
              <h1 className="display mt-3 text-[1.9rem] leading-[1.05] text-ink">
                {event?.title ?? "Event"}
              </h1>
            </PassLayer>

            <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6">
              <Field label="Attendee" value={ticket.user_name} className="col-span-2" />
              <Field label="Date" value={formatDate(event?.starts_at ?? null)} />
              <Field label="Doors" value={formatTime(event?.starts_at ?? null)} />
              <Field
                label="Venue"
                value={event?.venue ?? "—"}
                icon={MapPin}
                className="col-span-2"
              />
              <Field label="Seat" value={ticket.seat_label ?? "General"} />
              <Field
                label="Pass no."
                value={shortCode(ticket.id)}
                valueClassName="font-mono tracking-widest"
              />
            </div>
          </div>

          <Perforation className="mx-6" />

          {/* ── The half the gate takes ──────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 px-6 pb-7 pt-7 [transform-style:preserve-3d]">
            {isVoid ? (
              <div className="flex w-full items-center gap-2.5 rounded-md border border-refuse/30 bg-refuse/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-refuse">
                <AlertTriangle className="size-4 shrink-0" />
                {ticket.status === "refunded" ? "Refunded" : "Cancelled"} — will
                not scan
              </div>
            ) : ticket.checked_in ? (
              <div className="flex w-full items-center gap-2.5 rounded-md border border-admit/30 bg-admit/[0.08] px-3.5 py-2.5 text-[13px] font-medium text-admit">
                <CheckCircle2 className="size-4 shrink-0" />
                Checked in {formatDateTime(ticket.check_in_time)}
              </div>
            ) : (
              <div className="w-full">
                <LiveStrip qrHash={ticket.qr_hash} now={now} />
              </div>
            )}

            {/*
             * `relative z-10` lifts the QR above the foil.
             *
             * The foil is painted last inside <Tilt>, so without this it sweeps
             * a warm gradient straight across the code. Caught on a phone
             * viewport, where it was plainly tinting the modules. A decorative
             * overlay that lowers contrast on the one element the entire
             * product depends on scanning — offline, at a gate, on a marshal's
             * cheap camera — is not a trade worth making for a highlight.
             *
             * `bg-[#ffffff]` rather than `bg-bone`: the quiet zone around a QR
             * must be the brightest thing available, and --bone is a warm
             * off-white tuned for the dark ground.
             */
            }
            <PassLayer z={42} className="relative z-10">
            <div
              className={
                isVoid
                  ? "rounded-lg bg-[#ffffff] p-3.5 opacity-20 grayscale"
                  : "rounded-lg bg-[#ffffff] p-3.5"
              }
            >
              <QRCode
                value={qrPayload}
                size={176}
                level="M"
                // Pure white and near-black, not the warm off-whites used
                // elsewhere. Every decoder thresholds light against dark, and
                // this code has to survive a cracked screen at low brightness
                // in front of a marshal's cheap camera. Contrast here is a
                // functional requirement, not a style choice.
                bgColor="#ffffff"
                fgColor="#0b0a14"
                // Re-rendered as SVG, so it stays crisp at any pixel density.
                style={{ height: "auto", maxWidth: "100%", width: "176px" }}
              />
            </div>
            </PassLayer>

            <div className="w-full text-center font-mono text-[9px] tracking-[0.14em] text-ink-soft">
              {ticket.id}
            </div>
          </div>
        </Stub>
        </Tilt>
      </article>

      <p className="mx-auto mt-6 max-w-[19rem] text-center text-[11px] leading-relaxed text-ink-soft">
        A screenshot will not get anyone in. This code admits one person once,
        and the strip above stops ticking the moment the screen is captured.
      </p>
    </Shell>
  );
}
