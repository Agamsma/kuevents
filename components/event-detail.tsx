"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { BookingFailure, bookPass } from "@/lib/booking";
import { fetchEvent, fetchMyTickets } from "@/lib/firestore-queries";
import {
  formatDate,
  formatDayNum,
  formatMonthAbbr,
  formatTime,
} from "@/lib/format";
import { seatState } from "@/lib/seats";
import type { EventDoc, TicketDoc } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

type LoadState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "ready"; event: EventDoc; ticket: TicketDoc | null };

export function EventDetail({ eventId }: { eventId: string }) {
  const { user, getIdToken } = useAuth();
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [event, myTickets] = await Promise.all([
        fetchEvent(eventId),
        fetchMyTickets(user.uid),
      ]);

      if (!event) {
        setState({ status: "missing" });
        return;
      }

      const ticket =
        myTickets.find((t) => t.event_id === eventId && t.status === "issued") ??
        null;

      setState({ status: "ready", event, ticket });
    } catch (error) {
      console.error("[event] load failed", error);
      toast.error("Could not load this event", {
        id: "event-detail",
        description: "Check your connection and retry.",
      });
      setState({ status: "missing" });
    }
  }, [eventId, user]);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See events-home.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const book = useCallback(async () => {
    if (state.status !== "ready") return;

    setBooking(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new BookingFailure("Your session expired. Sign in again.");
      }

      const ticketId = await bookPass({ event: state.event, token });
      router.push(`/tickets/${ticketId}`);
    } catch (error) {
      // Log the real error, show a written one. `bookPass` throws messages
      // meant for a student; anything else reaching here is an internal fault
      // whose text ("Failed to execute 'json' on 'Response'") explains nothing
      // to the person holding the phone and looks like the app blaming them.
      console.error("[event] booking failed", error);

      if (error instanceof Error && error.message === "cancelled") return;

      toast.error("Could not get you a pass", {
        id: "book",
        description:
          error instanceof BookingFailure
            ? error.message
            : "Something went wrong on our side. No pass was issued — please try again.",
      });
    } finally {
      setBooking(false);
    }
  }, [state, getIdToken, router]);

  if (state.status === "loading") {
    return (
      <AppShell theme="paper">
        <div className="stub h-72 animate-pulse" />
      </AppShell>
    );
  }

  if (state.status === "missing") {
    return (
      <AppShell theme="paper">
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-5 text-center">
          <AlertTriangle className="size-8 text-refuse" />
          <p className="max-w-[17rem] text-sm leading-relaxed text-ink-dim">
            This event does not exist, or it has been taken down.
          </p>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              All events
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { event, ticket } = state;

  const issued = event.tickets_issued ?? 0;
  const { seatsLeft, full: soldOut, low } = seatState(event);
  const bookingsClosed = event.status !== "published" && event.status !== "live";
  /*
   * Paused is not closed, and the button must not pretend otherwise.
   *
   * A paused event is still on the directory and still running; bookings are
   * held. "Bookings closed" would read as over, which sends someone away from
   * an event they could still get into in ten minutes.
   */
  const paused = event.bookings_paused === true;
  const pct = event.capacity > 0 ? Math.min((issued / event.capacity) * 100, 100) : 0;

  return (
    <AppShell theme="paper">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3" />
        All events
      </Link>

      <Stub notched notchAt="calc(100% - 5.5rem)" className="animate-stub-in overflow-hidden">
        <div className="px-6 pb-7 pt-6">
          {/* Date block and title, the two things worth knowing first. */}
          <div className="flex items-start gap-5">
            <div className="shrink-0 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-ku-red">
                {formatMonthAbbr(event.starts_at)}
              </div>
              <div className="display text-[2.75rem] leading-none text-ink tabular">
                {formatDayNum(event.starts_at)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="display text-[1.9rem] leading-[1.05] text-ink">
                {event.title}
              </h1>
              {event.status === "live" ? (
                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-ku-red/30 bg-ku-red/[0.07] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ku-red">
                  <span className="animate-live-pulse size-1.5 rounded-full bg-current" />
                  Happening now
                </span>
              ) : null}
            </div>
          </div>

          {event.description ? (
            <p className="mt-6 text-[15px] leading-relaxed text-ink-dim">
              {event.description}
            </p>
          ) : null}

          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6">
            <Field label="Date" value={formatDate(event.starts_at)} icon={CalendarDays} />
            <Field
              label="Doors"
              value={`${formatTime(event.starts_at)} – ${formatTime(event.ends_at)}`}
              icon={Clock}
            />
            <Field label="Venue" value={event.venue} icon={MapPin} className="col-span-2" />
          </div>

          {event.capacity > 0 ? (
            <div className="mt-7">
              <div className="flex items-baseline justify-between">
                <FieldLabel>Seats taken</FieldLabel>
                <span className="font-mono text-[11px] text-ink-dim tabular">
                  {issued} / {event.capacity}
                </span>
              </div>
              <div
                className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Share of seats taken"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    soldOut ? "bg-refuse" : "bg-crimson"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {low ? (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-urgent">
                  <Users className="size-3" />
                  Only {seatsLeft} left
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <Perforation className="mx-6" />

        {/* The action bar: what it costs on the left, the one thing to do on
            the right. Entry is free at this stage, but the field stays — it is
            the question every attendee asks first. */}
        <div className="flex h-[5.5rem] items-center justify-between gap-4 px-6">
          <div>
            <FieldLabel>Entry</FieldLabel>
            <div className="mt-1 font-mono text-lg font-medium text-admit">FREE</div>
          </div>

          {ticket ? (
            <Button size="lg" variant="outline" asChild>
              <Link href={`/tickets/${ticket.id}`}>
                View your pass
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              disabled={soldOut || bookingsClosed || paused || booking}
              onClick={book}
            >
              {booking ? <Loader2 className="size-4 animate-spin" /> : null}
              {bookingsClosed
                ? "Bookings closed"
                : paused
                  ? "Bookings paused"
                  : soldOut
                    ? "Full"
                    : "Get pass"}
            </Button>
          )}
        </div>
      </Stub>

      {ticket ? null : (
        <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-soft">
          One pass per student. It admits you once, and works at the gate even
          with no signal.
        </p>
      )}
    </AppShell>
  );
}
