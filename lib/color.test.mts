import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier. `color.ts` has no runtime imports for that reason.
import { contrastRatio, hexToRgb, relativeLuminance } from "./color.ts";

describe("contrast maths", () => {
  it("parses hex regardless of case", () => {
    assert.deepEqual(hexToRgb("#C02722"), { r: 192, g: 39, b: 34 });
    assert.deepEqual(hexToRgb("#c02722"), { r: 192, g: 39, b: 34 });
  });

  it("anchors luminance at the extremes", () => {
    assert.equal(relativeLuminance("#FFFFFF"), 1);
    assert.equal(relativeLuminance("#000000"), 0);
  });

  it("gives the WCAG range and is order-independent", () => {
    assert.equal(contrastRatio("#FFFFFF", "#000000").toFixed(2), "21.00");
    assert.equal(contrastRatio("#000000", "#FFFFFF").toFixed(2), "21.00");
    assert.equal(contrastRatio("#FFFFFF", "#FFFFFF"), 1);
  });

  it("agrees with the published ratio for KU Red on paper", () => {
    // The number the whole redesign rests on: the official crest colour is
    // legible on paper unmodified, which it is not on the obsidian ground.
    assert.equal(contrastRatio("#C02722", "#FBF7F2").toFixed(2), "5.54");
  });

  it("rejects malformed input rather than returning a wrong ratio", () => {
    assert.throws(() => hexToRgb("C02722"), /hex/i);
    assert.throws(() => hexToRgb("#FFF"), /hex/i);
  });
});
