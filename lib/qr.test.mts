import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier. `qr.ts` has no runtime imports for that reason.
import { buildQrPayload, parseQrPayload, liveWindowCode, LIVE_WINDOW_MS } from "./qr.ts";

const HASH = "a1b2c3d4".repeat(8); // 64 hex chars, the shape computeQrHash emits

describe("ticket QR payloads", () => {
  /*
   * The one that matters: whatever the pass renders, the gate must read.
   *
   * These two functions were only ever exercised separately — the pass called
   * `buildQrPayload`, the scanner called `parseQrPayload`, and nothing checked
   * that the second could read the first. It could not: `parseQrPayload`
   * lowercases its input before matching a pattern built from the uppercase
   * `KUE1` prefix, so every prefixed pass came back `null` and was refused at
   * the gate as "Not a pass". Only the bare-hash fallback still worked, which
   * is why the failure looked like a bad QR rather than a bad parser.
   */
  it("reads back a payload it just built", () => {
    assert.equal(parseQrPayload(buildQrPayload(HASH)), HASH);
  });

  it("still reads a bare hash, so passes issued before the prefix scan", () => {
    assert.equal(parseQrPayload(HASH), HASH);
  });

  it("tolerates whitespace and case from the decoder", () => {
    // Some QR decoders hand back the payload upper-cased or padded; the hash
    // itself is lowercase hex, so casing must not decide whether a pass scans.
    assert.equal(parseQrPayload(`  ${buildQrPayload(HASH)}  `), HASH);
    assert.equal(parseQrPayload(buildQrPayload(HASH).toUpperCase()), HASH);
  });

  it("refuses codes that are not ours", () => {
    // Each of these must read as "Not a pass" rather than reaching the roster.
    assert.equal(parseQrPayload("https://example.com"), null);
    assert.equal(parseQrPayload(""), null);
    assert.equal(parseQrPayload("KUE1:"), null);
    assert.equal(parseQrPayload(`KUE2:${HASH}`), null);
    assert.equal(parseQrPayload(HASH.slice(0, 63)), null, "63 chars is not a hash");
    assert.equal(parseQrPayload(`${HASH}f`), null, "65 chars is not a hash");
    assert.equal(parseQrPayload(`KUE1:${"z".repeat(64)}`), null, "not hex");
  });
});

describe("live window code", () => {
  it("is stable inside a window and rolls at the boundary", () => {
    const base = 1_700_000_000_000;
    const start = base - (base % LIVE_WINDOW_MS);

    assert.equal(liveWindowCode(HASH, start), liveWindowCode(HASH, start + LIVE_WINDOW_MS - 1));
    assert.notEqual(liveWindowCode(HASH, start), liveWindowCode(HASH, start + LIVE_WINDOW_MS));
  });

  it("is always six characters, so the badge never reflows", () => {
    for (let i = 0; i < 200; i += 1) {
      assert.equal(liveWindowCode(HASH, i * LIVE_WINDOW_MS).length, 6);
    }
  });
});
