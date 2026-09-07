"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchMyTickets, fetchOpenEvents } from "@/lib/firestore-queries";
import { formatDate, formatTime, shortCode } from "@/lib/format";
import type { EventDoc, TicketDoc } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

export function MyPasses() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketDoc[]>([]);
  const [events, setEvents] = useState<Record<string, EventDoc>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [mine, openEvents] = await Promise.all([
        fetchMyTickets(user.uid),
        fetchOpenEvents(),
      ]);

      setTickets(mine);
      setEvents(Object.fromEntries(openEvents.map((e) => [e.id, e])));
    } catch (error) {
      console.error("[passes] load failed", error);
      toast.error("Could not load your passes", {
        id: "load-passes",
        description: "Check your connection and retry.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See events-home.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const live = tickets.filter((t) => t.status === "issued" && !t.checked_in);
  const used = tickets.filter((t) => t.status !== "issued" || t.checked_in);

  return (
    <AppShell theme="paper">
      <div className="mb-9">
        <FieldLabel>Karnavati University</FieldLabel>
        <h1 className="display mt-2.5 text-[2.5rem] text-ink sm:text-[3.25rem]">
          Your passes
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="stub h-24 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Stub notched className="px-6 py-14 text-center">
          <div className="mx-auto max-w-xs">
            <div className="display text-[1.5rem] text-ink">No passes yet</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-dim">
              Grab one from the events list and it will live here, ready for the
              gate.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/">
                Browse events
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </Stub>
      ) : (
        <div className="space-y-9">
          {live.length > 0 ? (
            <section>
              <FieldLabel className="mb-3">Ready to scan</FieldLabel>
              <div className="space-y-3.5">
                {live.map((ticket, i) => (
                  <PassRow
                    key={ticket.id}
                    ticket={ticket}
                    event={events[ticket.event_id]}
                    index={i}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {used.length > 0 ? (
            <section>
              <FieldLabel className="mb-3">Used and past</FieldLabel>
              <div className="space-y-3.5">
                {used.map((ticket, i) => (
                  <PassRow
                    key={ticket.id}
                    ticket={ticket}
                    event={events[ticket.event_id]}
                    index={i}
                    dim
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function PassRow({
  ticket,
  event,
  index,
  dim = false,
}: {
  ticket: TicketDoc;
  event?: EventDoc;
  index: number;
  dim?: boolean;
}) {
  return (
    <Link href={`/tickets/${ticket.id}`} className="block">
      <Stub
        notched
        notchAt="50%"
        className={`animate-stub-in flex items-stretch overflow-hidden transition-colors hover:border-[color:var(--line-strong)] ${
          dim ? "opacity-55" : ""
        }`}
        style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
      >
        <div className="min-w-0 flex-1 px-5 py-4">
          <h2 className="display truncate text-[1.15rem] text-ink">
            {event?.title ?? "Event"}
          </h2>
          <div className="mt-1.5 font-mono text-[11px] text-ink-dim">
            {event ? `${formatDate(event.starts_at)} · ${formatTime(event.starts_at)}` : "—"}
          </div>
        </div>

        {/* Vertical tear, so the row reads as a stub end-on. */}
        <div className="my-3 w-px bg-[linear-gradient(to_bottom,var(--line-strong)_0_6px,transparent_6px_12px)] bg-[length:1px_12px]" />

        <div className="flex w-[6.5rem] shrink-0 flex-col items-center justify-center gap-1 px-3">
          {ticket.status !== "issued" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-refuse">
              {ticket.status}
            </span>
          ) : ticket.checked_in ? (
            <>
              <CheckCircle2 className="size-4 text-admit" />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-admit">
                Used
              </span>
            </>
          ) : (
            <>
              <span className="font-mono text-[13px] tracking-[0.14em] text-ink tabular">
                {shortCode(ticket.id)}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">
                Pass no.
              </span>
            </>
          )}
        </div>
      </Stub>
    </Link>
  );
}
