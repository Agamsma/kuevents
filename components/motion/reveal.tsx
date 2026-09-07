"use client";

import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { EASE, REVEAL_DISTANCE, REVEAL_DURATION } from "@/lib/motion";

/**
 * The page's motion vocabulary, in one place.
 *
 * Everything rises a short distance and fades, on a single easing curve, with
 * children staggered. Keeping one curve and one distance across the whole app is
 * what makes the motion feel deliberate rather than decorative — a page where
 * each element has its own animation reads as noise.
 *
 * All of it is disabled by `prefers-reduced-motion` via the global CSS rule.
 */

/**
 * The rise, built once.
 *
 * `Reveal` used to inline a second copy of this that differed only by `delay`,
 * so the curve and the distance were written twice and could drift apart. One
 * factory, both callers.
 */
function rise(delay = 0): Variants {
  return {
    hidden: { opacity: 0, y: REVEAL_DISTANCE },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: REVEAL_DURATION, ease: EASE, delay },
    },
  };
}

export const riseVariants: Variants = rise();

export const staggerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

/** Fades and rises its children in sequence once they enter the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-80px" }}
      variants={rise(delay)}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Reveals a line of text word by word.
 *
 * Used once, on the hero headline. A word-level reveal is expensive attention —
 * spending it anywhere else would make the page feel like it is performing.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(" ");

  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.055, delayChildren: delay } },
      }}
      className={cn("inline", className)}
    >
      {words.map((word, i) => (
        // Each word gets its own clipping mask so the glyphs rise out of it
        // rather than fading in place.
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom"
        >
          <motion.span
            variants={{
              hidden: { y: "110%" },
              visible: { y: "0%", transition: { duration: 0.85, ease: EASE } },
            }}
            className="inline-block"
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
