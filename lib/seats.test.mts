import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier. `seats.ts` has no runtime imports for that reason.
import { LOW_SEATS_THRESHOLD, seatState } from "./seats.ts";

const event = (capacity: number, issued?: number | null) =>
  ({ capacity, tickets_issued: issued }) as Parameters<typeof seatState>[0];

describe("seat state", () => {
  it("reports what is left on a normal event", () => {
    assert.deepEqual(seatState(event(200, 40)), {
      seatsLeft: 160,
      full: false,
      low: false,
    });
  });

  it("treats an event with no capacity as uncapped, not sold out", () => {
    // capacity 0 means nobody ever configured a limit. Calling that "full"
    // would hide the event behind a refusal it never earned.
    assert.deepEqual(seatState(event(0, 0)), {
      seatsLeft: null,
      full: false,
      low: false,
    });
  });

  it("is full at exactly zero remaining", () => {
    const state = seatState(event(50, 50));
    assert.equal(state.seatsLeft, 0);
    assert.equal(state.full, true);
    assert.equal(state.low, false, "full is never also low");
  });

  it("never reports negative seats when an event is oversold", () => {
    // The booking transaction is what prevents overselling, but a stale read
    // here must not render "-3 left".
    const state = seatState(event(50, 53));
    assert.equal(state.seatsLeft, 0);
    assert.equal(state.full, true);
  });

  it("treats a missing tickets_issued as zero", () => {
    assert.equal(seatState(event(80, null)).seatsLeft, 80);
    assert.equal(seatState(event(80, undefined)).seatsLeft, 80);
  });
});

describe("the low-seats threshold", () => {
  it("is low at the threshold and not one above it", () => {
    const atThreshold = seatState(event(100, 100 - LOW_SEATS_THRESHOLD));
    assert.equal(atThreshold.seatsLeft, LOW_SEATS_THRESHOLD);
    assert.equal(atThreshold.low, true, "at the threshold counts as low");

    const justOver = seatState(event(100, 100 - LOW_SEATS_THRESHOLD - 1));
    assert.equal(justOver.seatsLeft, LOW_SEATS_THRESHOLD + 1);
    assert.equal(justOver.low, false, "one above the threshold is ordinary");
  });

  it("is low with a single seat left", () => {
    assert.equal(seatState(event(100, 99)).low, true);
  });

  it("is never low on an uncapped event", () => {
    // No capacity means no scarcity to report — `--urgent` must not appear on
    // an event that simply has no limit set.
    assert.equal(seatState(event(0, 5000)).low, false);
  });
});
