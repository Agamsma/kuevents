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
import { bookPass } from "@/lib/booking";
import { fetchEvent, fetchMyTickets } from "@/lib/firestore-queries";
import {
  formatDate,
  formatDayNum,
  formatMonthAbbr,
  formatTime,
} from "@/lib/format";
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
      if (!token) throw new Error("Your session expired. Sign in again.");

      const ticketId = await bookPass({ event: state.event, token });
      router.push(`/tickets/${ticketId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Booking failed.";
      if (message !== "cancelled") {
        toast.error("Could not get you a pass", {
          id: "book",
          description: message,
        });
      }
    } finally {
      setBooking(false);
    }
  }, [state, getIdToken, router]);

  if (state.status === "loading") {
    return (
      <AppShell>
        <div className="stub h-72 animate-pulse" />
      </AppShell>
    );
  }

  if (state.status === "missing") {
    return (
      <AppShell>
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-5 text-center">
          <AlertTriangle className="size-8 text-refuse" />
          <p className="max-w-[17rem] text-sm leading-relaxed text-bone-dim">
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
  const seatsLeft = event.capacity > 0 ? Math.max(event.capacity - issued, 0) : null;
  const soldOut = seatsLeft !== null && seatsLeft === 0;
  const bookingsClosed = event.status !== "published" && event.status !== "live";
  const pct = event.capacity > 0 ? Math.min((issued / event.capacity) * 100, 100) : 0;

  return (
    <AppShell>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-faint transition-colors hover:text-bone"
      >
        <ArrowLeft className="size-3" />
        All events
      </Link>

      <Stub notched notchAt="calc(100% - 5.5rem)" className="animate-stub-in overflow-hidden">
        <div className="px-6 pb-7 pt-6">
          {/* Date block and title, the two things worth knowing first. */}
          <div className="flex items-start gap-5">
            <div className="shrink-0 text-center">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
                {formatMonthAbbr(event.starts_at)}
              </div>
              <div className="display text-[2.75rem] leading-none text-bone tabular">
                {formatDayNum(event.starts_at)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="display text-[1.9rem] leading-[1.05] text-bone">
                {event.title}
              </h1>
              {event.status === "live" ? (
                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                  <span className="animate-live-pulse size-1.5 rounded-full bg-gold" />
                  Happening now
                </span>
              ) : null}
            </div>
          </div>

          {event.description ? (
            <p className="mt-6 text-[15px] leading-relaxed text-bone-dim">
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
                <span className="font-mono text-[11px] text-bone-dim tabular">
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
              {seatsLeft !== null && seatsLeft > 0 && seatsLeft <= 20 ? (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
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
              disabled={soldOut || bookingsClosed || booking}
              onClick={book}
            >
              {booking ? <Loader2 className="size-4 animate-spin" /> : null}
              {bookingsClosed ? "Bookings closed" : soldOut ? "Full" : "Get pass"}
            </Button>
          )}
        </div>
      </Stub>

      {ticket ? null : (
        <p className="mt-5 text-center text-[11px] leading-relaxed text-bone-faint">
          One pass per student. It admits you once, and works at the gate even
          with no signal.
        </p>
      )}
    </AppShell>
  );
}
