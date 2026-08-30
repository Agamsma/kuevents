/**
 * Tests for the offline scan decision.
 *
 * This is the logic that decides whether a person walks through the gate, with
 * no network to fall back on and no chance to re-run it. The invariants below
 * are the ones that would embarrass us at a real event:
 *
 *   - one pass admits exactly once, even scanned twice in the same second
 *   - a refusal reports the ORIGINAL admission time, not the time of the retry
 *   - every admission lands in the outbox, exactly once
 *   - a failed upload returns work to the queue rather than dropping it
 *
 * Run with: npm test
 */

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";

import {
  claimPendingScans,
  clearSyncedScans,
  gateDb,
  pendingScanCount,
  purgeEvent,
  recoverStrandedScans,
  releaseScans,
  replaceRoster,
  resolveScan,
  rosterStats,
  type CachedTicket,
  // Explicit .ts extension: this file runs under Node's native type stripping,
  // which resolves as plain ESM and will not guess the extension for us.
} from "./indexeddb.ts";

const EVENT = "evt_techfest";
const SCANNER = "uid_marshal";
const DEVICE = "gate_north";

function ticket(overrides: Partial<CachedTicket> = {}): CachedTicket {
  return {
    qr_hash: "a".repeat(64),
    ticket_id: "tkt_1",
    event_id: EVENT,
    user_name: "Aarav Shah",
    user_email: "aarav@karnavatiuniversity.edu.in",
    seat_label: null,
    status: "issued",
    checked_in: 0,
    check_in_time: null,
    ...overrides,
  };
}

async function seed(tickets: CachedTicket[]) {
  await replaceRoster(EVENT, tickets, {
    event_id: EVENT,
    event_title: "Techfest",
    event_venue: "Main Auditorium",
    downloaded_at: Date.now(),
  });
}

function scan(qrHash: string, now?: number) {
  return resolveScan({
    qrHash,
    eventId: EVENT,
    scannedBy: SCANNER,
    deviceId: DEVICE,
    now,
  });
}

beforeEach(async () => {
  await gateDb.cached_tickets.clear();
  await gateDb.sync_queue.clear();
  await gateDb.roster_meta.clear();
});

after(() => gateDb.close());

describe("resolveScan", () => {
  test("admits a valid pass and queues it for upload", async () => {
    await seed([ticket()]);

    const result = await scan("a".repeat(64), 1_700_000_000_000);

    assert.equal(result.kind, "admitted");
    assert.equal(await pendingScanCount(), 1);

    const [queued] = await gateDb.sync_queue.toArray();
    assert.equal(queued.ticket_id, "tkt_1");
    assert.equal(queued.check_in_time, 1_700_000_000_000);
    assert.equal(queued.scanned_by, SCANNER);
    assert.equal(queued.device_id, DEVICE);
  });

  test("refuses the second scan and reports the first admission time", async () => {
    await seed([ticket()]);

    const first = await scan("a".repeat(64), 1_700_000_000_000);
    const second = await scan("a".repeat(64), 1_700_000_060_000);

    assert.equal(first.kind, "admitted");
    assert.equal(second.kind, "duplicate");

    assert.equal(
      second.kind === "duplicate" ? second.originalCheckIn : null,
      1_700_000_000_000,
      "the refusal must show when they actually came in, not when they retried",
    );

    // Critically: no second entry in the outbox.
    assert.equal(await pendingScanCount(), 1);
  });

  test("two scans of the same pass in flight do not both admit", async () => {
    await seed([ticket()]);

    const results = await Promise.all([
      scan("a".repeat(64)),
      scan("a".repeat(64)),
    ]);

    const admitted = results.filter((r) => r.kind === "admitted");
    assert.equal(admitted.length, 1, "exactly one scan may win");
    assert.equal(await pendingScanCount(), 1);
  });

  test("rejects an unknown code without touching the queue", async () => {
    await seed([ticket()]);

    const result = await scan("b".repeat(64));

    assert.equal(result.kind, "not_found");
    assert.equal(await pendingScanCount(), 0);
  });

  test("rejects a cancelled pass", async () => {
    await seed([ticket({ status: "cancelled" })]);

    const result = await scan("a".repeat(64));

    assert.equal(result.kind, "cancelled");
    assert.equal(await pendingScanCount(), 0);
  });

  test("rejects a valid pass issued for a different event", async () => {
    await gateDb.cached_tickets.put(ticket({ event_id: "evt_other" }));

    const result = await scan("a".repeat(64));

    assert.equal(result.kind, "wrong_event");
    assert.equal(await pendingScanCount(), 0);
  });

  test("honours a check-in already recorded upstream", async () => {
    // A second gate phone downloading a roster mid-event must not re-admit
    // people the first phone already let through.
    await seed([ticket({ checked_in: 1, check_in_time: 1_699_999_000_000 })]);

    const result = await scan("a".repeat(64));

    assert.equal(result.kind, "duplicate");
    assert.equal(await pendingScanCount(), 0);
  });
});

describe("roster counters", () => {
  test("counts admitted against issued", async () => {
    await seed([
      ticket({ qr_hash: "a".repeat(64), ticket_id: "tkt_1" }),
      ticket({ qr_hash: "b".repeat(64), ticket_id: "tkt_2" }),
      ticket({ qr_hash: "c".repeat(64), ticket_id: "tkt_3" }),
    ]);

    assert.deepEqual(await rosterStats(EVENT), { total: 3, checkedIn: 0 });

    await scan("a".repeat(64));
    await scan("b".repeat(64));

    assert.deepEqual(
      await rosterStats(EVENT),
      { total: 3, checkedIn: 2 },
      "the compound index must actually see admitted rows",
    );
  });

  test("re-downloading a roster replaces it rather than duplicating", async () => {
    await seed([ticket()]);
    await seed([ticket(), ticket({ qr_hash: "b".repeat(64), ticket_id: "tkt_2" })]);

    assert.equal((await rosterStats(EVENT)).total, 2);
  });
});

describe("outbox", () => {
  test("a claimed batch is not handed out twice", async () => {
    await seed([
      ticket({ qr_hash: "a".repeat(64), ticket_id: "tkt_1" }),
      ticket({ qr_hash: "b".repeat(64), ticket_id: "tkt_2" }),
    ]);
    await scan("a".repeat(64));
    await scan("b".repeat(64));

    const first = await claimPendingScans();
    const second = await claimPendingScans();

    assert.equal(first.length, 2);
    assert.equal(second.length, 0, "in-flight scans must not be re-claimed");
  });

  test("a failed upload returns work to the queue with an attempt recorded", async () => {
    await seed([ticket()]);
    await scan("a".repeat(64));

    const batch = await claimPendingScans();
    await releaseScans(batch.map((s) => s.id!));

    const retry = await claimPendingScans();
    assert.equal(retry.length, 1, "a failed batch must be retried, never dropped");
    assert.equal(retry[0].attempts, 1);
  });

  test("scans stranded in-flight by a crash are reclaimed, not lost", async () => {
    await seed([ticket()]);
    await scan("a".repeat(64));

    // Simulates the tab dying between claiming a batch and the upload
    // returning: the rows stay marked in-flight with nobody to release them.
    await claimPendingScans();
    assert.equal((await claimPendingScans()).length, 0);

    const recovered = await recoverStrandedScans();

    assert.equal(recovered, 1);
    assert.equal(
      (await claimPendingScans()).length,
      1,
      "a check-in stranded by a crash must still reach the server",
    );
  });

  test("a confirmed upload leaves the queue empty", async () => {
    await seed([ticket()]);
    await scan("a".repeat(64));

    const batch = await claimPendingScans();
    await clearSyncedScans(batch.map((s) => s.id!));

    assert.equal(await pendingScanCount(), 0);
  });

  test("purging an event clears its roster and its pending scans", async () => {
    await seed([ticket()]);
    await scan("a".repeat(64));

    await purgeEvent(EVENT);

    assert.equal(await pendingScanCount(), 0);
    assert.equal((await rosterStats(EVENT)).total, 0);
    assert.equal(await gateDb.roster_meta.get(EVENT), undefined);
  });
});
