import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { contrastRatio } from "./color.ts";

/*
 * The palette, asserted against the stylesheet itself.
 *
 * Reading globals.css rather than a duplicated copy of the values is the whole
 * point: a token edited to an illegible value fails here, which a one-time
 * measurement written into a doc would never catch.
 */
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

/** Reads a custom property's literal hex value out of globals.css. */
function token(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css);
  assert.ok(match, `${name} is not defined as a literal hex in globals.css`);
  return match![1];
}

const PAPER_SURFACES = ["--paper", "--paper-raised", "--paper-sunk"] as const;
const PAPER_TEXT = ["--ink", "--ink-dim", "--ink-soft", "--ku-red"] as const;

describe("paper scale", () => {
  it("holds AA for every text token on every paper surface", () => {
    // Not just the ground: a card sits on --paper-raised and an input well on
    // --paper-sunk, and the sunk surface is the darkest of the three. Checking
    // only the ground would let a token pass here and fail on screen.
    for (const surface of PAPER_SURFACES) {
      for (const text of PAPER_TEXT) {
        const ratio = contrastRatio(token(text), token(surface));
        assert.ok(
          ratio >= 4.5,
          `${text} on ${surface} is ${ratio.toFixed(2)}:1, below AA`,
        );
      }
    }
  });

  it("keeps KU Red exactly as the university publishes it", () => {
    // The whole reason for the light ground. If this ever needs lifting, the
    // ground has drifted too dark and the redesign's premise has broken.
    assert.equal(token("--ku-red").toUpperCase(), "#C02722");
  });

  it("restricts --ink-faint to non-text use", () => {
    // Documented as non-text; this asserts it genuinely cannot pass as text,
    // so nobody "fixes" the docs to match a misuse.
    const ratio = contrastRatio(token("--ink-faint"), token("--paper"));
    assert.ok(ratio < 4.5, "--ink-faint now passes AA — retype it as a text token");
    assert.ok(ratio >= 3, "--ink-faint must still meet 3:1 for UI marks");
  });

  it("defines no gold token", () => {
    // Yellow is 1.34:1 on paper. It lives inside the emblem artwork only.
    // No `s` flag: the project's TS target predates it, and `[^}]*` already
    // crosses newlines, so it was never doing any work here.
    assert.ok(
      !/\[data-theme="paper"\][^}]*--gold/.test(css),
      "the paper scale must not define a gold token",
    );
  });
});

describe("obsidian scale is untouched", () => {
  it("still holds AA for gate text", () => {
    // The gate keeps the dark system. If this breaks, the scanner broke.
    for (const text of ["--bone", "--bone-dim", "--crimson"]) {
      const ratio = contrastRatio(token(text), token("--obsidian"));
      assert.ok(ratio >= 4.5, `${text} on --obsidian is ${ratio.toFixed(2)}:1`);
    }
  });
});
