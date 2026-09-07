import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EASE,
  PRESS_SCALE,
  REVEAL_DISTANCE,
  REVEAL_DURATION,
  SPRING,
} from "./motion.ts";

describe("motion primitives", () => {
  it("exposes one spring for every interaction in the product", () => {
    // One curve everywhere is the rule the design system rests on. A second
    // spring is how an interface starts feeling assembled rather than designed.
    assert.deepEqual({ ...SPRING }, {
      type: "spring",
      stiffness: 220,
      damping: 26,
    });
  });

  it("keeps the press compression subtle", () => {
    // Below ~0.95 a press reads as a bounce rather than as pressure.
    assert.ok(PRESS_SCALE >= 0.95 && PRESS_SCALE < 1);
  });

  it("keeps the reveal distance short", () => {
    // Long travel is the tell of a template. This is a nudge, not an entrance.
    assert.ok(REVEAL_DISTANCE > 0 && REVEAL_DISTANCE <= 24);
  });

  it("uses a tween for reveals, not the spring", () => {
    // Deliberate split: a scroll reveal wants a known duration so a staggered
    // sequence stays in step, while an interaction wants physics that respond
    // to how it was triggered. One value for both would compromise each.
    assert.equal(EASE.length, 4);
    assert.ok(EASE.every((n) => typeof n === "number"));
    assert.ok(REVEAL_DURATION > 0 && REVEAL_DURATION <= 1);
  });
});
