"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, QrCode } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchMyTickets, fetchPublishedEvents } from "@/lib/firestore-queries";
import { formatRelative, formatTime, shortCode } from "@/lib/format";
import type { EventDoc, TicketDoc } from "@/lib/types";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";

/**
 * The pass you need next, pinned to the top of the home page.
 *
 * The ticket screen is the best thing in the product and it was three taps
 * deep — Events, My passes, then the right one. That is the wrong ergonomics
 * at the exact moment it matters, standing in a queue with a marshal waiting.
 *
 * Only renders when there is genuinely something imminent, so it never becomes
 * furniture the eye learns to skip.
 */
export function NextPass() {
  const { user } = useAuth();
  const [pass, setPass] = useState<{ ticket: TicketDoc; event: EventDoc } | null>(
    null,
  );

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      try {
        const [tickets, events] = await Promise.all([
          fetchMyTickets(user!.uid),
          fetchPublishedEvents(),
        ]);

        if (cancelled) return;

        const byId = new Map(events.map((e) => [e.id, e]));
        const now = Date.now();

        // Soonest event that has not finished and whose pass is still unused.
        // A checked-in pass is not "next" — that person is already inside.
        const next = tickets
          .filter((t) => t.status === "issued" && !t.checked_in)
          .map((t) => ({ ticket: t, event: byId.get(t.event_id) }))
          .filter(
            (row): row is { ticket: TicketDoc; event: EventDoc } =>
              Boolean(row.event) && row.event!.ends_at >= now,
          )
          .sort((a, b) => a.event.starts_at - b.event.starts_at)[0];

        // Only worth pinning inside a week. Beyond that it is not "next", it is
        // just something you booked, and My passes is the right home for it.
        const WEEK = 7 * 24 * 60 * 60 * 1000;
        setPass(next && next.event.starts_at - now < WEEK ? next : null);
      } catch (error) {
        // Silent: this is an enhancement on top of the directory, and a failure
        // here must not put an error in front of someone browsing events.
        console.error("[next pass] load failed", error);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!pass) return null;

  const { ticket, event } = pass;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-9"
    >
      <Link href={`/tickets/${ticket.id}`} className="group block">
        <Stub
          notched
          notchAt="50%"
          className="flex items-stretch overflow-hidden transition-all duration-300 group-hover:border-[color:var(--line-strong)] group-hover:shadow-[0_20px_44px_-24px_#000000e6]"
        >
          <div className="min-w-0 flex-1 px-5 py-5">
            <FieldLabel>Your next pass</FieldLabel>

            <h2 className="display mt-2 truncate text-[1.35rem] leading-tight text-foreground">
              {event.title}
            </h2>

            <div className="mt-2 font-mono text-[11px] text-muted-foreground">
              {formatRelative(event.starts_at)} · {formatTime(event.starts_at)} ·{" "}
              {event.venue}
            </div>
          </div>

          {/* Vertical tear, so the row reads as a stub seen end-on. */}
          <div className="my-4 w-px bg-[linear-gradient(to_bottom,var(--line-strong)_0_6px,transparent_6px_12px)] bg-[length:1px_12px]" />

          <div className="flex w-[7rem] shrink-0 flex-col items-center justify-center gap-1.5 px-3">
            <QrCode className="size-5 text-primary transition-transform group-hover:scale-110" />
            <span className="font-mono text-[12px] tracking-[0.12em] text-foreground tabular">
              {shortCode(ticket.id)}
            </span>
            <span className="inline-flex items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">
              Show
              <ArrowRight className="size-2.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Stub>
      </Link>

      <Perforation className="mx-6 mt-9" />
    </motion.div>
  );
}
