"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Users } from "lucide-react";

import { formatDayNum, formatMonthAbbr, formatTime } from "@/lib/format";
import { seatState } from "@/lib/seats";
import { cn } from "@/lib/utils";
import { TRACK_LABELS, type EventDoc, type TicketDoc } from "@/lib/types";
import { Perforation, Stub } from "@/components/ui/stub";

/**
 * The event poster card.
 *
 * Structurally the same object the directory has always shown — a picture
 * stapled to a ticket stub — but turned portrait. The image is now the card
 * rather than a band across the top of it, so the perforation moves down to a
 * short torn foot and the title, venue and time move onto the image, held
 * legible by `.spotlight`.
 *
 * Lives in `components/events/` rather than inside the directory because it is
 * not the directory's private detail: it takes a fixed `CARD_WIDTH_CLASS` and
 * a `sizes` override precisely so a horizontal `.rail` can lay it out without
 * measuring, which is what the event detail page's related-events row will
 * need. Nothing renders it that way yet — today the directory is its only
 * caller, and it passes `w-full` to fill a grid cell instead.
 */

/**
 * The fields a card needs.
 *
 * Structural rather than `EventDoc`, because the directory feeds it `EventDoc`
 * when signed in and the narrower `PublicEvent` projection when signed out.
 */
export type EventCardEvent = Pick<
  EventDoc,
  "id" | "title" | "venue" | "starts_at" | "track" | "capacity"
> & {
  category: string;
  cover_image_url?: string | null;
  tickets_issued?: number | null;
};

/** Fixed width so a rail can lay cards out without measuring them. */
export const CARD_WIDTH_CLASS = "w-[15rem]";

export function EventCard({
  event,
  ticket,
  index = 0,
  className,
  sizes = "15rem",
  onExpand,
}: {
  event: EventCardEvent;
  ticket?: TicketDoc;
  index?: number;
  className?: string;
  sizes?: string;
  /** Expand in place instead of navigating. Omitted means plain navigation. */
  onExpand?: () => void;
}) {
  const { seatsLeft, full, low } = seatState(event);

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
      className={cn(CARD_WIDTH_CLASS, className)}
    >
      <Link
        href={`/events/${event.id}`}
        onClick={(e) => {
          /*
           * Expand in place, but only for a plain left click.
           *
           * Modifier and middle clicks fall through to the real navigation, so
           * "open in new tab" still works and the href stays a genuine link for
           * crawlers and for anyone who prefers a page. Swallowing every click
           * would trade those away for an animation.
           */
          if (!onExpand) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onExpand();
        }}
        className="group block h-full transition-transform duration-150 active:scale-[0.985]"
      >
        {/*
         * `data-theme="obsidian"` because the card is a poster, not a panel.
         *
         * The directory now sits on paper, but a poster is artwork with type
         * set over it — a printed bill pinned to a white wall is still dark.
         * Pinning the scale here keeps `.spotlight`, the chips, the torn foot
         * and the seat states exactly as they were tuned, instead of forcing a
         * scrim designed for a dark ground to also work as ink on white.
         */}
        {/*
          The shared element. This layoutId pairs with the expanded panel in
          event-expand.tsx, so the poster is physically the same element in both
          states and the card reads as opening rather than as a dialog arriving
          on top of it.
        */}
        <motion.div layoutId={`poster-${event.id}`} className="h-full">
        <Stub
          data-theme="obsidian"
          className="flex h-full flex-col overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[color:var(--line-strong)] group-hover:shadow-[0_24px_50px_-24px_#00000059]"
        >
          {/* The poster. `.spotlight` is what keeps the type on it readable
              over an arbitrary photo — see the derivation in globals.css. */}
          <div className="poster spotlight relative shrink-0 bg-ash">
            {event.cover_image_url ? (
              <Image
                src={event.cover_image_url}
                alt=""
                fill
                sizes={sizes}
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
            ) : (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(160deg, var(--maroon) 0%, var(--ash) 55%, var(--ember) 100%)",
                }}
              />
            )}

            {/*
              `chip-on-photo`, not `glass-strong`: these sit above the
              spotlight's transparent top edge, so over a blown-out cover the
              usual white-lift chip would vanish. See globals.css.
            */}
            <div className="absolute inset-x-0 top-0 z-10 flex flex-wrap gap-1.5 p-3">
              <span className="chip-on-photo rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-bone">
                {TRACK_LABELS[event.track] ?? event.track}
              </span>
              <span className="chip-on-photo rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-gold">
                {event.category}
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-10 p-3.5">
              {/*
                Not <FieldLabel>: `.field-label` is unlayered CSS, so its
                bone-faint colour beats any Tailwind text utility passed
                alongside it. Over a photo that is too dim to read, so the
                stub vernacular is reproduced here at bone-dim instead.
              */}
              <span className="block font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-bone-dim tabular">
                {formatMonthAbbr(event.starts_at)} {formatDayNum(event.starts_at)}
                {" · "}
                {formatTime(event.starts_at)}
              </span>

              <h3 className="display mt-1.5 line-clamp-2 text-[1.05rem] leading-tight text-bone">
                {event.title}
              </h3>

              {/*
                The pin inherits bone-dim rather than taking bone-faint like
                icons elsewhere. Measured over a blown-out white cover, the
                scrim leaves bone-faint at 2.31:1 — under the 3:1 floor for
                meaningful non-text content. bone-dim lands at 5.08:1. Icons
                on flat surfaces keep bone-faint; only ones over an arbitrary
                photo need this.
              */}
              <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-bone-dim">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{event.venue}</span>
              </span>
            </div>
          </div>

          {/*
            The torn foot. `stub-notched` with `--at: 0%` puts the punched
            notches on this element's own top edge, so they land on the seam
            whatever the card's width — unlike a fixed `notchAt` on the Stub,
            which would have to be recomputed from the poster's 2:3 height.
          */}
          <div
            className="stub-notched relative mt-auto"
            style={{ ["--at" as string]: "0%" }}
          >
            <Perforation className="mx-3.5" />

            <div className="flex items-center justify-between gap-2 px-3.5 py-3">
              {ticket ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admit">
                  Pass reserved
                </span>
              ) : full ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-refuse">
                  Full
                </span>
              ) : low ? (
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-urgent tabular">
                  <Users className="size-3" />
                  {seatsLeft} left
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-admit">
                  Free entry
                </span>
              )}

              <ArrowUpRight className="size-4 shrink-0 text-bone-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-crimson" />
            </div>
          </div>
        </Stub>
        </motion.div>
      </Link>
    </motion.article>
  );
}
