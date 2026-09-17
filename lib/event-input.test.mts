/**
 * Tests for the event payload validator.
 *
 * This is the boundary between an untrusted form and a document that ends up
 * rendered on a public page, so the cases that matter are the hostile ones: a
 * label that breaks a card's layout, a cover URL pointing somewhere we do not
 * control, a field that should have been ignored and was not.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier.
import { parseEventInput } from "./event-input.ts";
import { CATEGORY_OTHER_MAX } from "./types.ts";

const START = 2_000_000_000_000;

/** A payload that passes, so each test can change exactly one thing. */
function body(overrides: Record<string, unknown> = {}) {
  return {
    title: "Inter-college Hackathon",
    description: "Two days, one problem statement.",
    venue: "Main Auditorium",
    starts_at: START,
    ends_at: START + 3_600_000,
    track: "UIT",
    category: "Hackathon",
    expected_footfall: 120,
    capacity: 120,
    ...overrides,
  };
}

/** Narrows the result so a test can read `.value` without a cast each time. */
function accept(input: Record<string, unknown>) {
  const result = parseEventInput(input);
  assert.ok(result.ok, `expected accept, got: ${result.ok ? "" : result.error}`);
  return result.value;
}

function reject(input: Record<string, unknown>): string {
  const result = parseEventInput(input);
  assert.ok(!result.ok, "expected this payload to be refused");
  return result.error;
}

describe("event input", () => {
  it("accepts a well-formed proposal", () => {
    const value = accept(body());
    assert.equal(value.title, "Inter-college Hackathon");
    assert.equal(value.category_other, null);
  });

  it("refuses a track that is not one of the university's", () => {
    reject(body({ track: "HOGWARTS" }));
  });

  it("refuses a category outside the closed set", () => {
    // The reason categories stayed a union: this check is only possible
    // because the set is known at build time.
    reject(body({ category: "Whatever" }));
  });
});

describe("the written category", () => {
  it("keeps a sensible label", () => {
    const value = accept(body({ category: "Other", category_other: "Alumni Meet" }));
    assert.equal(value.category_other, "Alumni Meet");
  });

  it("collapses whitespace and strips control characters", () => {
    // A newline here would break a single-line chip out of its box on the
    // poster card. Built by code point so the test file stays free of the
    // literal characters it is testing.
    const nasty = ` Inter${String.fromCharCode(10)}college${String.fromCharCode(9)} Meet `;

    const value = accept(body({ category: "Other", category_other: nasty }));
    assert.equal(value.category_other, "Inter college Meet");
  });

  it("caps the length so it cannot push a card apart", () => {
    const value = accept({
      ...body({ category: "Other" }),
      category_other: "A".repeat(200),
    });

    assert.equal(value.category_other!.length, CATEGORY_OTHER_MAX);
  });

  it("refuses an empty or one-character label", () => {
    reject(body({ category: "Other", category_other: "" }));
    reject(body({ category: "Other", category_other: "x" }));
    // Whitespace-only must not slip through as "present".
    reject(body({ category: "Other", category_other: "   " }));
  });

  it("ignores the label entirely when the category is not Other", () => {
    // Otherwise switching from Other back to Workshop leaves a stray label
    // printed on the card.
    const value = accept(body({ category: "Workshop", category_other: "leftover" }));
    assert.equal(value.category_other, null);
  });
});

describe("cover image", () => {
  it("refuses a URL we did not issue", () => {
    // A cover pointing anywhere else would let a proposal embed a tracking
    // pixel on the public directory.
    reject(body({ cover_image_url: "https://evil.example/pixel.png" }));
    reject(body({ cover_image_url: "http://firebasestorage.googleapis.com/x" }));
  });

  it("accepts one from our own bucket", () => {
    const url = "https://firebasestorage.googleapis.com/v0/b/ku/o/cover.png?alt=media";
    assert.equal(accept(body({ cover_image_url: url })).cover_image_url, url);
  });
});

describe("rotating passes", () => {
  it("is off unless the body says exactly true", () => {
    // A security setting that could be switched on by a stray value is one
    // nobody can reason about.
    for (const value of [undefined, null, 0, 1, "true", "yes", {}]) {
      assert.equal(accept(body({ rotating_qr: value })).rotating_qr, false);
    }

    assert.equal(accept(body({ rotating_qr: true })).rotating_qr, true);
  });
});
