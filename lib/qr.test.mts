import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier. `qr.ts` has no runtime imports for that reason.
import {
  buildQrPayload,
  buildRotatingPayload,
  isRotatingCodeCurrent,
  liveWindowCode,
  LIVE_WINDOW_MS,
  parseQrPayload,
  parseRotatingPayload,
  rotatingCode,
  windowIndex,
} from "./qr.ts";

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

describe("rotating passes", () => {
  const SECRET = "s3cr3t-per-ticket-value";
  const T0 = 1_800_000_000_000; // an exact window boundary

  it("reads back a rotating payload it just built", () => {
    const payload = buildRotatingPayload(HASH, SECRET, T0);
    const parsed = parseRotatingPayload(payload);

    assert.ok(parsed);
    assert.equal(parsed!.qrHash, HASH);
    assert.equal(parsed!.window, windowIndex(T0));
  });

  it("accepts a code inside the tolerance window", () => {
    const payload = parseRotatingPayload(buildRotatingPayload(HASH, SECRET, T0))!;

    // Rendered now, scanned now.
    assert.equal(isRotatingCodeCurrent(payload, SECRET, T0), true);
    // Rendered a window ago — a marshal's clock running slightly behind.
    assert.equal(
      isRotatingCodeCurrent(payload, SECRET, T0 + LIVE_WINDOW_MS),
      true,
    );
    // And ahead, which is the same drift in the other direction.
    assert.equal(
      isRotatingCodeCurrent(payload, SECRET, T0 - LIVE_WINDOW_MS),
      true,
    );
  });

  it("refuses a screenshot taken two windows ago", () => {
    // The whole point. A captured pass stops scanning about a minute later.
    const payload = parseRotatingPayload(buildRotatingPayload(HASH, SECRET, T0))!;

    assert.equal(
      isRotatingCodeCurrent(payload, SECRET, T0 + LIVE_WINDOW_MS * 2),
      false,
    );
    assert.equal(
      isRotatingCodeCurrent(payload, SECRET, T0 + LIVE_WINDOW_MS * 20),
      false,
    );
  });

  it("cannot be forged from the QR alone", () => {
    /*
     * The security property this feature rests on. Everything inside the
     * payload is public — the hash, the window, the code. If someone who
     * photographed a pass could mint a fresh code from that, rotation would be
     * theatre. Only the secret, which is never in the QR, produces valid codes.
     */
    const stolen = parseRotatingPayload(buildRotatingPayload(HASH, SECRET, T0))!;
    const laterWindow = { ...stolen, window: stolen.window + 5 };

    // Derived from what a thief can see: the hash itself.
    const forged = {
      ...laterWindow,
      code: rotatingCode(stolen.qrHash, laterWindow.window),
    };

    assert.equal(
      isRotatingCodeCurrent(forged, SECRET, T0 + LIVE_WINDOW_MS * 5),
      false,
      "a code derived from the public hash must not verify",
    );
  });

  it("gives different tickets different codes in the same window", () => {
    assert.notEqual(
      rotatingCode(SECRET, windowIndex(T0)),
      rotatingCode("a-different-ticket-secret", windowIndex(T0)),
    );
  });

  it("is not confused with a static pass", () => {
    // Each parser must refuse the other's format, or a rotating event would
    // silently accept a static screenshot.
    assert.equal(parseRotatingPayload(buildQrPayload(HASH)), null);
    assert.equal(parseQrPayload(buildRotatingPayload(HASH, SECRET, T0)), null);
  });
});
