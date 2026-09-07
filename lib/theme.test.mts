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

/**
 * The body of one custom-property block, so lookups can be scoped.
 *
 * Necessary rather than tidy: several properties — `--admit`, `--refuse`,
 * `--urgent`, `--line` — are now defined in *both* scales with different
 * values. An unscoped search finds whichever appears first in the file and
 * would happily measure the obsidian green against the paper ground and call
 * it a pass.
 */
function scope(selector: string): string {
  const start = css.indexOf(selector);
  assert.ok(start !== -1, `no ${selector} block in globals.css`);

  const open = css.indexOf("{", start);
  const close = css.indexOf("\n}", open);
  assert.ok(open !== -1 && close !== -1, `${selector} block is not closed`);

  return css.slice(open, close);
}

const PAPER_BLOCK = scope('[data-theme="paper"]');
const OBSIDIAN_BLOCK = scope(":root,");

/** Reads a custom property's literal hex value out of one scale. */
function token(name: string, block: string = PAPER_BLOCK): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(block);
  assert.ok(match, `${name} is not defined as a literal hex in this scale`);
  return match![1];
}

const PAPER_SURFACES = ["--paper", "--paper-raised", "--paper-sunk"] as const;
const PAPER_TEXT = ["--ink", "--ink-dim", "--ink-soft", "--ku-red"] as const;

/**
 * Status colours are text too.
 *
 * "Checked in", "full", "3 seats left" are read, not merely noticed, and they
 * are read on a roster during an event. The obsidian values measure 1.77:1,
 * 3.29:1 and 2.20:1 on paper — this asserts the paper scale defines its own.
 */
const PAPER_STATUS = ["--admit", "--refuse", "--urgent"] as const;

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

  it("holds AA for status colours on every paper surface", () => {
    // These are read during an event, not merely noticed. A roster showing
    // "checked in" in a green nobody can read is worse than showing nothing,
    // because it looks like it worked.
    for (const surface of PAPER_SURFACES) {
      for (const status of PAPER_STATUS) {
        const ratio = contrastRatio(token(status), token(surface));
        assert.ok(
          ratio >= 4.5,
          `${status} on ${surface} is ${ratio.toFixed(2)}:1, below AA`,
        );
      }
    }
  });

  it("does not reuse the obsidian status colours", () => {
    // The obsidian values measure 1.77:1, 3.29:1 and 2.20:1 here. If the paper
    // scale ever stops defining its own, this catches it.
    for (const status of PAPER_STATUS) {
      assert.notEqual(
        token(status).toLowerCase(),
        token(status, OBSIDIAN_BLOCK).toLowerCase(),
        `${status} still uses the dark-ground value on paper`,
      );
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
      const ratio = contrastRatio(
        token(text, OBSIDIAN_BLOCK),
        token("--obsidian", OBSIDIAN_BLOCK),
      );
      assert.ok(ratio >= 4.5, `${text} on --obsidian is ${ratio.toFixed(2)}:1`);
    }
  });
});
