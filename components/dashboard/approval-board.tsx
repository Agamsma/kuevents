"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Inbox, Loader2, MapPin, Users, X } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchPendingEvents } from "@/lib/firestore-queries";
import { formatDateTime, formatDayNum, formatMonthAbbr } from "@/lib/format";
import { TRACK_LABELS, type EventDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextAreaField, TextField } from "@/components/ui/field";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

/** What the organizer is currently deciding, and which way. */
type Decision =
  | { kind: "review"; event: EventDoc }
  | { kind: "approve"; event: EventDoc }
  | { kind: "reject"; event: EventDoc }
  | null;

export function ApprovalBoard() {
  const { getIdToken } = useAuth();

  const [pending, setPending] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Decision>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      setPending(await fetchPendingEvents());
    } catch (error) {
      console.error("[requests] load failed", error);
      toast.error("Could not load proposals", {
        id: "requests",
        description: "Check your connection and retry.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See event-directory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const decide = useCallback(
    async (event: EventDoc, status: "published" | "rejected", extras: {
      capacity?: number;
      review_note?: string;
    }) => {
      setWorking(true);
      try {
        const token = await getIdToken();
        if (!token) throw new Error("Your session expired. Sign in again.");

        const response = await fetch("/api/events", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event_id: event.id, status, ...extras }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not save that.");

        // Drop it from the queue immediately — it is no longer pending, and
        // leaving it there invites a second organizer to decide it again.
        setPending((current) => current.filter((e) => e.id !== event.id));
        setDecision(null);

        toast.success(
          status === "published"
            ? `“${event.title}” is live on the directory`
            : `“${event.title}” was turned down`,
          {
            id: "decision",
            description:
              status === "published"
                ? "Students can reserve passes now."
                : "The proposer can see the decision on their requests.",
          },
        );
      } catch (error) {
        toast.error("Could not save that", {
          id: "decision",
          description: error instanceof Error ? error.message : "Try again.",
        });
      } finally {
        setWorking(false);
      }
    },
    [getIdToken],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-24 pt-28 sm:px-6">
      <FieldLabel>Review queue</FieldLabel>
      <div className="mt-3 flex items-end justify-between gap-4">
        <h1 className="display text-[clamp(2rem,6vw,2.75rem)] text-bone">
          Event proposals
        </h1>
        {!loading && pending.length > 0 ? (
          <span className="shrink-0 rounded-full border border-gold/30 bg-gold/[0.08] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold tabular">
            {pending.length} waiting
          </span>
        ) : null}
      </div>
      <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-bone-dim">
        Approving publishes the event to the campus directory and makes you its
        organizer — the roster and the gate become yours.
      </p>

      <div className="mt-10">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="stub h-64 animate-pulse" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <EmptyQueue />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pending.map((event, index) => (
                <ProposalCard
                  key={event.id}
                  event={event}
                  index={index}
                  onOpen={() => setDecision({ kind: "review", event })}
                  onApprove={() => setDecision({ kind: "approve", event })}
                  onReject={() => setDecision({ kind: "reject", event })}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ReviewDialog
        decision={decision}
        working={working}
        onClose={() => !working && setDecision(null)}
        onApprove={(event, capacity) => decide(event, "published", { capacity })}
        onReject={(event, note) => decide(event, "rejected", { review_note: note })}
        onEscalate={(kind) =>
          setDecision((d) => (d ? { kind, event: d.event } : null))
        }
      />
    </div>
  );
}

function ProposalCard({
  event,
  index,
  onOpen,
  onApprove,
  onReject,
}: {
  event: EventDoc;
  index: number;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.25 } }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: Math.min(index, 6) * 0.05 }}
    >
      <Stub notched notchAt="calc(100% - 4.25rem)" className="flex h-full flex-col overflow-hidden">
        <button type="button" onClick={onOpen} className="flex-1 px-5 pb-5 pt-5 text-left">
          <div className="flex items-start gap-4">
            <div className="shrink-0 text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-gold">
                {formatMonthAbbr(event.starts_at)}
              </div>
              <div className="display text-[1.75rem] leading-none text-bone tabular">
                {formatDayNum(event.starts_at)}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="display text-[1.2rem] leading-tight text-bone">
                {event.title}
              </h2>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-dim">
                  {TRACK_LABELS[event.track] ?? event.track}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-dim">
                  {event.category}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1 font-mono text-[10px] text-bone-dim">
            <span className="flex items-center gap-1.5 truncate">
              <MapPin className="size-3 shrink-0 text-bone-faint" />
              {event.venue}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3 shrink-0 text-bone-faint" />
              {event.expected_footfall} expected
            </span>
          </div>
        </button>

        <Perforation className="mx-5" />

        <div className="flex h-[4.25rem] items-center gap-2 px-5">
          <Button size="sm" variant="outline" onClick={onOpen}>
            Review
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={onReject} aria-label="Reject">
              <X className="size-4 text-refuse" />
            </Button>
            <Button size="sm" onClick={onApprove}>
              <Check className="size-4" />
              Approve
            </Button>
          </div>
        </div>
      </Stub>
    </motion.article>
  );
}

/**
 * One dialog, three modes.
 *
 * Review shows the full proposal. Approve asks for a capacity, because the
 * proposer only gave an estimate and the venue is the organizer's problem.
 * Reject asks for a note, because "no" without a reason is the thing that stops
 * people proposing again.
 */
function ReviewDialog({
  decision,
  working,
  onClose,
  onApprove,
  onReject,
  onEscalate,
}: {
  decision: Decision;
  working: boolean;
  onClose: () => void;
  onApprove: (event: EventDoc, capacity: number) => void;
  onReject: (event: EventDoc, note: string) => void;
  onEscalate: (kind: "approve" | "reject") => void;
}) {
  const event = decision?.event ?? null;
  if (!event) return null;

  return (
    <Dialog open={Boolean(decision)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        {decision?.kind === "review" ? (
          <>
            <DialogHeader>
              <DialogTitle className="display text-[1.6rem] leading-tight">
                {event.title}
              </DialogTitle>
              <DialogDescription>
                Proposed {formatDateTime(event.created_at)}
              </DialogDescription>
            </DialogHeader>

            {event.cover_image_url ? (
              <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-line">
                <Image
                  src={event.cover_image_url}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 32rem"
                  className="object-cover"
                />
              </div>
            ) : null}

            <dl className="divide-y divide-[color:var(--line)]">
              {(
                [
                  ["Running it", TRACK_LABELS[event.track] ?? event.track],
                  ["Category", event.category],
                  ["When", formatDateTime(event.starts_at)],
                  ["Until", formatDateTime(event.ends_at)],
                  ["Venue", event.venue],
                  ["Expected", `${event.expected_footfall} people`],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="field-label shrink-0">{label}</dt>
                  <dd className="min-w-0 text-right text-[14px] text-bone">{value}</dd>
                </div>
              ))}
            </dl>

            {event.description ? (
              <div className="rounded-xl border border-line bg-white/[0.02] p-4">
                <FieldLabel>What happens</FieldLabel>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-bone-dim">
                  {event.description}
                </p>
              </div>
            ) : (
              <p className="text-[13px] italic text-bone-faint">
                No description given.
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onEscalate("reject")}>
                <X className="size-4 text-refuse" />
                Reject
              </Button>
              <Button onClick={() => onEscalate("approve")}>
                <Check className="size-4" />
                Approve
              </Button>
            </DialogFooter>
          </>
        ) : null}

        {/* Keyed on the event so switching proposals remounts the panel and its
            fields re-initialise from that event. That is what lets the capacity
            default to the proposer's estimate without an effect syncing it. */}
        {decision?.kind === "approve" ? (
          <ApprovePanel
            key={event.id}
            event={event}
            working={working}
            onCancel={onClose}
            onConfirm={(capacity) => onApprove(event, capacity)}
          />
        ) : null}

        {decision?.kind === "reject" ? (
          <RejectPanel
            key={event.id}
            event={event}
            working={working}
            onCancel={onClose}
            onConfirm={(note) => onReject(event, note)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Approving asks for a capacity, because the proposer only gave an estimate and
 * the venue is the organizer's problem, not theirs.
 */
function ApprovePanel({
  event,
  working,
  onCancel,
  onConfirm,
}: {
  event: EventDoc;
  working: boolean;
  onCancel: () => void;
  onConfirm: (capacity: number) => void;
}) {
  const [capacity, setCapacity] = useState(
    String(event.expected_footfall || 100),
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle className="display text-[1.5rem]">
          Publish this event?
        </DialogTitle>
        <DialogDescription>
          It goes onto the campus directory straight away, and you become its
          organizer.
        </DialogDescription>
      </DialogHeader>

      <TextField
        label="Capacity"
        name="capacity"
        type="number"
        min="0"
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        hint={`They estimated ${event.expected_footfall}. Use 0 for unlimited.`}
        autoFocus
      />

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={working}>
          Cancel
        </Button>
        <Button onClick={() => onConfirm(Number(capacity) || 0)} disabled={working}>
          {working ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Publish it
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Rejecting asks for a reason, because "no" without one is the thing that stops
 * people proposing again.
 */
function RejectPanel({
  event,
  working,
  onCancel,
  onConfirm,
}: {
  event: EventDoc;
  working: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");

  return (
    <>
      <DialogHeader>
        <DialogTitle className="display text-[1.5rem]">
          Turn this down?
        </DialogTitle>
        <DialogDescription>
          The proposal is kept, not deleted, so &ldquo;{event.title}&rdquo; stays
          on record and the proposer can see what you said.
        </DialogDescription>
      </DialogHeader>

      <TextAreaField
        label="Reason"
        name="review_note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="The auditorium is already booked that weekend — try the following Saturday and resubmit."
        maxLength={500}
        hint="Optional, but a reason is what makes someone try again."
        autoFocus
      />

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={working}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={() => onConfirm(note)} disabled={working}>
          {working ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          Reject it
        </Button>
      </DialogFooter>
    </>
  );
}

function EmptyQueue() {
  return (
    <Stub notched className="px-6 py-20 text-center">
      <div className="mx-auto max-w-sm">
        <Inbox className="mx-auto size-9 text-bone-faint" />
        <div className="display mt-5 text-[1.5rem] text-bone">Queue is clear</div>
        <p className="mt-2.5 text-sm leading-relaxed text-bone-dim">
          Nothing waiting on a decision. New student proposals land here the
          moment they are sent.
        </p>
      </div>
    </Stub>
  );
}
