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

**Gold changes job.** KU Yellow is 1.34:1 on paper. Darkening it until it passes
(`#846A04`, 4.87:1) yields bronze, not gold. So gold ceases to be a colour and
becomes a **material**: foil, expressed as a multi-stop gradient sheen across a large
area on the pass, never as text and never as a small mark. On a paper-and-press
system this is what gold actually is on a printed ticket.

KU Orange (2.35:1) likewise survives only as a **filled** urgency band with ink text
on it — never as coloured text on paper.

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
- Needs an SVG. The current asset is a 1024px PNG, which will not hold up at hero
  scale or on print-quality displays. **Sourcing or tracing an SVG is a Phase 1
  deliverable and a blocker for the hero.**

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
- **The emblem SVG is a hard dependency** for the Phase 2 hero. If no vector exists,
  it must be traced before that phase starts.
- **Scope creep into the scanner.** The constraint is stated above; the Phase 1
  verification step exists specifically to catch it.
- **Shared-element transitions** are the most failure-prone item in Phase 2 — they
  interact with the App Router's navigation. They are a Phase 2 problem, but flagged
  now because they may need a fallback path.
