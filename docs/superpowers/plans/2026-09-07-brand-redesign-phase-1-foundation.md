# KU Events Brand Redesign — Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the paper colour scale, ground-aware material rules, retuned type and motion primitives that Phases 2 and 3 will use, without changing any route's appearance yet.

**Architecture:** Two colour systems coexist in `app/globals.css`. The existing obsidian scale stays on `:root` so every live screen keeps working; the new paper scale is opt-in via `[data-theme="paper"]` on a subtree. Phase 2 flips the default as it rebuilds student screens. The gate never opts in. Component primitives (`.stub`, `.tear`, `.field-label`) are rewritten to read semantic aliases so a single component renders correctly under either ground.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (`@theme inline`), CSS custom properties, `framer-motion` (already a dependency), `node:test` with type stripping.

## Global Constraints

- **`/scanner` must not change.** No 3D, no scroll effects, no decorative motion, no new bundle weight. Verified explicitly in Task 6.
- **No new runtime dependency.** `framer-motion` is already present; nothing else ships.
- **`prefers-reduced-motion` disables all motion**, matching current behaviour.
- **Every text token must meet WCAG AA (4.5:1)** against every surface it can sit on. `--ink-faint` (3.38–3.92:1) is non-text only, without exception.
- **KU Red is `#C02722`, unmodified**, on paper. The obsidian scale keeps its lifted `#DA5045`.
- **Gold/yellow is not a token.** It exists only inside emblem artwork.
- Tests run with `npm test` (`node --test "lib/**/*.test.mts"`). Test files are `.mts`, import siblings with a relative path **and** a `.ts`/`.mts` extension — `node --test` resolves neither the `@/` alias nor bare specifiers.

---

### Task 1: Contrast math helper

A pure module the theme test will use. No dependencies, so it stays importable under plain `node --test`.

**Files:**
- Create: `lib/color.ts`
- Test: `lib/color.test.mts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hexToRgb(hex: string): { r: number; g: number; b: number }`, `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number`. All accept `#RRGGBB` (case-insensitive, `#` required).

- [ ] **Step 1: Write the failing test**

```ts
// lib/color.test.mts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './color.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/color.ts
/**
 * WCAG contrast maths, dependency-free.
 *
 * Lives apart from any React or Next import so `theme.test.mts` can assert the
 * palette under plain `node --test`, where the `@/` alias does not resolve.
 * The palette is the one part of the design system that can be checked by
 * machine rather than by eye, so it is.
 */

const HEX = /^#[0-9a-f]{6}$/i;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!HEX.test(hex)) {
    throw new Error(`Not a #RRGGBB hex colour: ${hex}`);
  }

  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Per WCAG 2.1: sRGB channels linearised, then weighted. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);

  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );

  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 5 new tests

- [ ] **Step 5: Commit**

```bash
git add lib/color.ts lib/color.test.mts
git commit -m "Add dependency-free WCAG contrast maths"
```

---

### Task 2: Paper scale, asserted by test

The palette is checked by parsing `app/globals.css`, so the test fails if someone edits a token to an illegible value later — the point is the guarantee, not a one-time measurement.

**Files:**
- Create: `lib/theme.test.mts`
- Modify: `app/globals.css` (add paper block after the `:root` obsidian block; add `@theme inline` entries)

**Interfaces:**
- Consumes: `contrastRatio` from Task 1.
- Produces: CSS custom properties `--paper`, `--paper-raised`, `--paper-sunk`, `--ink`, `--ink-dim`, `--ink-soft`, `--ink-faint`, `--ku-red`, `--ku-orange`, scoped to `[data-theme="paper"]`. Tailwind utilities `bg-paper`, `bg-paper-raised`, `bg-paper-sunk`, `text-ink`, `text-ink-dim`, `text-ink-soft`, `text-ink-faint`, `text-ku-red`, `bg-ku-red`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/theme.test.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { contrastRatio } from "./color.ts";

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
    assert.ok(
      !/\[data-theme="paper"\][^}]*--gold/s.test(css),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `--paper is not defined as a literal hex in globals.css`

- [ ] **Step 3: Add the paper scale to `app/globals.css`**

Insert immediately after the closing `}` of the existing `:root` block (currently ending at the `--ring: var(--crimson);` line), before `@theme inline`:

```css
/* ───────────────────────────────────────────────────────────────────────────
   Paper — the student surfaces
   ───────────────────────────────────────────────────────────────────────────
   Opt-in, not the default. Every existing screen is written against the
   obsidian scale above, so flipping :root would break all of them at once.
   Phase 2 moves each student route onto this scale as it is rebuilt, and the
   gate console simply never opts in — a marshal works at night, on battery,
   and a white screen is glare in their eyes.

   The reason this scale exists: KU Red #C02722 measures 5.54:1 here and passes
   AA unmodified. On the obsidian ground it measures 3.40:1 and has to be lifted
   to #DA5045 — a colour that holds KU's hue but is not KU's red. On paper the
   interface can use the university's actual colour.

   There is no gold. KU Yellow is 1.34:1 on this ground; darkening it until it
   passes yields bronze. Yellow lives inside the emblem artwork, at the core of
   the flame, and nowhere else.
   ─────────────────────────────────────────────────────────────────────────── */
[data-theme="paper"] {
  --paper: #fbf7f2; /* warm, never pure white */
  --paper-raised: #ffffff; /* cards lifting off the ground */
  --paper-sunk: #f3ede6; /* wells, inputs, the inside of a punch */

  --ink: #1a1416; /* 17.04:1 */
  --ink-dim: #5c5150; /* 7.16:1 */
  --ink-soft: #6e625f; /* 5.51:1 */
  --ink-faint: #8a7e7b; /* 3.68:1 — NON-TEXT ONLY: rules, disabled marks */

  --ku-red: #c02722; /* 5.54:1 — official, unmodified */
  --ku-orange: #f78543; /* 2.35:1 — filled bands only, never text */

  /* Paper has no glow. Elevation is a contact shadow plus an ambient one. */
  --shadow-contact: 0 1px 2px #1a141612;
  --shadow-ambient: 0 12px 32px -8px #1a141614;

  --line: #1a141614;
  --line-strong: #1a141626;

  /* A punch reveals the ground behind the card, not the card. */
  --notch: var(--paper);

  /* shadcn-compatible aliases re-pointed at paper */
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper-raised);
  --card-foreground: var(--ink);
  --popover: var(--paper-raised);
  --popover-foreground: var(--ink);
  --primary: var(--ku-red);
  --primary-foreground: #ffffff;
  --secondary: var(--paper-sunk);
  --secondary-foreground: var(--ink);
  --muted: var(--paper-sunk);
  --muted-foreground: var(--ink-dim);
  --accent: var(--paper-sunk);
  --accent-foreground: var(--ink);
  --border: var(--line);
  --input: var(--line-strong);
  --ring: var(--ku-red);
}
```

Then add to the `@theme inline` block, after `--color-glass`:

```css
  --color-paper: var(--paper);
  --color-paper-raised: var(--paper-raised);
  --color-paper-sunk: var(--paper-sunk);
  --color-ink: var(--ink);
  --color-ink-dim: var(--ink-dim);
  --color-ink-soft: var(--ink-soft);
  --color-ink-faint: var(--ink-faint);
  --color-ku-red: var(--ku-red);
  --color-ku-orange: var(--ku-orange);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. If `--ink-soft on --paper-sunk` fails, it is 5.05:1 by hand — re-check the token was copied exactly.

- [ ] **Step 5: Confirm nothing visually changed**

Run: `npm run build`
Expected: succeeds. No element carries `data-theme="paper"` yet, so every route renders exactly as before.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css lib/theme.test.mts
git commit -m "Add the paper scale, asserted against WCAG AA"
```

---

### Task 3: Ground-aware material

`.stub`, `.tear` and `.field-label` currently hardcode `--ember` and `--line`. Rewriting them against the alias layer makes one component render correctly under both grounds, which is what lets Phase 2 migrate routes one at a time.

**Files:**
- Modify: `app/globals.css:273-312` (the `.stub`, `.stub-notched`, `.tear` rules)

**Interfaces:**
- Consumes: tokens from Task 2.
- Produces: `.stub`, `.stub-notched`, `.tear` rendering correctly under both `:root` and `[data-theme="paper"]`. No class names change, so `components/ui/stub.tsx` needs no edit.

- [ ] **Step 1: Replace the `.stub` rule**

```css
.stub {
  position: relative;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}

/*
 * On paper a card is a physical object: it sits on the ground and casts a
 * shadow. On obsidian it is a lit surface and casts nothing — a shadow on
 * near-black is invisible, and faking one with a glow is the dark-UI habit
 * this redesign is moving away from.
 */
[data-theme="paper"] .stub {
  box-shadow: var(--shadow-contact), var(--shadow-ambient);
}
```

- [ ] **Step 2: Replace the notch rules**

```css
.stub-notched::before,
.stub-notched::after {
  content: "";
  position: absolute;
  top: var(--at, 50%);
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  background: var(--notch);
  pointer-events: none;
}

/*
 * A punch is removed material, so on paper it needs an inner shadow at the top
 * and a light lip at the bottom. Without it the notch reads as a drawn circle
 * in the ground colour, which is exactly what it is on a dark UI and exactly
 * what it must not look like here.
 */
[data-theme="paper"] .stub-notched::before,
[data-theme="paper"] .stub-notched::after {
  box-shadow: inset 0 2px 3px -1px #1a14161f, inset 0 -1px 0 #ffffffcc;
}

.stub-notched::before {
  left: 0;
  transform: translate(-50%, -50%);
}

.stub-notched::after {
  right: 0;
  transform: translate(50%, -50%);
}
```

- [ ] **Step 3: Replace the `.tear` rule**

```css
.tear {
  position: relative;
  height: 1px;
  background-image: linear-gradient(
    to right,
    var(--line-strong) 0 8px,
    transparent 8px 16px
  );
  background-size: 16px 1px;
  background-repeat: repeat-x;
}

/*
 * The deckled edge. A torn paper edge is irregular, so the dashes vary in
 * width and the line gains a faint highlight below it — the lip of the tear
 * catching light. Still one CSS rule and no image.
 */
[data-theme="paper"] .tear {
  height: 2px;
  background-image: linear-gradient(
      to right,
      var(--line-strong) 0 7px,
      transparent 7px 13px,
      var(--line-strong) 13px 18px,
      transparent 18px 27px
    ),
    linear-gradient(to bottom, transparent 0 1px, #ffffffb3 1px 2px);
  background-size:
    27px 1px,
    100% 2px;
  background-repeat: repeat-x, no-repeat;
}
```

- [ ] **Step 4: Verify both grounds still build**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass. `.stub` now reads `--card`, which resolves to `--ember` under `:root`, so the dark screens are pixel-identical.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "Make the stub, notch and tear render on either ground"
```

---

### Task 4: Type retuned for paper

Dark-on-light reads heavier than light-on-dark at identical weight.

**Files:**
- Modify: `app/globals.css` (`.display` rule at line 220, `.field-label` at 229; add paper overrides)

**Interfaces:**
- Consumes: nothing new.
- Produces: `.display` and `.field-label` rendering at the corrected weight and tracking under `[data-theme="paper"]`.

- [ ] **Step 1: Add paper overrides after the existing `.display` rule**

```css
/*
 * Ink on paper reads heavier than bone on obsidian at the same weight, so the
 * display face steps down 600 → 500 and opens up slightly. Fraunces is
 * variable, so this is a weight axis change, not a different file.
 */
[data-theme="paper"] .display {
  font-weight: 500;
  letter-spacing: 0.01em;
}

[data-theme="paper"] body {
  font-weight: 380;
  letter-spacing: -0.005em;
}

/*
 * The mono scale does NOT change between grounds. It carries codes, counts and
 * timestamps, and a marshal reading a code off a pass and a student reading it
 * off their phone must see the same rhythm.
 */
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Retune the display and body weights for ink on paper"
```

---

### Task 5: Motion primitives

One spring, one distance. `components/motion/reveal.tsx` already centralises the rule; this extends it rather than replacing it.

**Files:**
- Create: `lib/motion.ts`
- Test: `lib/motion.test.mts`
- Modify: `components/motion/reveal.tsx` (import the shared spring instead of a local literal)

**Interfaces:**
- Consumes: nothing.
- Produces: `SPRING: { type: "spring"; stiffness: 220; damping: 26 }`, `PRESS_SCALE: 0.98`, `REVEAL_DISTANCE: 16`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/motion.test.mts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRESS_SCALE, REVEAL_DISTANCE, SPRING } from "./motion.ts";

describe("motion primitives", () => {
  it("exposes one spring for the whole product", () => {
    // One curve everywhere is the rule the design system is built on. A second
    // spring is how an interface starts feeling assembled rather than designed.
    assert.deepEqual(SPRING, { type: "spring", stiffness: 220, damping: 26 });
  });

  it("keeps the press compression subtle", () => {
    // Below ~0.95 a press reads as a bounce rather than as pressure.
    assert.ok(PRESS_SCALE >= 0.95 && PRESS_SCALE < 1);
  });

  it("keeps the reveal distance short", () => {
    // Long travel is the tell of a template. 16px is a nudge, not an entrance.
    assert.ok(REVEAL_DISTANCE > 0 && REVEAL_DISTANCE <= 24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './motion.ts'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/motion.ts
/**
 * One spring, one distance, for the entire product.
 *
 * Motion is the fastest way an interface starts to feel assembled rather than
 * designed: a second easing curve appears for one component, then a third, and
 * nothing shares a physics any more. These are the only values, and every
 * animated surface imports them.
 *
 * No React or framer-motion import here, so the values can be asserted under
 * plain `node --test`.
 */

/** The only spring. Firm enough to feel responsive, damped enough not to wobble. */
export const SPRING = {
  type: "spring",
  stiffness: 220,
  damping: 26,
} as const;

/** How far a pressable element compresses while held. */
export const PRESS_SCALE = 0.98;

/** How far a revealing element travels, in pixels. A nudge, not an entrance. */
export const REVEAL_DISTANCE = 16;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 3 new tests

- [ ] **Step 5: Point `reveal.tsx` at the shared values**

Read `components/motion/reveal.tsx` first. Replace its local transition literal and its y-offset with imports:

```tsx
import { REVEAL_DISTANCE, SPRING } from "@/lib/motion";
```

Use `SPRING` wherever the transition object was declared inline, and `REVEAL_DISTANCE` wherever the travel distance was a number literal. Do not change the `prefers-reduced-motion` branch.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 7: Commit**

```bash
git add lib/motion.ts lib/motion.test.mts components/motion/reveal.tsx
git commit -m "Centralise the one spring and one distance"
```

---

### Task 6: Emblem assets and mark component

Uses the rasters that exist. The 1024px crest has **no alpha channel** — a baked white background that would show as a white box on paper — so it is not used on paper surfaces at all until a vector or a keyed version exists.

**Files:**
- Create: `public/ku-lockup.png` (copy of the 200×241 vertical lockup, which has alpha)
- Create: `public/ku-naac.webp` (copy of the NAAC accreditation lockup)
- Create: `components/brand/mark.tsx`
- Test: none — this is an asset wrapper with no logic worth asserting.

**Interfaces:**
- Consumes: nothing.
- Produces: `<Mark size?: number />` rendering the KU lockup, `<NaacMark />` rendering the accreditation lockup.

- [ ] **Step 1: Copy the assets in**

```bash
cp "/c/Users/rs354/Downloads/idqL_lcG1n_1788786629144.png" public/ku-lockup.png
cp "/c/Users/rs354/Downloads/KU-X-NAAC-A-Logo_Web-01 (1).webp" public/ku-naac.webp
```

- [ ] **Step 2: Write the component**

```tsx
// components/brand/mark.tsx
import Image from "next/image";

/**
 * The university's marks.
 *
 * Deliberately capped in size. The only artwork available is a 200x241 raster —
 * there is no vector yet, and the 1024px crest in `public/` has no alpha
 * channel, so it renders as a white box on the paper ground and is unusable
 * there. Until a real `.svg` arrives from KU's brand team, the mark is shown at
 * sizes this raster genuinely supports and never larger.
 *
 * When the vector lands, this component is the only file that changes.
 */

/** The vertical lockup: flame, peacock, wordmark. */
export function Mark({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  // Above its native height the raster visibly softens. Capped rather than
  // left to a caller who cannot see the artwork.
  const height = Math.min(size, 241);

  return (
    <Image
      src="/ku-lockup.png"
      alt="Karnavati University"
      width={Math.round((height / 241) * 200)}
      height={height}
      className={className}
      priority={false}
    />
  );
}

/** NAAC A+ accreditation. Belongs in the footer, never the header. */
export function NaacMark({ className }: { className?: string }) {
  return (
    <Image
      src="/ku-naac.webp"
      alt="NAAC Grade A+ accredited university"
      width={300}
      height={100}
      className={className}
    />
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all succeed.

- [ ] **Step 4: Confirm the gate is untouched**

```bash
git diff --name-only HEAD~5
```

Expected: no file under `components/scanner/`, `app/scanner/`, `lib/db/`, `lib/qr.ts` or `lib/sync-client.ts` appears. If one does, the redesign reached further than Phase 1 permits — revert it.

- [ ] **Step 5: Commit**

```bash
git add public/ku-lockup.png public/ku-naac.webp components/brand/mark.tsx
git commit -m "Add the KU marks at the sizes the raster supports"
```

---

## Self-Review

**Spec coverage:** §1.1 colour → Task 2. §1.2 type → Task 4. §1.3 material → Task 3. §1.4 motion → Task 5. §1.5 emblem → Task 6. §1.6 components → Task 3 (the `.stub` family is CSS-driven, so `stub.tsx` needs no change; `button`/`field`/`dialog`/`tabs`/`table`/`toast` already consume the shadcn aliases re-pointed in Task 2 and need no edit until a route opts into paper in Phase 2). §1.7 verification → Tasks 1–2 (contrast assertions) and Task 6 Step 4 (scanner untouched).

**Placeholder scan:** none. Every code step carries complete code; the one "read the file first" instruction (Task 5 Step 5) is unavoidable because `reveal.tsx`'s current literals must be located before replacement, and the imports and target values are given exactly.

**Type consistency:** `contrastRatio` / `hexToRgb` / `relativeLuminance` are defined in Task 1 and consumed under those exact names in Task 2. `SPRING` / `PRESS_SCALE` / `REVEAL_DISTANCE` are defined in Task 5 and consumed under those names in the same task. Token names in the Task 2 CSS match the strings the Task 2 test looks up.

**Known gap, deliberate:** no test asserts the *visual* material rules in Tasks 3 and 4 — CSS shadows and font weights have no meaningful unit test, and this repo has no visual-regression harness. They are verified by build plus eye. Adding a screenshot harness is out of scope for Phase 1.
