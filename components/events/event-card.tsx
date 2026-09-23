"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Users } from "lucide-react";

import { formatDayNum, formatMonthAbbr, formatTime } from "@/lib/format";
import { seatState } from "@/lib/seats";
import { cn } from "@/lib/utils";
import {
  categoryLabel,
  TRACK_LABELS,
  type EventDoc,
  type TicketDoc,
} from "@/lib/types";
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
  /** The written label, when category is "Other". */
  category_other?: string | null;
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
  const hasArt = Boolean(event.cover_image_url);

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
          The shared element. This layoutId pairs with the expanded panel in
          event-expand.tsx, so the poster is physically the same element in both
          states and the card reads as opening rather than as a dialog arriving
          on top of it.
        */}
        <motion.div layoutId={`poster-${event.id}`} className="h-full">
        <Stub
          /*
           * The scale follows the artwork, and only the artwork.
           *
           * A card WITH a cover is a poster — artwork with type set over it —
           * and a printed bill pinned to a white wall is still dark, so it
           * keeps the obsidian scale that `.spotlight` and `chip-on-photo` were
           * tuned against.
           *
           * A card WITHOUT one used to get the same dark treatment, filled with
           * a maroon-to-ember gradient standing in for the missing image. On
           * the paper directory that rendered as a near-black rectangle, and
           * four of them in a row read as something failing to load rather than
           * as a design. It is the same failure the hero had, for the same
           * reason: dressing up "no artwork" as artwork.
           *
           * So it stops pretending. No cover means the card is a printed bill —
           * ink on paper, the event's own words doing the work — which is the
           * other real object this product is made of, and exactly what the
           * hero's board does. Omitting the attribute inherits the page's
           * scale, and every colour below is an alias, so both branches resolve
           * correctly without a second set of tokens.
           */
          data-theme={hasArt ? "obsidian" : undefined}
          className="flex h-full flex-col overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[color:var(--line-strong)] group-hover:shadow-[0_24px_50px_-24px_#0000003d]"
        >
          {hasArt ? (
            /* `.spotlight` is what keeps the type on an arbitrary photo
               readable — see the derivation in globals.css. */
            <div className="poster spotlight relative shrink-0 bg-ash">
              <Image
                src={event.cover_image_url!}
                alt=""
                fill
                sizes={sizes}
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />

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
                  {categoryLabel(event)}
                </span>
              </div>

              <div className="absolute inset-x-0 bottom-0 z-10 p-3.5">
                {/*
                  Not <FieldLabel>: `.field-label` is unlayered CSS, so its
                  colour beats any Tailwind text utility passed alongside it.
                  Over a photo that is too dim to read, so the stub vernacular
                  is reproduced here at bone-dim instead.
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
                  The pin inherits bone-dim rather than bone-faint like icons
                  elsewhere. Measured over a blown-out white cover, the scrim
                  leaves bone-faint at 2.31:1 — under the 3:1 floor for
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
          ) : (
            /*
              The printed bill.

              It used to carry `.poster` too — the same locked 2:3 block as the
              artwork variant — so that a mixed row could not step up and down.
              The evenness was worth keeping; the fixed height was not. A 2:3
              block holding three short groups of text is mostly empty, and
              since no event on the directory currently has a cover, EVERY card
              was that empty block.

              `flex-1` gets the evenness without the emptiness. In a mixed row
              the grid stretches each cell to the tallest card and this block
              grows to fill it, so a bill beside a poster still lines up. In a
              row of nothing but bills there is no poster setting the height, so
              the row collapses to the content — which is the common case, and
              the one that looked broken.

              No scrim and no image, so every value is an alias resolving
              against the page's own scale. The chips become ruled outlines
              rather than `chip-on-photo`, which is a dark lift designed to
              survive a blown-out photograph and would be a grey smear here.
            */
            /*
              The height floor starts at the two-column breakpoint, not on a
              phone. It exists so a narrow card with a three-word title does
              not collapse into something stubbier than its neighbours. A
              full-width card has no such problem — its title fits on one line,
              so on a phone the floor only reopened the gap this variant was
              rewritten to close.
            */
            <div className="relative flex flex-1 flex-col bg-paper-raised p-3.5 min-[30rem]:min-h-[13rem]">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-[color:var(--line-strong)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {TRACK_LABELS[event.track] ?? event.track}
                </span>
                <span className="rounded-full border border-[color:var(--line-strong)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {categoryLabel(event)}
                </span>
              </div>

              {/*
                The title runs large here, unlike on a poster where it shares
                the frame with a photograph. With nothing else in the block it
                is the artwork, and setting it at poster size is the whole point
                of the variant.

                It sits directly under the chips now. It used to be centred by
                `justify-between` across a locked 2:3 block, which — with only
                three small groups to distribute — opened a void above the title
                AND another below it. Six of those in a grid read as artwork
                failing to load, which is the exact impression the variant was
                written to avoid.
              */}
              <h3 className="display mt-3.5 line-clamp-4 text-[1.45rem] leading-[1.08] text-foreground">
                {event.title}
              </h3>

              {/*
                `mt-auto` leaves ONE controlled gap, at the bottom, instead of
                two arbitrary ones.
              */}
              <div className="mt-auto pt-6">
                <span className="block font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-subtle-foreground tabular">
                  {formatMonthAbbr(event.starts_at)} {formatDayNum(event.starts_at)}
                  {" · "}
                  {formatTime(event.starts_at)}
                </span>

                <span className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{event.venue}</span>
                </span>
              </div>
            </div>
          )}

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

              {/*
                Alias, not `text-bone-faint`, and `--primary` on hover rather
                than `--crimson`: the foot now renders on either scale, and
                crimson is the obsidian lift of KU Red that paper does not use —
                on paper `--primary` is the university's actual #C02722.
              */}
              <ArrowUpRight className="size-4 shrink-0 text-subtle-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[color:var(--primary)]" />
            </div>
          </div>
        </Stub>
        </motion.div>
      </Link>
    </motion.article>
  );
}
