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

import { SPRING } from "@/lib/motion";
import type { PublicEvent } from "@/lib/events-server";

/**
 * Event posters pinned on the wall behind the headline, at different depths.
 *
 * Deliberately built from the events' own cover art rather than photography.
 * A hero image field is normally the fastest way to make a site look generic,
 * because the images are stock — this one can only ever show real posters for
 * real events on this campus, and it shows nothing at all when there are none.
 *
 * That is the honest failure mode: with no cover art the field does not render,
 * and the hero is exactly the composition it was before. It lights up as
 * organisers upload artwork, and never fakes having any.
 *
 * Mouse-driven, so it does nothing on a phone. It is scenery, never meaning —
 * everything it shows is also in the directory below, as text.
 */

/** Below this the scatter reads as a mistake rather than a wall. */
const MIN_POSTERS = 3;
const MAX_POSTERS = 5;

/**
 * Where each poster sits and how far it drifts.
 *
 * Hand-placed rather than randomised: a random scatter re-rolls on every render
 * and cannot be judged. `depth` drives both the drift distance and the scale,
 * so the near ones move more and sit larger, which is what makes it read as
 * depth rather than as things sliding.
 */
const SLOTS = [
  { top: "6%", left: "4%", w: 150, rotate: -7, depth: 1 },
  { top: "52%", left: "12%", w: 120, rotate: 5, depth: 0.55 },
  { top: "14%", left: "78%", w: 165, rotate: 6, depth: 0.85 },
  { top: "64%", left: "68%", w: 130, rotate: -4, depth: 0.4 },
  { top: "36%", left: "45%", w: 110, rotate: 3, depth: 0.25 },
] as const;

export function PosterField({ events }: { events: PublicEvent[] }) {
  const reduced = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);

  const withArt = events
    .filter((event) => Boolean(event.cover_image_url))
    .slice(0, MAX_POSTERS);

  // The whole component opts out rather than degrading. Two posters floating in
  // a large field looks like something failed to load.
  if (withArt.length < MIN_POSTERS) return null;

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
      {withArt.map((event, i) => (
        <Poster
          key={event.id}
          src={event.cover_image_url!}
          slot={SLOTS[i]}
          px={reduced ? 0 : sx}
          py={reduced ? 0 : sy}
        />
      ))}
    </div>
  );
}

function Poster({
  src,
  slot,
  px,
  py,
}: {
  src: string;
  slot: (typeof SLOTS)[number];
  px: MotionValue<number> | number;
  py: MotionValue<number> | number;
}) {
  // 40px of travel at the nearest depth. Small: this sits behind body copy, and
  // anything that visibly races the cursor pulls the eye off the words.
  const travel = 40 * slot.depth;

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
        // Far posters sit lower and paler, the way things do at distance.
        opacity: 0.1 + slot.depth * 0.14,
      }}
      className="absolute"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-[0_18px_40px_-20px_#1a141633]">
        <Image
          src={src}
          alt=""
          fill
          sizes="170px"
          className="object-cover"
          // Never priority: this is scenery competing with the headline and the
          // featured poster for the same early bandwidth, and it must lose.
          priority={false}
        />
      </div>
    </motion.div>
  );
}
