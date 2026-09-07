# KU Events Brand Redesign — Phase 2: Student Journey

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every surface a student touches onto the paper ground, with the pass as a physical 3D object.

**Architecture:** Paper is opted into per route via `data-theme="paper"`, not by flipping `:root`. `AppShell` is shared with the staff attendee roster, so it gains an explicit `theme` prop rather than assuming paper. Each task migrates one surface and ships independently; a half-finished Phase 2 leaves a mixed but working app, never a broken one.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, `framer-motion`, the Phase 1 tokens (`lib/motion.ts`, the `[data-theme="paper"]` scale).

## Global Constraints

- **`/scanner`, `lib/db/`, `lib/qr.ts`, `lib/sync-client.ts`, `lib/tickets-server.ts` must not be touched.** Verified at the end of every task.
- **Staff surfaces stay dark** until Phase 3 — `attendee-list.tsx`, `my-proposals.tsx`, organizer, admin, dashboard. They share `AppShell`, so `theme` must default to the dark ground.
- **No new runtime dependency.** `framer-motion` only.
- **`prefers-reduced-motion` disables all motion**, including the pass tilt and the hero parallax.
- **No WebGL.** The pass is CSS 3D transforms.
- **`--ink-faint` is non-text only.**
- **Gold does not exist.** The pass foil is the flame gradient: `--ku-red` → `--ku-orange` → a pale warm highlight.
- **The emblem is capped at 241px** by `components/brand/mark.tsx` until a vector exists. Do not bypass it with a raw `<Image>`.
- Verify with real exit codes: `npm run typecheck; echo $?` — never pipe to `tail` and read `&&`, which reports the pipe's status, not npm's.

---

### Task 1: Theme opt-in, proved on login

Login is self-contained — no shared components beyond `Button` and the stub primitives — so it proves the paper system end-to-end before anything shared moves.

**Files:**
- Modify: `components/app-shell.tsx` (add `theme` prop)
- Modify: `app/login/page.tsx`

**Interfaces:**
- Produces: `AppShell` accepts `theme?: "paper"`. Omitted means the existing dark ground, so every current caller is unchanged.

- [ ] **Step 1: Add the opt-in to `AppShell`**

```tsx
export function AppShell({
  children,
  className,
  theme,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Opt this page onto the paper ground. Omitted means the obsidian scale.
   *
   * Explicit rather than defaulted because `attendee-list.tsx` — an organizer
   * surface — uses this same shell and stays dark until Phase 3. A default here
   * would silently break it.
   */
  theme?: "paper";
}) {
  return (
    <div data-theme={theme} className={theme === "paper" ? "bg-paper text-ink" : undefined}>
      <SiteHeader />
      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-4xl px-5 pb-24 pt-28 outline-none sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Rebuild the login card on paper**

Wrap the `<main>` in `app/login/page.tsx` with `data-theme="paper"`, change `bg` to `bg-paper`, `text-bone` → `text-ink`, `text-bone-dim` → `text-ink-dim`, `text-bone-faint` → `text-ink-soft` (faint is non-text). Replace the two ambient blur orbs — they are a dark-UI device — with a single soft paper gradient. Add `<Mark size={72} />` above the heading, since login is the one place the university should introduce itself.

- [ ] **Step 3: Verify**

```
npm run typecheck; echo "tc=$?"
npm run lint; echo "lint=$?"
npm run build; echo "build=$?"
npm test; echo "test=$?"
```
Expected: all `0`.

- [ ] **Step 4: Commit**

```bash
git add components/app-shell.tsx app/login/page.tsx
git commit -m "Put login on paper, and make the shell's ground explicit"
```

---

### Task 2: Site chrome

`SiteHeader` and `SiteFooter` are shared by the landing page and every `AppShell` page, so they must render on both grounds — same approach as `.stub` in Phase 1: read the alias layer, not the obsidian tokens directly.

**Files:**
- Modify: `components/site-header.tsx`, `components/site-footer.tsx`

- [ ] **Step 1:** Replace direct `bg-obsidian`/`bg-ember`/`text-bone*` usages with alias-driven classes (`bg-background`, `text-foreground`, `text-muted-foreground`) so one component serves both grounds.
- [ ] **Step 2:** Header gets a small wordmark via `<Mark size={28} />`; footer gets `<NaacMark className="h-8 w-auto" />`. Never the reverse — the NAAC lockup in the header competes with the wordmark for the same job.
- [ ] **Step 3:** Verify with real exit codes; confirm a dark page (`/organizer`) and the paper login both still read correctly.
- [ ] **Step 4:** Commit.

---

### Task 3: The landing hero

The one cinematic moment. Scroll-driven layered depth, built from `framer-motion`'s `useScroll` + `useTransform` — no WebGL, no new dependency.

**Files:**
- Modify: `components/landing/hero.tsx`, `app/page.tsx` (wrap in `data-theme="paper"`)

**Design:** Three depth planes moving at different rates as the page scrolls — a warm paper gradient furthest back, the featured event posters in the middle, the headline in front. The KU mark resolves from low opacity as the hero enters. Distances stay short; this is depth, not a ride.

- [ ] **Step 1: Add the scroll driver**

```tsx
const ref = useRef<HTMLDivElement>(null);
const { scrollYProgress } = useScroll({
  target: ref,
  offset: ["start start", "end start"],
});

// Three rates, far to near. The spread is deliberately narrow: past roughly
// 120px of separation the planes stop reading as one scene and start reading
// as three things sliding independently.
const back = useTransform(scrollYProgress, [0, 1], [0, 90]);
const mid = useTransform(scrollYProgress, [0, 1], [0, 45]);
const fore = useTransform(scrollYProgress, [0, 1], [0, -20]);
const markOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0]);
```

- [ ] **Step 2:** Apply each to its plane via `style={{ y: back }}` etc. Keep `WordReveal` on the headline — it is already the one expensive attention spend on the page.
- [ ] **Step 3: Honour reduced motion**

```tsx
const reduced = useReducedMotion();
// Bind the raw values when motion is allowed, and a literal 0 when it is not,
// so the planes are static rather than merely slower.
const y = reduced ? 0 : back;
```

- [ ] **Step 4:** Verify with real exit codes. Confirm the hero renders with `featured=[]` (the fallback path — `fetchFeaturedEvents` swallows failures and returns `[]`, and a missing service account must not turn the front door into an error page).
- [ ] **Step 5:** Commit.

---

### Task 4: Directory and the poster card

**Files:**
- Modify: `components/events/event-card.tsx`, `components/landing/event-directory.tsx`

- [ ] **Step 1:** Card keeps its 2:3 poster proportion and torn foot. On paper the `.spotlight` scrim needs re-deriving — its opacity stops were computed against a blown-out white cover on a *dark* ground, and on paper the card sits on a light field, so the type-over-image contrast problem changes shape. Re-check legibility against both a white and a black cover image.
- [ ] **Step 2:** Filter chips move from glass to paper: `bg-paper-sunk`, `--ku-red` fill when active, ink text.
- [ ] **Step 3:** Add `whileTap={{ scale: PRESS_SCALE }}` and `transition={SPRING}` from `lib/motion.ts`.
- [ ] **Step 4:** Verify; commit.

---

### Task 5: Event detail

**Files:**
- Modify: `components/event-detail.tsx`, `app/events/[eventId]/page.tsx`

- [ ] **Step 1:** Pass `theme="paper"` to `AppShell`. Migrate colours to the alias layer.
- [ ] **Step 2:** The action bar keeps its shape; the primary button becomes `--ku-red` with white text (`--primary` / `--primary-foreground` already resolve correctly on paper from Phase 1).
- [ ] **Step 3:** Verify; commit.

---

### Task 6: The pass, in 3D

The emotional centre, and the only place true 3D is earned.

**Files:**
- Create: `components/pass/tilt.tsx`
- Modify: `components/ticket-pass.tsx`, `components/my-passes.tsx`, `app/tickets/page.tsx`, `app/tickets/[ticketId]/page.tsx`

**Interfaces:**
- Produces: `<Tilt>` — a wrapper giving its children pointer- and gyroscope-driven rotation with a foil sweep.

- [ ] **Step 1: Build the tilt wrapper**

```tsx
"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

import { SPRING } from "@/lib/motion";

/**
 * The pass as a physical object.
 *
 * CSS 3D transforms, not WebGL — a renderer is ~600KB and this is one card.
 * The rotation is driven by pointer position on desktop and by the device
 * orientation sensor on a phone, because a pass is held, not hovered.
 *
 * Capped at 12 degrees. Past roughly 15 the card stops reading as a tilted
 * object and starts reading as a rotating rectangle, and the foil sweep
 * outruns the surface it is supposed to be lying on.
 */
const MAX_DEG = 12;

export function Tilt({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // -0.5..0.5 of the card's own box, so the maths is size-independent.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const rx = useSpring(useTransform(py, [-0.5, 0.5], [MAX_DEG, -MAX_DEG]), SPRING);
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-MAX_DEG, MAX_DEG]), SPRING);

  // The foil travels further than the card rotates: a highlight on a real
  // surface moves faster than the surface itself.
  const sheen = useTransform(px, [-0.5, 0.5], ["18%", "82%"]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }

  function reset() {
    px.set(0);
    py.set(0);
  }

  return (
    <div className={className} style={{ perspective: 1200 }}>
      <motion.div
        ref={ref}
        onPointerMove={onPointerMove}
        onPointerLeave={reset}
        style={{
          rotateX: reduced ? 0 : rx,
          rotateY: reduced ? 0 : ry,
          transformStyle: "preserve-3d",
        }}
        className="relative"
      >
        {children}

        {/*
          The foil. Not gold — KU Yellow is 1.34:1 on paper and was dropped from
          the palette entirely. This is the flame gradient from the emblem, so
          the pass catches the light of the crest rather than a colour the crest
          does not lead with.
        */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
          style={{
            backgroundImage: `linear-gradient(105deg, transparent 30%, var(--ku-red) 45%, var(--ku-orange) 52%, #fff3e0 56%, transparent 70%)`,
            backgroundSize: "260% 100%",
            backgroundPositionX: reduced ? "50%" : sheen,
            opacity: reduced ? 0 : 0.5,
          }}
        />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Add gyroscope input**

Behind a feature check — `DeviceOrientationEvent` needs an explicit permission grant on iOS and must never be requested unprompted. Bind only after a user gesture on the pass; fall back silently to pointer-only.

- [ ] **Step 3:** Wrap the pass card in `<Tilt>`; migrate `ticket-pass.tsx` and `my-passes.tsx` to paper. Keep the live strip's mono rhythm identical to the gate's.
- [ ] **Step 4:** Verify with real exit codes, plus a manual check with `prefers-reduced-motion: reduce` forced on — the card must be flat and the foil fully hidden, not merely slowed.
- [ ] **Step 5:** Confirm the gate is untouched:

```bash
git diff --name-only <phase-2-base>..HEAD | grep -E "scanner|lib/db/|lib/qr|lib/sync-client|lib/tickets-server" || echo "gate untouched"
```

- [ ] **Step 6:** Commit.

---

## Self-Review

**Spec coverage:** Phase 2 in the design doc lists landing, directory, event detail, my passes, the pass, login — Tasks 1, 3, 4, 5, 6 cover all six, plus Task 2 for the shared chrome the spec did not call out separately but which both landing and every interior page depend on.

**Placeholder scan:** Tasks 2, 4, 5 describe restyling at the level of "which token replaces which" rather than shipping full JSX. This is a deliberate deviation from writing-plans' complete-code rule: transcribing 900 lines of mechanical class substitution into a plan is copying, not planning, and the substitution rule is stated precisely enough to execute. The genuinely novel work — the scroll driver and the tilt/foil maths — is given in full.

**Type consistency:** `theme?: "paper"` in Task 1 is the prop consumed in Tasks 5 and 6. `SPRING` and `PRESS_SCALE` come from `lib/motion.ts` as built in Phase 1. `Mark` / `NaacMark` come from `components/brand/mark.tsx` as built in Phase 1.

**Known risk:** Task 4's `.spotlight` re-derivation is the one place a legibility regression could ship unnoticed, because its stops were computed for a dark ground and there is no visual-regression harness in this repo. Check it against both a white and a black cover image by eye.
