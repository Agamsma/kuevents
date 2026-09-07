"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

import { SPRING } from "@/lib/motion";

/**
 * Pulls its child a little way toward the cursor.
 *
 * Used on exactly one element — the landing page's primary action. A magnetic
 * effect works by being the only thing on the page that behaves that way; a
 * page where several things lean toward the pointer feels unstable rather than
 * responsive.
 *
 * Deliberately not a button itself. It wraps whatever it is given, so the child
 * keeps its own semantics, focus ring and keyboard behaviour — a wrapper that
 * swallowed those would trade accessibility for a flourish.
 *
 * Pointer-only by nature: there is no cursor on a phone, so on the device most
 * students use this simply does nothing, which is why it stays a small polish
 * item and never carries meaning.
 */
export function Magnetic({
  children,
  /** How far the child may travel from rest, in px. */
  strength = 10,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const sx = useSpring(x, SPRING);
  const sy = useSpring(y, SPRING);

  function onPointerMove(event: React.PointerEvent<HTMLSpanElement>) {
    // Fine pointers only. A touch drag would otherwise drag the button away
    // from the finger that is trying to press it.
    if (reduced || event.pointerType !== "mouse") return;

    const box = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - (box.left + box.width / 2)) / (box.width / 2);
    const dy = (event.clientY - (box.top + box.height / 2)) / (box.height / 2);

    // Clamped so a cursor approaching from far outside the box cannot fling it.
    x.set(Math.max(-1, Math.min(1, dx)) * strength);
    y.set(Math.max(-1, Math.min(1, dy)) * strength);
  }

  function rest() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={rest}
      // Blur as well as leave: tabbing away must return it to rest, or a
      // keyboard user can leave it stranded off-centre.
      onBlur={rest}
      style={{ x: reduced ? 0 : sx, y: reduced ? 0 : sy }}
      className={className}
    >
      {children}
    </motion.span>
  );
}
