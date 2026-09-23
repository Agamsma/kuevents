import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier.
import { canRelease } from "./ticket-release.ts";

const NOW = 1_700_000_000_000;
const OWNER = "uid_owner";

const ticket = (over: Partial<Parameters<typeof canRelease>[0]["ticket"]> = {}) => ({
  user_id: OWNER,
  status: "issued" as const,
  checked_in: false,
  ...over,
});

/** An event still to come. */
const upcoming = { ends_at: NOW + 60 * 60 * 1000 };
/** One that finished an hour ago. */
const finished = { ends_at: NOW - 60 * 60 * 1000 };

describe("canRelease", () => {
  it("lets a holder give back an unused pass for an upcoming event", () => {
    const result = canRelease({
      ticket: ticket(),
      event: upcoming,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, true);
  });

  it("reports someone else's pass as missing, not as forbidden", () => {
    // A 403 would confirm the id exists. firestore.rules will not let you read
    // another holder's ticket, and this endpoint must not be looser.
    const result = canRelease({
      ticket: ticket(),
      event: upcoming,
      callerUid: "uid_someone_else",
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 404);
    assert.equal(result.ok === false && result.refusal.message, "No such pass.");
  });

  it("refuses a pass that is already released", () => {
    // The guard that stops a double release decrementing tickets_issued twice
    // and handing the venue back a seat it never lost.
    const result = canRelease({
      ticket: ticket({ status: "cancelled" }),
      event: upcoming,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 409);
  });

  it("refuses a refunded pass too", () => {
    const result = canRelease({
      ticket: ticket({ status: "refunded" }),
      event: upcoming,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, false);
  });

  it("refuses a pass that already got someone through the gate", () => {
    const result = canRelease({
      ticket: ticket({ checked_in: true }),
      event: upcoming,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.equal(
      result.ok === false && result.refusal.message,
      "This pass has already been used at the gate.",
    );
  });

  it("refuses once the event is over, so a finished count cannot move", () => {
    const result = canRelease({
      ticket: ticket(),
      event: finished,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 409);
  });

  it("treats a missing event as finished rather than erroring", () => {
    const result = canRelease({
      ticket: ticket(),
      event: null,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, false);
  });

  it("checks ownership before anything else", () => {
    // A stranger poking at a checked-in, already-cancelled ticket should learn
    // only that it is not theirs — the other refusals leak its state.
    const result = canRelease({
      ticket: ticket({ status: "cancelled", checked_in: true }),
      event: finished,
      callerUid: "uid_someone_else",
      now: NOW,
    });
    assert.equal(result.ok === false && result.refusal.message, "No such pass.");
  });

  it("still allows release while the event is running but before scanning in", () => {
    // Someone who decides on the way that they cannot make it should free the
    // seat, right up until they actually walk through the gate.
    const running = { ends_at: NOW + 1 };
    const result = canRelease({
      ticket: ticket(),
      event: running,
      callerUid: OWNER,
      now: NOW,
    });
    assert.equal(result.ok, true);
  });
});
