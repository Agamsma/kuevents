"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/lib/auth-context";
import { fetchMyTickets, fetchPublishedEvents } from "@/lib/firestore-queries";
import { TRACK_LABELS, type EventDoc, type EventTrack, type TicketDoc } from "@/lib/types";
import { EventCard } from "@/components/events/event-card";
import { Reveal } from "@/components/motion/reveal";
import { NextPass } from "@/components/landing/next-pass";
import { Button } from "@/components/ui/button";
import { FieldLabel, Stub } from "@/components/ui/stub";
import { Tabs, TabsContent, TabsList, TabsPill, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

type TabValue = "ALL" | EventTrack;

/** JSON.parse that returns null instead of throwing on a non-JSON body. */
function safeParse(text: string): { events?: unknown; error?: string } | null {
  try {
    return JSON.parse(text);
  } catch {
    console.error("[directory] non-JSON response:", text.slice(0, 500));
    return null;
  }
}

/**
 * Four columns at `lg`, and that number is not arbitrary.
 *
 * The card's type is drawn at `CARD_WIDTH_CLASS` (15rem) — 9px mono captions,
 * a 1.05rem title. Inside this section's `max-w-5xl` (64rem) with `gap-5`,
 * four columns measure (64 - 3 × 1.25) / 4 = 15.06rem, so the poster renders
 * at almost exactly the width its type was tuned for. Three columns would
 * stretch each card to 20rem and leave the captions looking undersized.
 *
 * Below `lg` the cards are narrower than that, which portrait posters tolerate
 * far better than landscape ones did — the crop stays legible when the type
 * shrinks with it.
 */
const GRID_CLASS = "grid gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

/** Mirrors GRID_CLASS: 15rem once four columns lock in, viewport-relative below. */
const CARD_SIZES = "(min-width: 1024px) 15rem, (min-width: 640px) 30vw, 45vw";

const TABS: { value: TabValue; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UIT", label: TRACK_LABELS.UIT },
  { value: "UWSL", label: TRACK_LABELS.UWSL },
  { value: "UID", label: TRACK_LABELS.UID },
  { value: "CLUB", label: TRACK_LABELS.CLUB },
];

export function EventDirectory() {
  const { user } = useAuth();

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [myTickets, setMyTickets] = useState<Record<string, TicketDoc>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabValue>("ALL");

  /**
   * The calendar loads for everyone, signed in or not.
   *
   * Signed-out visitors get it from `/api/events/public`, which projects each
   * event down to display fields only — so the front page works as a shareable
   * campus calendar without a login wall, and without exposing organizer UIDs
   * or review notes to the internet.
   *
   * Signed-in users read Firestore directly instead, because they also need
   * their own tickets, and a booking they just made must appear immediately
   * rather than waiting out the public route's cache.
   */
  const load = useCallback(async () => {
    try {
      if (!user) {
        const response = await fetch("/api/events/public");

        // `response.ok` is checked rather than assumed. The route answers a
        // failure with `{ ok: false, events: [] }` and a 503, and reading only
        // `body.events` turned that into a confident "Nothing published yet" —
        // a backend outage rendered as an editorial statement. It also parsed
        // unconditionally, so a crashed function with an empty body surfaced as
        // `Unexpected end of JSON input` instead of the actual status.
        const text = await response.text();
        const body = text ? safeParse(text) : null;

        if (!response.ok || !body) {
          throw new Error(
            body?.error ?? `The calendar service returned ${response.status}.`,
          );
        }

        setEvents((body.events ?? []) as EventDoc[]);
        return;
      }

      const [published, tickets] = await Promise.all([
        fetchPublishedEvents(),
        fetchMyTickets(user.uid),
      ]);

      setEvents(published);

      const owned: Record<string, TicketDoc> = {};
      for (const ticket of tickets) {
        if (ticket.status === "issued") owned[ticket.event_id] = ticket;
      }
      setMyTickets(owned);
    } catch (error) {
      console.error("[directory] load failed", error);
      toast.error("Could not load events", {
        id: "directory",
        // "Check your connection" was the description for every failure,
        // including ones where the connection was demonstrably fine and the
        // server was down. Blaming the visitor's wifi for our outage sends
        // them to reset a router instead of telling us something is broken.
        description: navigator.onLine
          ? "The service is having trouble. Please try again shortly."
          : "You appear to be offline. Reconnect and retry.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Async loader: every setState sits behind an await, so nothing is set
    // synchronously during the effect. The rule cannot trace async callees.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: events.length };
    for (const event of events) {
      map[event.track] = (map[event.track] ?? 0) + 1;
    }
    return map;
  }, [events]);

  const visible = useMemo(
    () => (tab === "ALL" ? events : events.filter((e) => e.track === tab)),
    [events, tab],
  );

  return (
    <section id="directory" className="relative scroll-mt-20 px-5 pb-28 pt-6 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <Reveal>
          <div className="flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <FieldLabel>The directory</FieldLabel>
              <h2 className="display mt-3 text-[clamp(2rem,5vw,3rem)] text-ink">
                What&rsquo;s coming up
              </h2>
            </div>

            {user ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-soft tabular">
                {events.length} open {events.length === 1 ? "event" : "events"}
              </span>
            ) : null}
          </div>
        </Reveal>

        {/* Pinned above the calendar for anyone holding a pass for something
            imminent. Renders nothing otherwise. */}
        <NextPass />

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as TabValue)}
          className="mt-8"
        >
            <Reveal>
              <TabsList className="mb-9 flex-wrap">
                {TABS.map((entry) => (
                  <TabsTrigger key={entry.value} value={entry.value}>
                    {tab === entry.value ? <TabsPill /> : null}
                    {entry.label}
                    {counts[entry.value] ? (
                      <span className="ml-1.5 opacity-50 tabular">
                        {counts[entry.value]}
                      </span>
                    ) : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Reveal>

            {TABS.map((entry) => (
              <TabsContent key={entry.value} value={entry.value}>
                {loading ? (
                  <DirectorySkeleton />
                ) : visible.length === 0 ? (
                  <EmptyTrack track={entry.value} />
                ) : (
                  <motion.div layout className={GRID_CLASS}>
                    <AnimatePresence mode="popLayout">
                      {visible.map((event, index) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          ticket={myTickets[event.id]}
                          index={index}
                          className="w-full"
                          sizes={CARD_SIZES}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </TabsContent>
            ))}
        </Tabs>

        {/* Signed-out visitors can browse everything; the ask comes only when
            they want a seat, which is the point at which an account is
            actually needed. */}
        {!user && !loading && events.length > 0 ? (
          <Reveal>
            <div className="glass mt-10 flex flex-col items-center gap-4 rounded-2xl px-6 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
              <div>
                <div className="display text-[1.25rem] text-ink">
                  Want a seat at one of these?
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">
                  Sign in with your KU account to reserve a pass.
                </p>
              </div>
              <Button size="lg" className="shrink-0" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Placeholders shaped like the card that replaces them.
 *
 * The height is derived rather than fixed: a 2:3 poster plus the torn foot,
 * so a column of any width produces a box the real card will fill exactly.
 * The previous `h-[19rem]` was measured off the landscape card and would now
 * collapse the grid a step the moment the events arrived.
 */
function DirectorySkeleton() {
  return (
    <div className={GRID_CLASS}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="stub animate-pulse"
          style={{ animationDelay: `${i * 140}ms` }}
        >
          <div className="aspect-[2/3]" />
          {/* The foot: 1px tear + `py-3` around a 1rem row. */}
          <div className="h-[2.6rem]" />
        </div>
      ))}
    </div>
  );
}

function EmptyTrack({ track }: { track: TabValue }) {
  return (
    <Stub notched className="px-6 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="display text-[1.5rem] text-ink">
          {track === "ALL" ? "Nothing published yet" : `Nothing from ${TRACK_LABELS[track as EventTrack]} yet`}
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-dim">
          Got something in mind? Anyone on campus can propose an event — an
          organizer reviews it and it appears here.
        </p>
        <Button className="mt-7" asChild>
          <Link href="/events/request">Propose an event</Link>
        </Button>
      </div>
    </Stub>
  );
}

