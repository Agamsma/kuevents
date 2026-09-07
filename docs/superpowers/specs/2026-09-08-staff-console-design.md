# KU Events — the staff console

**Date:** 2026-09-08
**Status:** approved

---

## Why

One account does two jobs, and the interface makes no distinction. Signed in as
a superadmin, `SiteHeader` renders *Events, My passes, My proposals, Dashboard,
Gate, Admin* in a single row — a student's shop window and a marshal's control
panel competing for the same strip of screen. Neither reads clearly.

The fix is information architecture, not authentication.

### What this is NOT

**`/staff/login` is signage, not a lock.** It is the same Google sign-in against
the same account; what differs is where it sends you and what it says. Anyone
may type `/staff` directly.

What actually stops them is unchanged and lives elsewhere:

- `AuthGuard` decides what *renders*
- `requireCaller()` re-reads the role from the `users` document on **every** API
  request — so a demoted organizer loses access on their next request
- `firestore.rules` refuses the data regardless of what any page does

A second door must not create the impression of a second lock. Anyone reading
this later should find that stated plainly rather than inferring a boundary that
was never built.

Separate *credentials* were considered and rejected: they would mean provisioning
and recovering a second account per staff member, for a platform serving one
university, to solve a problem that is presentational.

---

## Route tree

There are four real staff surfaces. `/organizer` and `/dashboard/requests` are
already redirects into a tabbed `/dashboard` — this spec follows that existing
pattern rather than inventing one.

| New | Today | Who may enter |
| --- | --- | --- |
| `/staff` | `/dashboard` — tabbed review + events | organizer, superadmin |
| `/staff/events/[eventId]` | `/organizer/[eventId]` — attendee roster | organizer, superadmin |
| `/staff/people` | `/admin` — roles | superadmin |
| `/staff/login` | *new* | anyone; role decides what happens next |
| `/scanner` | unchanged | scanner, organizer, superadmin |

**Redirects.** Every old path is kept and redirects, because these are in the
wild — bookmarks, and links already sent to organizers:

```
/dashboard            → /staff
/dashboard/requests   → /staff?tab=requests
/organizer            → /staff?tab=events
/organizer/[eventId]  → /staff/events/[eventId]
/admin                → /staff/people
```

`/proposals` stays a student route. "My proposals" is a person's own
submissions, and a staff member submitting an event is acting as a member of the
campus, not as staff.

---

## The two shells

### `StaffShell`

Replaces `AppShell` inside `/staff`. Same paper ground — recognisably the same
product — but denser, because this is a working console rather than a shop
window.

Carries: the wordmark with a **STAFF** marker, staff-only navigation, the
signed-in email and the role that actually resolved, sign out, and a quiet
*Back to student site* link.

Showing the resolved role permanently is deliberate. Role is the thing that
decides what works, it can change under you mid-session, and "why can't I see
the review queue" is answered instantly by a console that always says what it
thinks you are.

### `SiteHeader`

**Drops every staff link.** Dashboard, Gate and Admin disappear from the student
header. In their place, one quiet *Staff console* link, rendered only when the
viewer's role has somewhere to go.

This single change is what resolves the reported problem. Everything else in
this spec follows from it.

---

## `/staff/login`

Same provider, same domain predicate in `lib/auth-domain.ts`. Three states:

| State | Behaviour |
| --- | --- |
| Signed in, has a staff role | Redirect to `/staff` |
| Signed in, no staff role | Refusal naming the account and the resolved role, with a way back to the student site |
| Not signed in | Google sign-in, then re-evaluate as above |

The refusal reuses `AuthGuard`'s existing screen rather than inventing a second
one. That screen already names the account and the role it resolved to, which is
exactly the information someone in this state needs — "you are signed in, just
not for this" is a different message from "you are signed out", and conflating
them is how support conversations start.

---

## The gate stays bare

`/scanner` appears in the staff navigation but opening it drops all chrome — no
header, no nav, full-bleed dark, exactly as today.

A marshal works one-handed, at night, on battery, with a queue in front of them.
Navigation furniture on that screen costs viewport and invites a mis-tap
adjacent to a verdict. It gets a small *Back to staff* affordance in its idle
state only, never over a scan result.

**The scanner's code is not touched by this work.** Only a link points at it.

---

## Constraints

- **`/scanner`, `lib/db/`, `lib/qr.ts`, `lib/sync-client.ts`, `lib/tickets-server.ts` are not modified.**
- `proxy.ts` gains `/staff` in `PROTECTED_PREFIXES`. As documented in that file,
  this is a UX shortcut on a client-writable hint cookie, not a boundary.
- No change to roles, to `requireCaller()`, or to `firestore.rules`. This work
  moves pages; it does not touch authorisation.
- No new dependency.
- Staff pages keep the paper ground and the alias token layer, so they continue
  to render correctly on either scale.

---

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` green; the 59 existing tests
  must stay green, none of which touch routing.
- Every redirect exercised: five old paths reach their new destinations.
- `/staff` as a signed-out visitor, as a student, and as an organizer — three
  distinct outcomes, none of them a blank screen.
- The student header shows no staff link for a student, and exactly one for a
  staff member.
- `/scanner` renders with no chrome, and is byte-identical in behaviour.

**Not verifiable without a real session.** Every staff surface sits behind
`AuthGuard`, so the role-dependent outcomes need a signed-in KU account to
confirm. The redirects and the signed-out paths can be checked without one.

---

## Risks

- **The refusal state is the most likely thing to be got wrong**, because it is
  the one nobody tests: a student who follows a staff link should land somewhere
  that explains itself, not on a spinner or an empty console.
- **Redirect loops.** `/staff/login` redirects to `/staff` when a role is
  present, and `/staff` bounces to `/staff/login` when one is absent. If both
  conditions can be true at once — during the moment auth is still resolving —
  the two will ping-pong. The guard is that neither redirects while
  `loading` is true.
- **`?tab=` continuity.** `/dashboard?tab=requests` is an existing URL shape;
  the redirects must preserve the query string or organizers land on the wrong
  tab.
