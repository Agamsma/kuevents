"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Plus,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchMyProposals } from "@/lib/firestore-queries";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { TRACK_LABELS, type EventDoc, type EventStatus } from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

/**
 * How each status reads to the person who proposed it.
 *
 * Deliberately in the proposer's language, not the system's: a `published`
 * event is "Approved" from here, because what they care about is the decision,
 * not the lifecycle state the row happens to be in.
 */
const VIEW: Record<
  EventStatus,
  { label: string; tone: string; icon: typeof Clock; blurb: string }
> = {
  pending: {
    label: "Waiting on a decision",
    tone: "text-primary border-primary/30 bg-primary/[0.08]",
    icon: Clock,
    blurb: "An organizer will review this shortly.",
  },
  rejected: {
    label: "Not approved",
    tone: "text-refuse border-refuse/30 bg-refuse/[0.08]",
    icon: XCircle,
    blurb: "You can take the feedback and propose it again.",
  },
  published: {
    label: "Approved",
    tone: "text-admit border-admit/30 bg-admit/[0.08]",
    icon: CheckCircle2,
    blurb: "It is on the directory and students can reserve passes.",
  },
  live: {
    label: "Happening now",
    tone: "text-primary border-primary/30 bg-primary/[0.08]",
    icon: CheckCircle2,
    blurb: "Doors are open.",
  },
  draft: {
    label: "Draft",
    tone: "border-line text-muted-foreground",
    icon: Clock,
    blurb: "Not visible to anyone yet.",
  },
  ended: {
    label: "Finished",
    tone: "border-line text-muted-foreground",
    icon: CheckCircle2,
    blurb: "This one is done.",
  },
  cancelled: {
    label: "Called off",
    tone: "text-refuse border-refuse/30 bg-refuse/[0.08]",
    icon: XCircle,
    blurb: "Cancelled after it was published.",
  },
};

export function MyProposals() {
  const { user } = useAuth();

  const [proposals, setProposals] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    try {
      setProposals(await fetchMyProposals(user.uid));
    } catch (error) {
      console.error("[proposals] load failed", error);
      toast.error("Could not load your proposals", {
        id: "my-proposals",
        description: "Check your connection and retry.",
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See event-directory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Awaiting a decision first — that is the only group with an open question.
  const { open, decided } = useMemo(() => {
    const open = proposals.filter((p) => p.status === "pending");
    const decided = proposals.filter((p) => p.status !== "pending");
    return { open, decided };
  }, [proposals]);

  return (
    <AppShell theme="paper">
      <div className="flex items-end justify-between gap-4">
        <div>
          <FieldLabel>Your proposals</FieldLabel>
          <h1 className="display mt-2.5 text-[clamp(2rem,6vw,2.75rem)] text-foreground">
            What you&rsquo;ve asked for
          </h1>
        </div>

        <Button asChild>
          <Link href="/events/request">
            <Plus className="size-4" />
            New
          </Link>
        </Button>
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="stub h-40 animate-pulse" />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {open.length > 0 ? (
              <section>
                <FieldLabel className="mb-3.5">In review</FieldLabel>
                <div className="space-y-4">
                  {open.map((p, i) => (
                    <ProposalRow key={p.id} proposal={p} index={i} />
                  ))}
                </div>
              </section>
            ) : null}

            {decided.length > 0 ? (
              <section>
                <FieldLabel className="mb-3.5">Decided</FieldLabel>
                <div className="space-y-4">
                  {decided.map((p, i) => (
                    <ProposalRow key={p.id} proposal={p} index={i} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProposalRow({ proposal, index }: { proposal: EventDoc; index: number }) {
  const view = VIEW[proposal.status] ?? VIEW.pending;
  const Icon = view.icon;

  const isApproved = proposal.status === "published" || proposal.status === "live";
  const wasRejected = proposal.status === "rejected";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index, 6) * 0.05,
      }}
    >
      <Stub
        notched={wasRejected || isApproved}
        notchAt="calc(100% - 4.5rem)"
        className="overflow-hidden"
      >
        <div className="px-5 pb-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="display text-[1.25rem] leading-tight text-foreground">
                {proposal.title}
              </h2>
              <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                {formatDate(proposal.starts_at)} · {formatTime(proposal.starts_at)}
                {" · "}
                {proposal.venue}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">
                  {TRACK_LABELS[proposal.track] ?? proposal.track}
                </span>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-subtle-foreground">
                  {proposal.category}
                </span>
              </div>
            </div>

            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${view.tone}`}
            >
              <Icon className="size-3" />
              {view.label}
            </span>
          </div>

          <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
            {view.blurb}
          </p>

          {/* The whole point of this page: the organizer's reason, shown to the
              person it was written for. */}
          {wasRejected && proposal.review_note ? (
            <div className="mt-4 rounded-xl border border-refuse/25 bg-refuse/[0.05] p-4">
              <FieldLabel>What the organizer said</FieldLabel>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                {proposal.review_note}
              </p>
              {proposal.reviewed_at ? (
                <p className="mt-2.5 font-mono text-[10px] text-subtle-foreground">
                  {formatDateTime(proposal.reviewed_at)}
                </p>
              ) : null}
            </div>
          ) : null}

          {wasRejected && !proposal.review_note ? (
            <p className="mt-4 text-[13px] italic leading-relaxed text-subtle-foreground">
              No reason was given. Ask the organising team if you want to know
              more.
            </p>
          ) : null}
        </div>

        {isApproved || wasRejected ? (
          <>
            <Perforation className="mx-5" />
            <div className="flex h-[4.5rem] items-center px-5">
              {isApproved ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/events/${proposal.id}`}>
                    See it on the directory
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/events/request">
                    <Plus className="size-3.5" />
                    Propose it again
                  </Link>
                </Button>
              )}
            </div>
          </>
        ) : null}
      </Stub>
    </motion.article>
  );
}

function EmptyState() {
  return (
    <Stub notched className="px-6 py-16 text-center">
      <div className="mx-auto max-w-sm">
        <div className="display text-[1.5rem] text-foreground">
          You haven&rsquo;t proposed anything yet
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
          Anyone on campus can put an event forward. An organizer reviews it,
          and if it is approved it goes straight onto the directory.
        </p>
        <Button className="mt-7" asChild>
          <Link href="/events/request">
            <Plus className="size-4" />
            Propose an event
          </Link>
        </Button>
      </div>
    </Stub>
  );
}
