"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, MapPin, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchMyTickets, fetchPublishedEvents } from "@/lib/firestore-queries";
import { formatDayNum, formatMonthAbbr, formatTime } from "@/lib/format";
import { TRACK_LABELS, type EventDoc, type EventTrack, type TicketDoc } from "@/lib/types";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { Tabs, TabsContent, TabsList, TabsPill, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";

type TabValue = "ALL" | EventTrack;

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

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
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
        description: "Check your connection and retry.",
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
              <h2 className="display mt-3 text-[clamp(2rem,5vw,3rem)] text-bone">
                What&rsquo;s coming up
              </h2>
            </div>

            {user ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-faint tabular">
                {events.length} open {events.length === 1 ? "event" : "events"}
              </span>
            ) : null}
          </div>
        </Reveal>

        {!user ? (
          <SignedOutPrompt />
        ) : (
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
                  <motion.div
                    layout
                    className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    <AnimatePresence mode="popLayout">
                      {visible.map((event, index) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          ticket={myTickets[event.id]}
                          index={index}
                        />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </section>
  );
}

/**
 * One event card.
 *
 * Cover image on top, ticket stub below — with the perforation running exactly
 * where the image ends, so the card reads as a photo stapled to a pass.
 */
function EventCard({
  event,
  ticket,
  index,
}: {
  event: EventDoc;
  ticket?: TicketDoc;
  index: number;
}) {
  const seatsLeft = event.capacity > 0 ? event.capacity - (event.tickets_issued ?? 0) : null;
  const full = seatsLeft !== null && seatsLeft <= 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index, 8) * 0.05,
      }}
    >
      <Link href={`/events/${event.id}`} className="group block h-full">
        <Stub
          notched
          notchAt="10.5rem"
          className="flex h-full flex-col overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[color:var(--line-strong)] group-hover:shadow-[0_24px_50px_-24px_#000000e6]"
        >
          {/* Cover */}
          <div className="relative h-[10.5rem] shrink-0 overflow-hidden bg-ash">
            {event.cover_image_url ? (
              <Image
                src={event.cover_image_url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(140deg, var(--maroon) 0%, var(--ash) 60%, var(--ember) 100%)",
                }}
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--ember)] via-transparent to-transparent" />

            <div className="absolute left-4 top-4 flex gap-2">
              <span className="glass-strong rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone">
                {TRACK_LABELS[event.track] ?? event.track}
              </span>
              <span className="glass-strong rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                {event.category}
              </span>
            </div>

            {/* Date, as a departure-board block. */}
            <div className="absolute bottom-3 right-4 text-right">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                {formatMonthAbbr(event.starts_at)}
              </div>
              <div className="display text-[1.75rem] leading-none text-bone tabular">
                {formatDayNum(event.starts_at)}
              </div>
            </div>
          </div>

          <Perforation className="mx-4" />

          <div className="flex flex-1 flex-col px-4 pb-4 pt-4">
            <h3 className="display text-[1.2rem] leading-tight text-bone">
              {event.title}
            </h3>

            <div className="mt-2.5 flex flex-col gap-1 font-mono text-[10px] text-bone-dim">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3 shrink-0 text-bone-faint" />
                {formatTime(event.starts_at)}
              </span>
              <span className="flex items-center gap-1.5 truncate">
                <MapPin className="size-3 shrink-0 text-bone-faint" />
                {event.venue}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 pt-1">
              {ticket ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admit">
                  Pass reserved
                </span>
              ) : full ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-refuse">
                  Full
                </span>
              ) : seatsLeft !== null && seatsLeft <= 20 ? (
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                  <Users className="size-3" />
                  {seatsLeft} left
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admit">
                  Free entry
                </span>
              )}

              <ArrowUpRight className="size-4 text-bone-faint transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-crimson" />
            </div>
          </div>
        </Stub>
      </Link>
    </motion.article>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="stub h-[19rem] animate-pulse"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function EmptyTrack({ track }: { track: TabValue }) {
  return (
    <Stub notched className="px-6 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="display text-[1.5rem] text-bone">
          {track === "ALL" ? "Nothing published yet" : `Nothing from ${TRACK_LABELS[track as EventTrack]} yet`}
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-bone-dim">
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

/** Signed-out visitors get the hero, but the directory needs an account. */
function SignedOutPrompt() {
  return (
    <Reveal>
      <Stub notched className="mt-8 px-6 py-16 text-center">
        <div className="mx-auto max-w-sm">
          <div className="display text-[1.6rem] text-bone">
            Sign in to see what&rsquo;s on
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-bone-dim">
            The event calendar is for Karnavati students and staff, so it sits
            behind your university account.
          </p>
          <Button className="mt-7" size="lg" asChild>
            <Link href="/login">Continue with your KU account</Link>
          </Button>
        </div>
      </Stub>
    </Reveal>
  );
}
