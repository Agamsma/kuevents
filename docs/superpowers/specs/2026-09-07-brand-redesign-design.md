# KU Events — brand redesign

**Date:** 2026-09-07
**Status:** approved (Phase 1 detailed; Phases 2–3 outlined, each gets its own spec)

---

## Why

The app is chromatically official and visually anonymous. `app/globals.css` already
locks every accent to Karnavati University's published brand — KU Red `#C02722`,
KU Yellow `#F7D70A`, KU Orange `#F78543` — holding each colour's exact OKLCH hue
and moving only lightness. That work is sound and is not the problem.

Two things are:

1. **The emblem is unused.** `public/KU-Emblem-Apr23-1024x1024.png` has been in the
   repo since August and appears nowhere in the interface; `app/layout.tsx:76` still
   points the icon at `/icon.svg`. Nothing on screen says this is KU's platform.

2. **A crest palette is not a UI theme.** KU Red is built to sit on a shield at full
   saturation. On the near-black ground it measures 3.40:1 — failing AA — so it had
   to be lifted to `#DA5045`, a colour holding KU's hue but which is *not* KU's red.
   The interface is therefore an approximation of the brand rather than the brand.

The measured fact that reframes the whole redesign:

> **KU Red `#C02722` measures 5.54:1 on warm paper `#FBF7F2` — it passes AA for body
> text unmodified.**

Moving to a light ground is not a stylistic preference. It is the condition under
which the university's actual colour becomes usable. The brand stops being
approximated and becomes literally correct.

## Decisions

| Fork | Decision | Why |
| --- | --- | --- |
| Ground | **Split** — light app, dark gate | Resolves "too dark" for students without putting a white screen in a marshal's eyes at a night gate |
| Design language | **Paper & press** — evolve the stub | Perforation is the least generic idea in the codebase and it is *about* tickets; rebuilt for light it becomes literal rather than decorative |
| Motion | Physical everywhere, cinematic landing hero, **3D only on the pass** | CSS/Web Animations only; a WebGL renderer is ~600KB and is the commonest template tell |
| Sequencing | Foundation → student journey → staff | Each phase ships usable; a single spec for 12 routes cannot be implemented reliably |

### Non-negotiable constraints

These override any aesthetic decision:

- **`/scanner` stays lean and dark.** It runs offline, on an arbitrary Android phone,
  on battery, for hours. No 3D, no scroll effects, no decorative motion. The verdict
  overlay stays instant and full-bleed.
- **Offline behaviour is unchanged.** The Dexie roster, the outbox, and `resolveScan`
  are untouched by this work.
- **`prefers-reduced-motion` disables all motion**, as it does today.
- **No new runtime dependency** for motion or 3D. `framer-motion` is already present;
  nothing else ships.

---

## Phase 1 — Foundation

The token layer, type scale, material rules, motion primitives and rebuilt
primitives. No route is redesigned in this phase; it exists so Phases 2 and 3 have
one vocabulary to speak.

### 1.1 Colour

Two grounds, one brand. Contrast measured against its own ground.

**Paper (student surfaces)**

| Token | Value | Contrast | Role |
| --- | --- | --- | --- |
| `--paper` | `#FBF7F2` | — | ground; warm, never pure white |
| `--paper-raised` | `#FFFFFF` | — | cards lifting off the ground |
| `--paper-sunk` | `#F3EDE6` | — | wells, inputs, the inside of a punch |
| `--ink` | `#1A1416` | 17.04:1 | primary text |
| `--ink-dim` | `#5C5150` | 7.16:1 | secondary text |
| `--ink-soft` | `#6E625F` | 5.51:1 | tertiary text, still AA |
| `--ink-faint` | `#8A7E7B` | 3.68:1 | **non-text only** — rules, disabled marks |
| `--ku-red` | `#C02722` | 5.54:1 | brand and action — **official, unmodified** |

Every text token above holds AA against **all three** paper surfaces, not just the
ground. Worst cases are on `--paper-sunk`: `--ink-soft` at 5.05:1 and `--ku-red` at
5.08:1. `--ink-faint` is 3.38–3.92:1 across the three and is therefore restricted to
non-text use everywhere, without exception.

**Gold is removed as a token entirely.** KU Yellow is 1.34:1 on paper — unusable for
text or any small mark — and darkening it until it passes (`#846A04`, 4.87:1) yields
bronze, not gold. Rather than force it, the palette drops it. Yellow survives only
where it genuinely belongs: inside the emblem artwork, at the core of the flame.

This leaves **paper, ink, and KU Red**, with orange as the single secondary. Three
colours and a neutral scale. Fewer colours is the more premium result, and it removes
the awkwardness of a scarce accent that has no legible form on a light ground.

The pass keeps a foil sweep, but it is no longer gold. **The foil is the flame
gradient from the emblem** — KU Red into KU Orange into a pale warm highlight —
swept across the card as it tilts. It echoes the crest instead of introducing a
colour the crest does not lead with, and it needs no yellow token to exist.

KU Orange (2.35:1) survives only as a **filled** urgency band with ink text on it —
never as coloured text on paper.

**Obsidian (gate only)** — the existing dark tokens are retained unchanged for
`/scanner` and the verdict overlay. They are already tuned and already correct for
that context. The two systems coexist; they do not merge.

### 1.2 Type

**Fraunces / Instrument Sans / JetBrains Mono are kept**, retuned for paper.

This is the one deliberate carry-over in an otherwise complete change, recorded here
so it can be overturned cheaply. Fraunces is a high-contrast serif with optical
sizing and a "wonk" axis; it reads warm rather than institutional and is the least
generic choice in the current design. Reversing this decision means changing one
`next/font` import and re-checking the display scale — cheap before implementation,
expensive after Phase 2.

Dark-on-light reads heavier than light-on-dark at identical weight, so:

- Display drops from weight 600 to 500, and body from 400 to 380 on the variable
  axis. `Fraunces`' optical size (`opsz`) tracks the rendered pixel size rather than
  being pinned to one value.
- Display tracking goes from `0` to `+0.01em`; body from `0` to `-0.005em`.
- Mono stays as-is — it carries codes, counts and timestamps and must not change
  rhythm between the two grounds.

### 1.3 Material

Every elevation cue inverts. Nothing glows on paper.

- **Elevation** is a two-layer cast shadow: a tight contact shadow plus a wide
  ambient one. Never a border-plus-glow.
- **Perforations** become debossed punches — a dark inner edge with a light lower
  lip, so the punch reads as removed material rather than a drawn circle.
- **The tear line** gains a true deckled edge (an SVG or mask-based irregular edge),
  replacing the dashed border.
- **Frosted glass is removed entirely.** `--glass` / `--glass-strong` are dark-UI
  devices and have no paper equivalent.

### 1.4 Motion primitives

One spring and one distance, everywhere:

- Spring: `stiffness 220 / damping 26`.
- Press: compress to 98%.
- Shared-element transitions carry a directory card into its detail view.
- Implemented with `framer-motion` (already a dependency) and CSS.
- All of it behind `prefers-reduced-motion`, matching today's behaviour.

`components/motion/reveal.tsx` is extended rather than replaced — it already
centralises the one-curve-one-distance rule.

### 1.5 The emblem

Used **rarely and large** — a seal, not a logo bug.

- Appears at size on login, on the pass, and as the mark resolving out of light in
  the landing hero.
- **Never** shrunk into a navbar corner; at that size the peacock and flame turn to
  mud. The header carries a wordmark instead.
#### Asset audit — the emblem is currently unbuildable at size

Measured, not assumed:

| Asset | Spec | Verdict |
| --- | --- | --- |
| `public/KU-Emblem-Apr23-1024x1024.png` | 1024×1024, **colour type 2, no alpha** | Baked white background. Renders as a white box on `--paper`. Unusable as-is. |
| Vertical lockup (mark + wordmark) | **200×241**, alpha present | Correct artwork, far too small. Inline mark only; blurs above ~120px. |
| `KU-X-NAAC-A-Logo_Web-01.webp` | webp VP8X | Usable for a footer accreditation mark at small size. |
| "Untitled design.svg" | **0 `<path>` elements**, 2 embedded base64 PNGs | A raster in an SVG wrapper. Scales no better than the PNG. Not a vector. |

There is no true vector and no large transparent asset. **§1.5 as written cannot be
implemented today.** Resolution paths, in order of preference:

1. **Obtain the real vector** from KU's brand/marketing team — an `.svg`, `.ai`, `.eps`
   or `.pdf`. Cheapest by far and the only route that is unambiguously on-brand.
2. **Trace to SVG.** The mark is geometrically tractable — the flame is nested arcs,
   the peacock a single silhouette. The wordmark is set type and would need either
   tracing or substitution, and substituting a university's wordmark typeface is a
   brand decision, not a technical one.
3. **Design around it.** Keep the emblem at the sizes the 200px raster genuinely
   supports, and build the hero from type and a vector recreation of the flame arc
   alone — no peacock, no wordmark at scale.

Path 1 is a question for the university and should be asked now, not at Phase 2.
Until one of these lands, the hero is blocked and Phase 2 cannot complete.

#### NAAC A+

The accreditation lockup is real institutional credibility and universities display
it deliberately. It belongs in the site footer at small size, and optionally in the
landing page's closing band — never in the header, where it competes with the
wordmark for the same job.

### 1.6 Components rebuilt in this phase

`components/ui/stub.tsx` is the whole system and is rebuilt first: `Stub`,
`Perforation`, `FieldLabel`. Then `button`, `field`, `dialog`, `tabs`, `table`,
`toast` follow the new material rules. `app/globals.css` gains the paper scale
alongside the retained obsidian scale.

### 1.7 Verification

- Contrast ratios asserted in a test, not eyeballed — every text token against its
  own ground, failing the build if one drops below AA.
- `npm run typecheck`, `npm run lint`, `npm test` green.
- Existing 43 tests must stay green; none of them touch presentation, so any failure
  means the redesign reached further than intended.
- Visual check of `/scanner` specifically, confirming it is untouched.

---

## Phase 2 — Student journey (outline)

Landing (cinematic scroll-driven hero, crest resolving out of light), directory,
event detail, my passes, **the pass** (true 3D: tilt to pointer and gyroscope, foil
sweep, tear along the perforation), login. Gets its own spec.

## Phase 3 — Staff surfaces (outline)

Organizer dashboard, review queue, attendee roster, admin. The scanner is retuned
within its existing dark system but not restructured. Gets its own spec.

---

## Risks

- **Two colour systems in one codebase** invites drift. Mitigated by keeping them in
  one file with an explicit boundary comment, and by the contrast test covering both.
- **The emblem SVG is a hard dependency** for the Phase 2 hero, and the audit in §1.5
  confirms **no vector currently exists** — the one file claiming to be one contains
  zero paths. This is the single most likely thing to stall the redesign, and the ask
  to KU's brand team should go out before Phase 1 implementation starts, not after.
- **The in-repo crest has no alpha channel**, so it cannot be placed on the paper
  ground at all until it is replaced or its background is removed.
- **Scope creep into the scanner.** The constraint is stated above; the Phase 1
  verification step exists specifically to catch it.
- **Shared-element transitions** are the most failure-prone item in Phase 2 — they
  interact with the App Router's navigation. They are a Phase 2 problem, but flagged
  now because they may need a fallback path.
