import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier.
import { hmacHex, hmacSha256, sha256 } from "./hmac.ts";

/*
 * Published test vectors, not values captured from this implementation.
 *
 * A self-generated fixture proves only that the code still does what it did
 * last week — including, if it was wrong, staying wrong. These come from
 * FIPS 180-4 (SHA-256) and RFC 4231 (HMAC-SHA256), so they fail if the
 * implementation drifts from the actual standard.
 */

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const ascii = (value: string) => new TextEncoder().encode(value);
const repeated = (byte: number, count: number) =>
  new Uint8Array(count).fill(byte);

describe("sha256", () => {
  it("matches the empty-string vector", () => {
    assert.equal(
      hex(sha256(new Uint8Array(0))),
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches the 'abc' vector", () => {
    assert.equal(
      hex(sha256(ascii("abc"))),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches the 56-byte vector, which forces a second padding block", () => {
    // 56 bytes: the terminator and the 8-byte length no longer fit in the
    // first block, so this is the case a wrong padding calculation breaks.
    assert.equal(
      hex(
        sha256(
          ascii(
            "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
          ),
        ),
      ),
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("handles a message spanning several blocks", () => {
    assert.equal(
      hex(sha256(ascii("a".repeat(1000)))),
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });
});

describe("hmacSha256 — RFC 4231", () => {
  it("case 1: 20-byte key, 'Hi There'", () => {
    assert.equal(
      hex(hmacSha256(repeated(0x0b, 20), ascii("Hi There"))),
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
  });

  it("case 2: short ASCII key", () => {
    assert.equal(
      hex(hmacSha256(ascii("Jefe"), ascii("what do ya want for nothing?"))),
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });

  it("case 3: 20-byte key, 50-byte message", () => {
    assert.equal(
      hex(hmacSha256(repeated(0xaa, 20), repeated(0xdd, 50))),
      "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe",
    );
  });

  it("case 6: key longer than the block, so it is hashed first", () => {
    assert.equal(
      hex(
        hmacSha256(
          repeated(0xaa, 131),
          ascii("Test Using Larger Than Block-Size Key - Hash Key First"),
        ),
      ),
      "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
    );
  });
});

describe("hmacHex", () => {
  it("truncates to the requested width", () => {
    assert.equal(hmacHex("Jefe", "what do ya want for nothing?", 8), "5bdcc146");
    assert.equal(hmacHex("Jefe", "what do ya want for nothing?", 4), "5bdc");
  });

  it("is a prefix of the full digest", () => {
    const full = hex(hmacSha256(ascii("k"), ascii("m")));
    assert.equal(hmacHex("k", "m", 8), full.slice(0, 8));
  });

  it("separates keys", () => {
    assert.notEqual(hmacHex("key-a", "same", 8), hmacHex("key-b", "same", 8));
  });
});
