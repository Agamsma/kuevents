"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

import { SPRING } from "@/lib/motion";

/**
 * The pass as a physical object.
 *
 * CSS 3D transforms, not WebGL — a renderer is ~600KB for one card, and this
 * app's whole argument is that it stays fast on whatever phone a student has.
 *
 * Rotation is driven by pointer position on a desktop and by the device
 * orientation sensor on a phone, because a pass is held, not hovered. Neither
 * input is required: with no pointer and no sensor the card simply sits flat.
 *
 * Capped at 12 degrees. Past roughly 15 the card stops reading as a tilted
 * object and starts reading as a rotating rectangle, and the foil highlight
 * outruns the surface it is meant to be lying on.
 */
const MAX_DEG = 12;

/** Beyond this the phone is being waved, not held; clamping keeps it calm. */
const GYRO_RANGE_DEG = 25;

/**
 * Lifts its children off the card's surface while the card is tilted.
 *
 * The tilt alone rotates a flat picture. What makes a card read as an *object*
 * is parallax between the things printed on it — the title riding higher than
 * the field labels, the QR sitting proud of both. `preserve-3d` on the tilting
 * element is what lets a plain `translateZ` here do that.
 *
 * Depths are small on purpose. Past about 60px the layers visibly detach and
 * the card stops being one thing.
 */
export function PassLayer({
  z = 24,
  className,
  children,
}: {
  /** Height off the card face, in px. Keep under ~60. */
  z?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className={className}
      style={{ transform: reduced ? undefined : `translateZ(${z}px)` }}
    >
      {children}
    </div>
  );
}

export function Tilt({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  // -0.5..0.5 of the card's own box, so the maths is size-independent and the
  // pointer and gyroscope paths can feed the same two values.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rx = useSpring(useTransform(py, [-0.5, 0.5], [MAX_DEG, -MAX_DEG]), SPRING);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-MAX_DEG, MAX_DEG]), SPRING);

  // The highlight travels further than the card rotates, because a reflection
  // on a real surface moves faster than the surface does.
  const sheenX = useTransform(px, [-0.5, 0.5], ["14%", "86%"]);

  useEffect(() => {
    if (reduced || typeof window === "undefined") return;
    if (!("DeviceOrientationEvent" in window)) return;

    /*
     * No permission is requested here.
     *
     * iOS gates the orientation sensor behind `requestPermission()`, which must
     * follow a user gesture and throws a permission prompt. Firing that on page
     * load — for a decorative tilt — is exactly the kind of thing that teaches
     * people to reflexively deny prompts. On platforms that grant the sensor
     * without asking, the pass responds to being held; on iOS it responds to
     * touch instead, which is the same gesture anyway.
     */
    const onOrient = (event: DeviceOrientationEvent) => {
      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      // beta is front-to-back, gamma is left-to-right. Normalised into the same
      // -0.5..0.5 the pointer produces, then clamped.
      const clamp = (v: number) =>
        Math.max(-0.5, Math.min(0.5, v / (GYRO_RANGE_DEG * 2)));

      py.set(clamp(beta - 45)); // 45° is a phone held to read, not lying flat
      px.set(clamp(gamma));
    };

    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [reduced, px, py]);

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;

    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  }

  function rest() {
    px.set(0);
    py.set(0);
  }

  return (
    <div className={className} style={{ perspective: 1300 }}>
      <motion.div
        onPointerMove={onPointerMove}
        onPointerLeave={rest}
        style={{
          rotateX: reduced ? 0 : rx,
          rotateY: reduced ? 0 : ry,
          transformStyle: "preserve-3d",
        }}
        className="relative will-change-transform"
      >
        {children}

        {/*
         * The foil.
         *
         * Not gold. KU Yellow measures 1.34:1 on paper and was dropped from the
         * palette entirely, so a gold foil would be the one colour on the pass
         * that belongs to no scale. This is the flame gradient from the emblem
         * instead — red into orange into a pale highlight — which means the
         * pass catches the light of the crest rather than a colour the crest
         * does not lead with.
         *
         * `soft-light` so it lies on the card rather than painting over it, and
         * `pointer-events-none` so it never eats a tap on the QR beneath.
         */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
          style={{
            backgroundImage:
              "linear-gradient(105deg, transparent 32%, var(--ku-red) 44%, var(--ku-orange) 51%, #fff4e6 55%, transparent 68%)",
            backgroundSize: "260% 100%",
            backgroundPositionX: reduced ? "50%" : sheenX,
            opacity: reduced ? 0 : 0.55,
          }}
        />
      </motion.div>
    </div>
  );
}
