"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Download, Search } from "lucide-react";

import { fetchEvent, subscribeEventTickets } from "@/lib/firestore-queries";
import { formatDateTime, formatTime, shortCode } from "@/lib/format";
import type { EventDoc, TicketDoc } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

type Filter = "all" | "inside" | "outside";

export function AttendeeList({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [tickets, setTickets] = useState<TicketDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  /** Whether the roster subscription is currently connected. */
  const [live, setLive] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // The event itself does not change during a gate, so it is fetched once.
  useEffect(() => {
    let cancelled = false;

    fetchEvent(eventId)
      .then((eventDoc) => {
        if (cancelled) return;
        if (!eventDoc) setMissing(true);
        else setEvent(eventDoc);
      })
      .catch((error) => {
        console.error("[attendees] event load failed", error);
        if (!cancelled) setMissing(true);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  /*
   * The roster is live.
   *
   * This is the screen an organizer stands at the door with. Gate devices sync
   * their check-ins in batches, so the count moves in bursts — having to tap
   * refresh to find out whether the queue outside is clearing is exactly the
   * wrong ergonomics at that moment.
   *
   * Sorted by name rather than by arrival: someone reading this is looking for
   * a specific person, and a list that reorders itself under them as people
   * walk in would be unusable.
   *
   * setState only ever runs from the snapshot callback, never synchronously in
   * the effect body.
   */
  useEffect(() => {
    return subscribeEventTickets(
      eventId,
      (roster) => {
        setTickets(
          [...roster].sort((a, b) =>
            a.user_name.localeCompare(b.user_name, "en-IN"),
          ),
        );
        setLoading(false);
        setLive(true);
      },
      (error) => {
        console.error("[attendees] subscription failed", error);
        setLoading(false);
        setLive(false);
        toast.error("Lost the live connection", {
          id: "attendees",
          description: "The count may be stale. Reload to reconnect.",
        });
      },
    );
  }, [eventId]);

  const stats = useMemo(() => {
    const issued = tickets.filter((t) => t.status === "issued");
    return {
      total: issued.length,
      inside: issued.filter((t) => t.checked_in).length,
      voided: tickets.length - issued.length,
    };
  }, [tickets]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      if (filter === "inside" && !ticket.checked_in) return false;
      if (filter === "outside" && ticket.checked_in) return false;

      if (!needle) return true;

      return (
        ticket.user_name.toLowerCase().includes(needle) ||
        ticket.user_email.toLowerCase().includes(needle) ||
        shortCode(ticket.id).toLowerCase().includes(needle)
      );
    });
  }, [tickets, search, filter]);

  const exportCsv = useCallback(() => {
    if (!event) return;

    const rows = [
      ["Name", "Email", "Pass no.", "Status", "Checked in at"],
      ...tickets.map((t) => [
        t.user_name,
        t.user_email,
        shortCode(t.id),
        t.status !== "issued" ? t.status : t.checked_in ? "admitted" : "not arrived",
        t.check_in_time ? new Date(t.check_in_time).toISOString() : "",
      ]),
    ];

    const csv = rows
      // Quote every field and double any inner quotes — names with commas are
      // common and would otherwise shift every later column.
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(event.title)}-attendees.csv`;
    link.click();

    URL.revokeObjectURL(url);
    toast.success("Attendee list downloaded", { id: "export" });
  }, [event, tickets]);

  if (missing) {
    return (
      <AppShell theme="paper">
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-5 text-center">
          <AlertTriangle className="size-8 text-refuse" />
          <p className="max-w-[17rem] text-sm leading-relaxed text-muted-foreground">
            This event does not exist, or it has been taken down.
          </p>
          <Button variant="outline" asChild>
            <Link href="/organizer">
              <ArrowLeft className="size-4" />
              Your events
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell theme="paper">
      <Link
        href="/organizer"
        className="mb-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Your events
      </Link>

      <div className="mb-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <FieldLabel>Attendees</FieldLabel>
          <h1 className="display mt-2 truncate text-[2rem] text-foreground sm:text-[2.5rem]">
            {event?.title ?? "…"}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Replaces the old refresh button. It says the same thing the button
              used to imply — "this is current" — without asking anyone to act
              on it mid-queue. */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
              live
                ? "border-admit/30 bg-admit/[0.08] text-admit"
                : "border-line text-subtle-foreground"
            }`}
          >
            {live ? (
              <span className="relative flex size-1.5">
                <span className="animate-live-pulse absolute inline-flex size-full rounded-full bg-admit" />
                <span className="relative inline-flex size-1.5 rounded-full bg-admit" />
              </span>
            ) : null}
            {live ? "Live" : "Offline"}
          </span>

          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={tickets.length === 0}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* ── Door count ─────────────────────────────────────────────────── */}
      <Stub className="mb-5 overflow-hidden">
        <div className="flex items-end justify-between gap-4 px-5 pb-4 pt-4">
          <div>
            <FieldLabel>Inside</FieldLabel>
            <div className="display mt-1 text-[2.5rem] leading-none text-admit tabular">
              {stats.inside}
              <span className="text-[1.25rem] text-subtle-foreground">/{stats.total}</span>
            </div>
          </div>

          <div className="text-right">
            <FieldLabel>Yet to arrive</FieldLabel>
            <div className="display mt-1 text-[1.75rem] leading-none text-foreground tabular">
              {stats.total - stats.inside}
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div
            className="h-1 overflow-hidden rounded-full bg-accent"
            role="progressbar"
            aria-valuenow={stats.total ? Math.round((stats.inside / stats.total) * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Share of attendees admitted"
          >
            <div
              className="h-full rounded-full bg-admit transition-[width] duration-500"
              style={{
                width: `${stats.total ? (stats.inside / stats.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {stats.voided > 0 ? (
          <>
            <Perforation className="mx-5" />
            <div className="px-5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-refuse">
              {stats.voided} cancelled or refunded — not counted above
            </div>
          </>
        ) : null}
      </Stub>

      {/* ── Search and filter ──────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-subtle-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or pass no."
            aria-label="Search attendees"
            className="w-full rounded-md border border-line bg-accent py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex gap-1 rounded-md border border-line p-1">
          {(
            [
              ["all", "All"],
              ["inside", "Inside"],
              ["outside", "Outside"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-sm px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                filter === value
                  ? "bg-accent text-foreground"
                  : "text-subtle-foreground hover:text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── The list ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="stub h-64 animate-pulse" />
      ) : tickets.length === 0 ? (
        <Stub notched className="px-6 py-14 text-center">
          <div className="mx-auto max-w-xs">
            <div className="display text-[1.5rem] text-foreground">Nobody yet</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Passes appear here the moment students book them.
            </p>
          </div>
        </Stub>
      ) : visible.length === 0 ? (
        <Stub className="px-6 py-12 text-center text-sm text-muted-foreground">
          No attendee matches {search ? `“${search}”` : "that filter"}.
        </Stub>
      ) : (
        <Stub className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Attendee</TableHead>
                <TableHead>Pass</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="max-w-[13rem]">
                    <div className="truncate font-medium text-foreground">
                      {ticket.user_name}
                    </div>
                    <div className="truncate font-mono text-[10px] text-subtle-foreground">
                      {ticket.user_email}
                    </div>
                  </TableCell>

                  <TableCell className="font-mono text-[11px] tracking-wider text-muted-foreground">
                    {shortCode(ticket.id)}
                  </TableCell>

                  <TableCell className="text-right">
                    {ticket.status !== "issued" ? (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-refuse">
                        {ticket.status}
                      </span>
                    ) : ticket.checked_in ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Check className="size-3 text-admit" />
                        <span
                          className="font-mono text-[11px] text-admit tabular"
                          title={formatDateTime(ticket.check_in_time)}
                        >
                          {formatTime(ticket.check_in_time)}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
                        Not in
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stub>
      )}

      {visible.length > 0 ? (
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-subtle-foreground">
          Showing {visible.length} of {tickets.length}
        </p>
      ) : null}
    </AppShell>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "event"
  );
}
