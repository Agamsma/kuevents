"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Users } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchAllEvents } from "@/lib/firestore-queries";
import { formatDate, formatTime } from "@/lib/format";
import {
  EVENT_CATEGORIES,
  TRACK_LABELS,
  type EventCategory,
  type EventDoc,
  type EventStatus,
  type EventTrack,
} from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

/** How a status reads, and what it means a student can do. */
const STATUS_STYLE: Record<EventStatus, { label: string; className: string }> = {
  pending: { label: "In review", className: "text-gold border-gold/30 bg-gold/[0.08]" },
  rejected: { label: "Rejected", className: "text-refuse border-refuse/30 bg-refuse/[0.08]" },
  draft: { label: "Draft", className: "text-bone-faint border-line" },
  published: { label: "Open", className: "text-admit border-admit/30 bg-admit/[0.08]" },
  live: { label: "Live now", className: "text-gold border-gold/30 bg-gold/[0.08]" },
  ended: { label: "Ended", className: "text-bone-faint border-line" },
  cancelled: { label: "Cancelled", className: "text-refuse border-refuse/30 bg-refuse/[0.08]" },
};

export function OrganizerDashboard() {
  const { getIdToken } = useAuth();

  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEvents(await fetchAllEvents());
    } catch (error) {
      console.error("[organizer] load failed", error);
      toast.error("Could not load events", {
        id: "org-load",
        description: "Check your connection and retry.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See events-home.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setStatus = useCallback(
    async (event: EventDoc, status: EventStatus) => {
      setBusyId(event.id);
      try {
        const token = await getIdToken();
        if (!token) throw new Error("Your session expired. Sign in again.");

        const response = await fetch("/api/events", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: event.id, status }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not update.");

        setEvents((current) =>
          current.map((e) => (e.id === event.id ? { ...e, status } : e)),
        );

        toast.success(
          status === "published" ? "Event opened for booking" : `Marked ${status}`,
          { id: "org-status" },
        );
      } catch (error) {
        toast.error("Could not update", {
          id: "org-status",
          description: error instanceof Error ? error.message : "Try again.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [getIdToken],
  );

  const totals = events.reduce(
    (acc, e) => {
      acc.issued += e.tickets_issued ?? 0;
      acc.capacity += e.capacity ?? 0;
      return acc;
    },
    { issued: 0, capacity: 0 },
  );

  return (
    <AppShell>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <FieldLabel>Organizer</FieldLabel>
          <h1 className="display mt-2.5 text-[2.5rem] text-bone sm:text-[3.25rem]">
            Your events
          </h1>
        </div>

        <Button onClick={() => setComposerOpen(true)}>
          <Plus className="size-4" />
          New event
        </Button>
      </div>

      {/* Two numbers that answer "how is it going" without a chart. */}
      {events.length > 0 ? (
        <Stub className="mb-6 flex items-center divide-x divide-[color:var(--line)] px-0 py-4">
          <div className="flex-1 px-5">
            <FieldLabel>Passes issued</FieldLabel>
            <div className="display mt-1 text-[2rem] leading-none text-bone tabular">
              {totals.issued}
            </div>
          </div>
          <div className="flex-1 px-5">
            <FieldLabel>Total capacity</FieldLabel>
            <div className="display mt-1 text-[2rem] leading-none text-bone-dim tabular">
              {totals.capacity || "—"}
            </div>
          </div>
        </Stub>
      ) : null}

      {loading ? (
        <div className="space-y-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="stub h-32 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Stub notched className="px-6 py-14 text-center">
          <div className="mx-auto max-w-xs">
            <div className="display text-[1.5rem] text-bone">No events yet</div>
            <p className="mt-2 text-sm leading-relaxed text-bone-dim">
              Create one as a draft, check it reads right, then open it for
              booking.
            </p>
            <Button className="mt-6" onClick={() => setComposerOpen(true)}>
              <Plus className="size-4" />
              New event
            </Button>
          </div>
        </Stub>
      ) : (
        <div className="space-y-3.5">
          {events.map((event, index) => (
            <ManagedEvent
              key={event.id}
              event={event}
              busy={busyId === event.id}
              onSetStatus={(status) => setStatus(event, status)}
              index={index}
            />
          ))}
        </div>
      )}

      <EventComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        onCreated={(event) => setEvents((current) => [event, ...current])}
      />
    </AppShell>
  );
}

function ManagedEvent({
  event,
  busy,
  onSetStatus,
  index,
}: {
  event: EventDoc;
  busy: boolean;
  onSetStatus: (status: EventStatus) => void;
  index: number;
}) {
  const style = STATUS_STYLE[event.status] ?? STATUS_STYLE.draft;
  const issued = event.tickets_issued ?? 0;
  const pct = event.capacity > 0 ? Math.min((issued / event.capacity) * 100, 100) : 0;

  return (
    <Stub
      notched
      notchAt="calc(100% - 3.75rem)"
      className="animate-stub-in overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 6) * 55}ms` }}
    >
      <div className="px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/organizer/${event.id}`} className="min-w-0 group">
            <h2 className="display truncate text-[1.3rem] text-bone transition-colors group-hover:text-crimson">
              {event.title}
            </h2>
            <div className="mt-1.5 font-mono text-[11px] text-bone-dim">
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)} ·{" "}
              {event.venue}
            </div>
          </Link>

          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${style.className}`}
          >
            {style.label}
          </span>
        </div>

        <div className="mt-5 flex items-end gap-6">
          <div>
            <FieldLabel>Issued</FieldLabel>
            <div className="display mt-1 text-[1.75rem] leading-none text-bone tabular">
              {issued}
              {event.capacity > 0 ? (
                <span className="text-[1rem] text-bone-faint">/{event.capacity}</span>
              ) : null}
            </div>
          </div>

          <div>
            <FieldLabel>Track</FieldLabel>
            <div className="mt-1.5 font-mono text-sm text-bone-dim">
              {TRACK_LABELS[event.track] ?? event.track}
            </div>
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <div className="mt-1.5 font-mono text-sm text-bone-dim">
              {event.category}
            </div>
          </div>
        </div>

        {event.capacity > 0 ? (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-crimson transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
      </div>

      <Perforation className="mx-5" />

      <div className="flex h-[3.75rem] items-center gap-2 px-5">
        <Button size="sm" variant="outline" asChild>
          <Link href={`/organizer/${event.id}`}>
            <Users className="size-3.5" />
            Attendees
          </Link>
        </Button>

        <div className="ml-auto flex items-center gap-2">
        {busy ? (
          <Loader2 className="size-4 animate-spin text-bone-faint" />
        ) : event.status === "draft" ? (
          <Button size="sm" onClick={() => onSetStatus("published")}>
            Open for booking
          </Button>
        ) : event.status === "published" ? (
          <>
            <Button size="sm" variant="gold" onClick={() => onSetStatus("live")}>
              Start event
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSetStatus("draft")}>
              Close bookings
            </Button>
          </>
        ) : event.status === "live" ? (
          <Button size="sm" variant="outline" onClick={() => onSetStatus("ended")}>
            End event
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onSetStatus("published")}>
            Reopen
          </Button>
        )}
        </div>
      </div>
    </Stub>
  );
}

/** Minimal, honest form: only the fields the gate and the student actually need. */
function EventComposer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (event: EventDoc) => void;
}) {
  const { getIdToken } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [track, setTrack] = useState<EventTrack | null>(null);
  const [category, setCategory] = useState<EventCategory | null>(null);

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);

    const startsAt = new Date(String(form.get("starts_at"))).getTime();
    const durationHours = Number(form.get("duration_hours")) || 3;

    // Caught here so the person sees it next to the chips they missed, rather
    // than as a toast carrying the server's phrasing.
    if (!track || !category) {
      toast.error("Almost there", {
        id: "org-create",
        description: !track ? "Pick who is running it." : "Pick a category.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: form.get("title"),
          venue: form.get("venue"),
          description: form.get("description") ?? "",
          starts_at: startsAt,
          ends_at: startsAt + durationHours * 60 * 60 * 1000,
          track,
          category,
          capacity: Number(form.get("capacity")) || 0,
          expected_footfall: Number(form.get("capacity")) || 0,
          cover_image_url: null,
          status: "draft",
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create the event.");

      onCreated(body.event as EventDoc);
      onOpenChange(false);
      toast.success("Event created as a draft", {
        id: "org-create",
        description: "Open it for booking when you are ready.",
      });
    } catch (error) {
      toast.error("Could not create the event", {
        id: "org-create",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-[1.5rem]">New event</DialogTitle>
          <DialogDescription>
            Saved as a draft. Nobody can book it until you open it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input name="title" label="Title" required placeholder="Techfest opening night" />
          <Input name="venue" label="Venue" required placeholder="Main Auditorium" />
          <Input
            name="description"
            label="Description"
            placeholder="What happens, in one line"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input name="starts_at" label="Starts" type="datetime-local" required />
            <Input
              name="duration_hours"
              label="Hours"
              type="number"
              min="1"
              defaultValue="3"
            />
          </div>

          <Input
            name="capacity"
            label="Capacity"
            type="number"
            min="0"
            defaultValue="100"
            hint="0 = unlimited"
          />

          <ChipGroup
            label="Who is running it"
            name="track"
            value={track}
            onChange={setTrack}
            options={(Object.keys(TRACK_LABELS) as EventTrack[]).map((t) => ({
              value: t,
              label: TRACK_LABELS[t],
            }))}
          />

          <ChipGroup
            label="Category"
            name="category"
            value={category}
            onChange={setCategory}
            options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Create draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Input({
  label,
  hint,
  name,
  ...props
}: React.ComponentProps<"input"> & { label: string; hint?: string }) {
  const id = `field-${name}`;

  return (
    <div>
      <label htmlFor={id} className="field-label block">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="mt-1.5 w-full rounded-md border border-line bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-bone-faint focus:border-crimson focus:outline-none"
        {...props}
      />
      {hint ? (
        <p className="mt-1 font-mono text-[10px] text-bone-faint">{hint}</p>
      ) : null}
    </div>
  );
}
