"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Inbox, ScanLine, Ticket } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { formatDate, formatTime } from "@/lib/format";
import { TRACK_LABELS, type EventDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { DashboardShell, StatCard } from "@/components/dashboard/dashboard-shell";
import { EventsPanel } from "@/components/dashboard/events-panel";
import { RequestsPanel } from "@/components/dashboard/requests-panel";

interface Counts {
  events: number;
  issued: number;
  capacity: number;
}

/**
 * The organizer's home.
 *
 * Everything an organizer does lives behind one set of tabs: the overview
 * answers "what needs me right now", Events is where they create and run their
 * own, and Requests is the shared queue of student proposals. Previously these
 * were two unrelated routes and the review queue was easy to forget existed.
 */
export function OrganizerHome() {
  const { profile } = useAuth();

  const [counts, setCounts] = useState<Counts>({ events: 0, issued: 0, capacity: 0 });
  const [pendingCount, setPendingCount] = useState(0);
  const [upcoming, setUpcoming] = useState<EventDoc | null>(null);
  const [tab, setTab] = useState("overview");

  // Stable identities: these are passed to memoised panels, and a fresh closure
  // each render would re-fire their reporting effects in a loop.
  const handleCounts = useCallback((next: Counts) => setCounts(next), []);
  const handlePending = useCallback((next: number) => setPendingCount(next), []);
  const handleUpcoming = useCallback((next: EventDoc | null) => setUpcoming(next), []);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  const tabs = useMemo(
    () => [
      {
        value: "overview",
        label: "Overview",
        content: (
          <Overview
            counts={counts}
            pendingCount={pendingCount}
            upcoming={upcoming}
            onGoToRequests={() => setTab("requests")}
            onGoToEvents={() => setTab("events")}
          />
        ),
      },
      {
        value: "events",
        label: "Your events",
        content: (
          <EventsPanel
            scope="mine"
            onCountsChange={handleCounts}
            onUpcomingChange={handleUpcoming}
          />
        ),
      },
      {
        value: "requests",
        label: "Requests",
        badge: pendingCount,
        content: <RequestsPanel onCountChange={handlePending} />,
      },
    ],
    [counts, pendingCount, upcoming, handleCounts, handlePending, handleUpcoming],
  );

  return (
    <DashboardShell
      eyebrow="Organizer"
      title={`Welcome back, ${firstName}`}
      description="Create and run your own events, and review what students have put forward."
      tabs={tabs}
      controlledTab={tab}
      onTabChange={setTab}
    />
  );
}

function Overview({
  counts,
  pendingCount,
  upcoming,
  onGoToRequests,
  onGoToEvents,
}: {
  counts: Counts;
  pendingCount: number;
  upcoming: EventDoc | null;
  onGoToRequests: () => void;
  onGoToEvents: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Your events" value={counts.events} />
        <StatCard label="Passes issued" value={counts.issued} tone="admit" />
        <StatCard
          label="Total capacity"
          value={counts.capacity || "—"}
          hint={counts.capacity ? `${counts.issued} taken` : "no caps set"}
        />
        <StatCard
          label="Awaiting you"
          value={pendingCount}
          tone={pendingCount > 0 ? "gold" : undefined}
          hint={pendingCount === 1 ? "proposal" : "proposals"}
        />
      </div>

      {/* The one thing most likely to need action, surfaced above everything. */}
      {pendingCount > 0 ? (
        <Stub notched notchAt="calc(100% - 4.5rem)" className="overflow-hidden">
          <div className="flex items-start gap-4 px-5 pb-5 pt-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-1 ring-gold/30">
              <Inbox className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="display text-[1.25rem] text-foreground">
                {pendingCount} {pendingCount === 1 ? "proposal is" : "proposals are"}{" "}
                waiting
              </h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                A student has put something forward. Nothing appears on the
                directory until an organizer approves it.
              </p>
            </div>
          </div>

          <Perforation className="mx-5" />

          <div className="flex h-[4.5rem] items-center px-5">
            <Button size="sm" variant="gold" onClick={onGoToRequests}>
              Review them
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Stub>
      ) : null}

      {/* Next event, with the two things you actually need on the day. */}
      {upcoming ? (
        <Stub notched notchAt="calc(100% - 4.5rem)" className="overflow-hidden">
          <div className="px-5 pb-5 pt-5">
            <FieldLabel>Next up</FieldLabel>
            <h2 className="display mt-2 text-[1.4rem] leading-tight text-foreground">
              {upcoming.title}
            </h2>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              {formatDate(upcoming.starts_at)} · {formatTime(upcoming.starts_at)} ·{" "}
              {upcoming.venue}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">
                {TRACK_LABELS[upcoming.track] ?? upcoming.track}
              </span>
              <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">
                {upcoming.tickets_issued ?? 0} issued
              </span>
            </div>
          </div>

          <Perforation className="mx-5" />

          <div className="flex h-[4.5rem] items-center gap-2 px-5">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/organizer/${upcoming.id}`}>
                <Ticket className="size-3.5" />
                Attendees
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/scanner">
                <ScanLine className="size-3.5" />
                Open the gate
              </Link>
            </Button>
          </div>
        </Stub>
      ) : counts.events === 0 ? (
        <Stub notched className="px-6 py-14 text-center">
          <div className="mx-auto max-w-sm">
            <CalendarClock className="mx-auto size-8 text-subtle-foreground" />
            <div className="display mt-5 text-[1.5rem] text-foreground">
              Nothing running yet
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
              Create an event as a draft, check it reads right, then open it for
              booking.
            </p>
            <Button className="mt-7" onClick={onGoToEvents}>
              Create an event
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Stub>
      ) : null}
    </div>
  );
}
