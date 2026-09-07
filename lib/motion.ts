/**
 * One vocabulary of movement, for the entire product.
 *
 * Motion is the fastest way an interface starts to feel assembled rather than
 * designed: a second easing curve appears for one component, then a third, and
 * nothing shares a physics any more. These are the only values, and every
 * animated surface imports them.
 *
 * Two vocabularies, deliberately — not one:
 *
 *   Reveals use a TWEEN. A staggered sequence needs a known duration to stay in
 *   step; a spring finishes when its physics say so, and a row of cards on
 *   springs arrives ragged.
 *
 *   Interactions use a SPRING. A press, a drag or a shared-element transition
 *   should respond to how it was triggered, which a fixed duration cannot do.
 *
 * No React or framer-motion import here, so the values stay assertable under
 * plain `node --test`.
 */

/** The only spring. Firm enough to feel responsive, damped enough not to wobble. */
export const SPRING = {
  type: "spring",
  stiffness: 220,
  damping: 26,
} as const;

/** How far a pressable element compresses while held. */
export const PRESS_SCALE = 0.98;

/** The reveal curve — a fast out, a long settle. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** How long a reveal takes, in seconds. */
export const REVEAL_DURATION = 0.7;

/** How far a revealing element travels, in pixels. A nudge, not an entrance. */
export const REVEAL_DISTANCE = 14;
