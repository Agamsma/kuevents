"use client";

import { MotionConfig } from "framer-motion";

/**
 * Makes framer-motion respect `prefers-reduced-motion`.
 *
 * The global CSS rule in globals.css only neutralises CSS animations —
 * framer-motion animates in JavaScript, so every reveal, layout transition and
 * shared-element pill in the app was ignoring the setting entirely.
 *
 * `reducedMotion="user"` keeps opacity fades (which do not trigger vestibular
 * symptoms) and drops transforms — movement and scale — which are the ones that
 * do. That is the behaviour the setting is actually asking for; disabling
 * animation wholesale tends to make interfaces feel broken rather than calm.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
