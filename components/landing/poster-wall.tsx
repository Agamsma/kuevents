"use client";

import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { formatDayNum, formatMonthAbbr } from "@/lib/format";
import { SPRING } from "@/lib/motion";
import { TRACK_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { PublicEvent } from "@/lib/events-server";

/**
 * The noticeboard.
 *
 * The real artifact of campus events is not a poster — it is the board outside
 * a building where every club staples its bill over the last one, overlapping,
 * crooked, three deep by Thursday. That is what the hero is: a pasted wall, with
 * the page's own notice pinned over it.
 *
 * ── Why this replaced PosterField ──────────────────────────────────────────
 *
 * The old field rendered NOTHING until at least three events carried cover art,
 * on the reasoning that a sparse scatter looks broken and stock photography
 * looks generic. Both true. But the consequence was that a campus which had not
 * uploaded any artwork got a hero of text on blank off-white — which is the
 * state a new deployment is always in, and the state this one was in.
 *
 * A poster-led hero with no posters is worse than the text hero it replaced. So
 * the wall never opts out. It shows artwork where an event has artwork, and
 * sets the event in type where it does not — the same thing a club does when it
 * has no designer: writes the name of the thing on a sheet of paper and pins it
 * up. Nothing is ever invented, nothing is ever stock, and the board is never
 * empty while there is a single event on.
 *
 * Scenery, never meaning: everything here is also in the directory below as
 * text, and the whole wall is aria-hidden.
 */

/** How far a bill drifts with the cursor, at the nearest depth. */
const TRAVEL = 34;

interface Slot {
  top: string;
  left: string;
  /** Width in px at the widest breakpoint. Scaled down on smaller screens. */
  w: number;
  rotate: number;
  /** 0 = far wall, 1 = pinned on top. Drives drift, scale and how pale it is. */
  depth: number;
  /** Far bills are dropped on narrow screens rather than crowding the notice. */
  hideOnSmall?: boolean;
}

/*
 * Hand-placed, never randomised.
 *
 * A random scatter re-rolls every render and cannot be judged or corrected. It
 * also cannot be told to leave a hole where the notice sits — and the notice is
 * the thing the page is for.
 *
 * The arrangement reads left-heavy and top-weighted because that is where a
 * board fills first, and it deliberately leaves the lower-centre thinner: the
 * notice panel lands there and bills behind it would only ever be seen as edges.
 */
const SLOTS: Slot[] = [
  // The right half, which is the half the notice leaves free on a wide screen.
  { top: "4%", left: "57%", w: 146, rotate: -5, depth: 0.62 },
  /*
   * These two sit far enough right that on a phone they are more off the
   * screen than on it.
   *
   * A bill running past the edge is the point — the board continues, it is not
   * an arrangement inside a frame. But at 390px, `left: 77%` starts at 300px
   * and runs 170 wide, so what a visitor actually sees is a title sliced
   * through the middle of a word ("National … Court Rou"). Half a headline
   * reads as text overflowing its container, which is the opposite of the
   * deliberate impression the bleed is there to create.
   *
   * Hidden below `lg` rather than below `sm`: the same arithmetic still bleeds
   * them badly at tablet widths.
   */
  { top: "-3%", left: "77%", w: 170, rotate: 4, depth: 0.95, hideOnSmall: true },
  { top: "34%", left: "64%", w: 128, rotate: 7, depth: 0.45, hideOnSmall: true },
  { top: "42%", left: "85%", w: 158, rotate: -3, depth: 0.82, hideOnSmall: true },
  { top: "66%", left: "72%", w: 142, rotate: 6, depth: 0.7 },
  // Two peeking past the left edge, so the board reads as continuing off-screen
  // rather than as a decoration arranged inside the frame.
  { top: "8%", left: "-6%", w: 150, rotate: 6, depth: 0.55, hideOnSmall: true },
  { top: "62%", left: "-4%", w: 126, rotate: -7, depth: 0.35, hideOnSmall: true },
];

export function PosterWall({ events }: { events: PublicEvent[] }) {
  const reduced = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);

  const bills = events.slice(0, SLOTS.length);

  // One event is not a wall, it is a stray sheet. Below two the hero carries
  // itself on type alone, which it is built to do.
  if (bills.length < 2) return null;

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse") return;

    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  }

  return (
    <div
      aria-hidden
      onPointerMove={onPointerMove}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
      }}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {bills.map((event, i) => (
        <Bill
          key={event.id}
          event={event}
          slot={SLOTS[i]}
          px={reduced ? 0 : sx}
          py={reduced ? 0 : sy}
        />
      ))}

      {/*
        A soft settling of the paper ground back over the board, tightest where
        the notice sits.

        Deliberately weak. The notice is opaque white with its own shadow, so it
        does not need help to be read — this only stops a bill's hard edge
        colliding with the card's edge and reading as one shape. An earlier,
        much stronger version was doing the legibility job the card was already
        doing, and paid for it by greying out the whole board.
      */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 55% at 30% 50%, color-mix(in oklch, var(--paper) 80%, transparent) 0%, color-mix(in oklch, var(--paper) 30%, transparent) 55%, transparent 78%)",
        }}
      />
    </div>
  );
}

function Bill({
  event,
  slot,
  px,
  py,
}: {
  event: PublicEvent;
  slot: Slot;
  px: MotionValue<number> | number;
  py: MotionValue<number> | number;
}) {
  const travel = TRAVEL * slot.depth;

  const x = useTransform(() => (typeof px === "number" ? 0 : px.get() * travel));
  const y = useTransform(() => (typeof py === "number" ? 0 : py.get() * travel));

  return (
    <motion.div
      style={{
        x,
        y,
        top: slot.top,
        left: slot.left,
        width: slot.w,
        rotate: slot.rotate,
        // Far bills sit paler, the way paper does at distance and under other
        // paper. The floor is high on purpose: the first pass ran 0.34–0.76
        // and, with the wash below also subtracting, the board read as a smudge
        // — which is the failure it was built to fix. A bill nobody can see is
        // a request the browser made for nothing.
        opacity: 0.62 + slot.depth * 0.33,
      }}
      className={cn(
        "absolute origin-center",
        slot.hideOnSmall && "hidden lg:block",
      )}
    >
      {/*
        The paste. A bill on a board has a hard edge and a contact shadow, not a
        glow — it is a sheet of paper lying on another sheet of paper.
      */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[3px] shadow-[0_1px_2px_#1a141618,0_16px_36px_-22px_#1a141633]">
        {event.cover_image_url ? (
          <Image
            src={event.cover_image_url}
            alt=""
            fill
            sizes="180px"
            className="object-cover"
            // Never priority. This is scenery, and it competes with the
            // headline for the same early bandwidth — it must lose.
            priority={false}
          />
        ) : (
          <TypesetBill event={event} />
        )}
      </div>
    </motion.div>
  );
}

/**
 * An event with no cover art, set as a printed handbill.
 *
 * This is the half that keeps the board full. It is not a placeholder standing
 * in for a missing image — it is the other real thing a club pins up, which is
 * the event's name in type on a sheet. Every word on it comes from the event.
 *
 * Scaled in `em` off a container-relative font size so one component serves a
 * 116px bill and a 176px one without a second set of sizes.
 */
function TypesetBill({ event }: { event: PublicEvent }) {
  return (
    <div
      className="flex size-full flex-col justify-between bg-paper-raised p-[0.9em] text-[10px] ring-1 ring-inset ring-[color:var(--line-strong)]"
      style={{ fontSize: "clamp(8px, 0.62em, 11px)" }}
    >
      <div className="font-mono text-[0.85em] uppercase tracking-[0.16em] text-ink-soft">
        {TRACK_LABELS[event.track] ?? event.track}
      </div>

      <div className="display line-clamp-4 text-[1.9em] leading-[1.06] text-ink">
        {event.title}
      </div>

      <div>
        {/* The tear line, at bill scale. The same rule the passes carry. */}
        <div className="tear mb-[0.7em]" />
        <div className="flex items-baseline gap-[0.5em] font-mono text-[0.85em] uppercase tracking-[0.12em] text-ink-dim">
          <span className="text-[1.5em] tracking-normal text-ink">
            {formatDayNum(event.starts_at)}
          </span>
          <span>{formatMonthAbbr(event.starts_at)}</span>
        </div>
      </div>
    </div>
  );
}
