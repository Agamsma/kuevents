"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CalendarDays, MapPin, Users, X } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { seatState } from "@/lib/seats";
import { SPRING } from "@/lib/motion";
import { TRACK_LABELS } from "@/lib/types";
import type { EventCardEvent } from "@/components/events/event-card";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";

/**
 * Structural, not EventDoc, for the same reason EventCard is: the directory
 * feeds it EventDoc when signed in and the narrower PublicEvent projection
 * when signed out, and those disagree about whether cover_image_url may be
 * undefined. Reusing EventCardEvent keeps one shape for both.
 */
export type EventExpandEvent = EventCardEvent & {
  description?: string | null;
};

/**
 * A poster opening in place.
 *
 * The card does not navigate — it grows. `layoutId` pairs the collapsed poster
 * with the expanded one so the artwork is physically the same element in both
 * states, which is what makes it read as the card opening rather than as a
 * dialog appearing over it.
 *
 * It shows only what the public directory already knows, so nothing here needs
 * a session. Booking still lives on the event page, behind the CTA, because
 * that path needs auth and a transaction and does not belong in a preview.
 *
 * The expanded panel keeps the obsidian scale, like the card it grew from: a
 * poster is artwork with type over it whichever size it happens to be.
 */
export function EventExpand({
  event,
  onClose,
}: {
  event: EventExpandEvent | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!event) return;

    // The page behind must not scroll under the panel, or dismissing it leaves
    // the reader somewhere they never chose to be.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus moves into the panel so a keyboard user is not left tabbing through
    // the directory behind it.
    closeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [event, onClose]);

  return (
    <AnimatePresence>
      {event ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6">
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // A full-bleed button rather than a div with a click handler, so
            // dismissing by clicking away is reachable without a mouse.
            className="absolute inset-0 cursor-default bg-[#1a1416]/55 backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            layoutId={`poster-${event.id}`}
            role="dialog"
            aria-modal="true"
            aria-label={event.title}
            transition={SPRING}
            data-theme="obsidian"
            className="relative z-10 max-h-[88dvh] w-full max-w-[26rem] overflow-y-auto overflow-x-hidden"
          >
            <Stub className="overflow-hidden">
              {/*
                An explicit height, NOT the .poster class. At 26rem wide its 2:3
                ratio is ~39rem tall, which overflowed a 900px desktop viewport
                and buried the CTA on a phone. Capping the height of an
                aspect-ratio box shrinks its WIDTH to keep the ratio, which left
                the artwork filling half the panel with black beside it — so the
                box is sized directly and the image crops instead.
              */}
              <div className="spotlight relative h-[34dvh] w-full overflow-hidden">
                {event.cover_image_url ? (
                  <Image
                    src={event.cover_image_url}
                    alt=""
                    fill
                    sizes="26rem"
                    className="object-cover"
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

                <button
                  ref={closeRef}
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="chip-on-photo absolute right-3 top-3 z-20 grid size-8 place-items-center rounded-full text-bone"
                >
                  <X className="size-4" />
                </button>

                <div className="absolute inset-x-0 top-0 z-10 flex gap-1.5 p-3">
                  <span className="chip-on-photo rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-bone">
                    {TRACK_LABELS[event.track] ?? event.track}
                  </span>
                  <span className="chip-on-photo rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                    {event.category}
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                  <h2 className="display text-[1.5rem] leading-tight text-bone">
                    {event.title}
                  </h2>
                </div>
              </div>

              <Perforation className="mx-5" />

              <div className="space-y-4 px-5 pb-5 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Doors</FieldLabel>
                    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-bone">
                      <CalendarDays className="size-3 shrink-0 text-bone-faint" />
                      {formatDateTime(event.starts_at)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <FieldLabel>Venue</FieldLabel>
                    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[12px] text-bone">
                      <MapPin className="size-3 shrink-0 text-bone-faint" />
                      <span className="truncate">{event.venue}</span>
                    </div>
                  </div>
                </div>

                {event.description ? (
                  <div>
                    <FieldLabel>About</FieldLabel>
                    <p className="mt-1.5 max-h-32 overflow-auto text-[13px] leading-relaxed text-bone-dim">
                      {event.description}
                    </p>
                  </div>
                ) : null}

                <Seats event={event} />

                <Link
                  href={`/events/${event.id}`}
                  className="group flex h-11 w-full items-center justify-center gap-2 rounded-full bg-crimson text-[14px] font-semibold text-[#1a0207] transition-transform active:scale-[0.98]"
                >
                  Get your pass
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </Stub>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

/** Capacity, said plainly. Uses the same `seatState` the card and gate use. */
function Seats({ event }: { event: EventExpandEvent }) {
  const { seatsLeft, full, low } = seatState(event);

  if (full) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-refuse">
        Full — no seats left
      </div>
    );
  }

  if (seatsLeft === null) {
    return (
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-admit">
        Free entry · open capacity
      </div>
    );
  }

  return (
    <div
      className={
        low
          ? "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-urgent tabular"
          : "flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-admit tabular"
      }
    >
      <Users className="size-3" />
      {seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left
    </div>
  );
}
