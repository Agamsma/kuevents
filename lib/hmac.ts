/**
 * Synchronous SHA-256 and HMAC-SHA256.
 *
 * WHY THIS EXISTS, given the platform ships both.
 *
 * `crypto.subtle` is async-only, and the one caller that matters —
 * `isRotatingCodeCurrent`, reached from `resolveScan()` in `lib/db/indexeddb.ts`
 * — runs INSIDE a Dexie transaction. A Dexie transaction stays alive only
 * across its own promise chain; awaiting a foreign promise inside one lets it
 * commit early. That transaction is what makes a scan atomic (flip the local
 * row and append to the outbox together, or neither), which is the guarantee
 * that stops a crash mid-scan double-admitting or losing a check-in. Turning
 * the scan path async to reach `crypto.subtle` would trade a real correctness
 * property at the gate for an implementation detail.
 *
 * Node's `createHmac` is synchronous but absent from the browser, and this runs
 * in the browser. So: a small, self-contained implementation, verified against
 * the published vectors in `hmac.test.mts` (FIPS 180-4 for SHA-256, RFC 4231
 * for HMAC). Do not edit either file without re-running those.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const BLOCK_BYTES = 64;

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** SHA-256 over raw bytes. */
export function sha256(message: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  /*
   * Pad to a multiple of 64 bytes, leaving room for the 0x80 terminator and
   * the 8-byte big-endian bit length. `(((n + 8) >> 6) + 1) << 6` is the
   * smallest such multiple that still fits both.
   */
  const padded = new Uint8Array((((message.length + 8) >> 6) + 1) << 6);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  const bitLength = message.length * 8;
  // Split across two words: a message long enough to overflow 32 bits of bit
  // length will never reach here, but writing only the low word would be a
  // silent correctness bug rather than a visible one.
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += BLOCK_BYTES) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }

    for (let i = 16; i < 64; i += 1) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    let f = h[5];
    let g = h[6];
    let hh = h[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (hh + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (s0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) {
    outView.setUint32(i * 4, h[i], false);
  }

  return out;
}

/** HMAC-SHA256, as specified in RFC 2104. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // A key longer than the block is hashed down; a shorter one is zero-padded.
  const block = new Uint8Array(BLOCK_BYTES);
  block.set(key.length > BLOCK_BYTES ? sha256(key) : key);

  const inner = new Uint8Array(BLOCK_BYTES + message.length);
  const outer = new Uint8Array(BLOCK_BYTES + 32);

  for (let i = 0; i < BLOCK_BYTES; i += 1) {
    inner[i] = block[i] ^ 0x36;
    outer[i] = block[i] ^ 0x5c;
  }

  inner.set(message, BLOCK_BYTES);
  outer.set(sha256(inner), BLOCK_BYTES);

  return sha256(outer);
}

const encoder = new TextEncoder();

/**
 * HMAC-SHA256 over two strings, returned as lowercase hex truncated to
 * `hexChars`.
 *
 * Truncation is safe in a way that truncating a plain hash is not: HMAC is a
 * pseudorandom function, so short output limits an attacker to guessing one
 * value at a time. It does not help them recover the key, which is the property
 * a non-PRF like FNV-1a fails to provide.
 */
export function hmacHex(
  key: string,
  message: string,
  hexChars: number,
): string {
  const digest = hmacSha256(encoder.encode(key), encoder.encode(message));

  let hex = "";
  for (let i = 0; i < digest.length && hex.length < hexChars; i += 1) {
    hex += digest[i].toString(16).padStart(2, "0");
  }

  return hex.slice(0, hexChars);
}
