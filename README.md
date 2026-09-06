# KU Events

Event ticketing, proposals and gate check-in for Karnavati University —
kuevents.in

Anyone on campus can propose an event. An organizer approves it. Students
reserve a pass that lives on their phone, and the gate reads it **with no
signal at all** — the constraint the rest of the architecture bends around.

---

## Getting it running

```bash
npm install
npm run dev            # http://localhost:3000
```

`.env.local` carries the Firebase web config. Two server-side values need
filling before anything can be booked, proposed or synced:

| Variable | What it is | Where to get it |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Admin SDK credentials, JSON on one line | Firebase console → Project settings → Service accounts → Generate new private key |
| `TICKET_QR_SECRET` | HMAC key for ticket QR codes | Any long random string. **Rotating it invalidates every QR already issued.** |
| `SYNC_API_KEY` | Optional shared key for gate devices | Any long random string, or leave as-is to disable the check |

> No payment gateway is wired up. Every event is free.

### First run: getting super admin

New accounts are created as `student`, and both `firestore.rules` and
`/api/admin/users` refuse to grant `superadmin` — otherwise anyone could
promote themselves. The first one has to be set out of band:

**Option A — Firebase console.** Sign in once so your profile exists, then open
Firestore → `users` → your document and set `role` to `superadmin`.

**Option B — the seed script.** Needs `FIREBASE_SERVICE_ACCOUNT_KEY`. Also
creates four sample events across all four tracks:

```bash
npm run seed -- you@karnavatiuniversity.edu.in
```

Then deploy the rules:

```bash
firebase deploy --only firestore:rules,storage
```

Once you are super admin, everyone else gets promoted from `/admin`.

### Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm test            # offline scan-logic tests (node:test + fake-indexeddb)
npm run typecheck   # tsc --noEmit
npm run seed        # sample events; promotes an account to superadmin
```

> The gate scanner needs a camera, and browsers only grant that over HTTPS or on
> `localhost`. To test on a phone, tunnel the dev server (`ngrok http 3000`)
> rather than using the LAN IP.

### Node 22 or newer is a hard requirement

`firebase-admin` v14 declares `engines: { node: ">=22" }`, and it is imported by
every API route. On an older Node the package fails **at import**, which means
the route module never loads — so instead of a useful error you get a bare 500
with an empty body from every single endpoint, while pages and middleware carry
on working normally. It looks like a credentials problem and is not one.

`engines` in `package.json` pins this, and hosts read it. If you are on Vercel,
check **Project Settings → General → Node.js Version** as well: a project
created before this was set may still be pinned to an older major, and the
project setting is what applies when a build starts.

---

## Roles

| Role | Can |
| --- | --- |
| `student` | Browse the directory, reserve passes, **propose events** |
| `scanner` | The above, plus run the gate scanner |
| `organizer` | The above, plus review proposals, publish events, see attendees |
| `superadmin` | The above, plus assign roles at `/admin` |

Roles are read from the `users` document on **every** API request rather than
from a token claim, so an organizer demoted mid-event loses access on their next
request instead of an hour later when their token expires.

## The proposal workflow

```
student fills /events/request
        ↓  POST /api/events/propose  →  status: "pending", organizer_uid: null
organizer opens /dashboard/requests
        ↓  approve → status: "published", and the approver becomes organizer_uid
        ↓  reject  → status: "rejected", kept on record with a written reason
published events appear on the directory; students reserve passes
```

Two decisions worth knowing:

- **Rejections are kept, not deleted.** A student who is told "no" with no trace
  and no reason does not propose again. The note is required by the UI for
  exactly that reason.
- **Approving transfers ownership.** The organizer who approves becomes
  `organizer_uid`, because from that moment they are accountable for the venue,
  the roster and the gate. A proposal has no owner until someone takes it.

---

## Layout

```
app/
  page.tsx                   landing: hero + filterable directory (public hero)
  login/                     Google OAuth, domain-restricted
  events/[eventId]/          event detail
  events/request/            multi-step proposal form
  tickets/                   your passes
  tickets/[ticketId]/        the digital pass
  dashboard/requests/        organizer approval board
  organizer/                 event management
  organizer/[eventId]/       attendee list + CSV export
  admin/                     super admin: people & roles
  scanner/                   the gate console
  api/events/                create + lifecycle transitions
  api/events/propose/        student proposals
  api/admin/users/           list + assign roles (superadmin only)
  api/tickets/issue/         booking
  api/sync/                  bulk upload of offline check-ins
lib/
  db/indexeddb.ts            Dexie roster cache and outbox  ← the core
  firestore-queries.ts       reads shaped to need no composite indexes
  qr.ts                      ticket HMAC + live badge code
  storage.ts                 cover image upload
firestore.rules              the actual authorisation boundary
storage.rules                cover upload limits that actually hold
```

### The domain guard lives in three places, on purpose

`@karnavatiuniversity.edu.in` is checked at sign-in (client), on every API call
(server), and in Firestore rules (database). All three call the same predicate
in `lib/auth-domain.ts`. Google's `hd` parameter narrows the account chooser but
is **not** a control — a user can still pick any account.

`proxy.ts` (Next 16's renamed middleware) only redirects on a client-writable
hint cookie and sets security headers. It is a UX shortcut, not a boundary.

### Why the gate scanner is built the way it is

The scan path never awaits the network. A marshal scans a QR and the verdict
comes out of IndexedDB in single-digit milliseconds:

1. **Before doors open**, download the roster — every ticket cached into Dexie.
2. **On each scan**, `resolveScan()` decides admitted / duplicate / cancelled /
   wrong-event / not-found, flips the local row and appends to the outbox — all
   in **one transaction**, so a crash between the two cannot double-admit or
   lose a check-in.
3. **When connectivity returns**, the outbox drains to `/api/sync` in batches,
   retrying on failure and never dropping work.

`checked_in` is stored as `0 | 1`, not a boolean: IndexedDB cannot index
booleans, so a `true` would be silently dropped from the compound index and the
live "N admitted" counter would read zero forever. There is a test for exactly
that, and another for scans stranded in-flight by a crash.

### Conflicts between two gates

Two entrances scanning the same pass while both offline will disagree. The
server resolves it: **the earliest `check_in_time` wins**, the later one comes
back as a duplicate, and the device corrects its local roster. Every scan —
including refusals — is written to `check_in_logs` under a deterministic id, so
replaying a batch overwrites its own row instead of inflating the audit trail.

### QR codes and screenshots

The QR encodes `HMAC-SHA256(ticket_id:event_id:user_id)` keyed by
`TICKET_QR_SECRET`. It is unforgeable (students never see the key) and
offline-verifiable (the scanner matches against a cached roster, needing neither
network nor key).

The pass also shows a live strip — a ticking clock and a code that rolls every
30s. **Be clear-eyed about what this does:** it makes a *static screenshot*
obvious to a marshal, because a captured pass has a frozen clock. It does not
stop someone screen-sharing a live pass. What actually stops sharing is that a
pass admits exactly once; the second person gets a full-screen red refusal
showing when the first walked in.

---

## Design

The ground is a near-black with a warm red undertone rather than a neutral
charcoal, so the crimson accents read as part of the same material instead of
sitting on a grey field. Everything lifts in warm steps: obsidian → ember → ash.

**Crimson** is the university's colour and carries brand and action. **Gold** is
scarce on purpose — it marks the single most important thing on a screen and
nothing else, which is what keeps it legible as "this matters". The one glowing
element on the landing page is the *Organize an event* button.

Both are reconciled to KU's published brand identity — KU Red `#C02722`, KU
Yellow `#F7D70A`, KU Orange `#F78543`. Every accent holds the official OKLCH
*hue* exactly and moves only lightness, because on a near-black ground the two
colours fail in opposite directions: KU Red is too **dark** (`#C02722` measures
3.40:1 on the obsidian ground, failing AA for text) while KU Yellow is too
**bright** (14.02:1, far too loud for a colour whose job is scarcity). So red
lifts, yellow drops, and they meet in a legible band. That is the whole scale.

One tension worth being accurate about: crimson is the brand *and* red is the
gate's refusal. They are **not** far apart in colour — brand crimson sits at
L 0.616 / hue 27.9 and the refusal at L 0.658 / hue 21.6, about 0.04 in
lightness and 6 degrees in hue. Side by side at the same size they would be
hard to tell apart, and no amount of tuning fixes that while crimson stays
faithful to KU Red.

What separates them is **deployment scale, not value.** Brand crimson only ever
appears small — a chip, a rule, a button, a focus ring. A refusal floods the
entire viewport. At a gate you never read a small red chip; the whole screen is
the signal, and that is the distinction the marshal is actually reading.

Text is bone, never pure white. Pure white on near-black is the harsh,
fatiguing combination this interface is specifically trying not to be.

**The signature is perforation.** Every surface is an admission stub — punched
notches, a dashed tear line, monospaced field labels above each value. The
directory card, the pass, the proposal form and the gate console all speak one
physical language. `components/ui/stub.tsx` is the whole system.

The directory card is a **portrait poster**, 2:3 — the proportion of a printed
event bill — with the title, venue and time set over the image rather than in a
panel below it. An event is sold by its artwork, and a landscape band across the
top of a text card gave the artwork the smaller half. The stub vernacular
survives the move: the notches and tear line drop to a short torn foot, so the
card still reads as a picture stapled to a pass. Type over an arbitrary photo is
held legible by `.spotlight`, whose opacity stops are derived against a
blown-out white cover in `app/globals.css` rather than eyeballed.

Type does three jobs: **Fraunces** carries the brand voice (a soft, high-contrast
serif with optical sizing and a "wonk" axis — warm at display sizes rather than
institutional), **Instrument Sans** reads underneath it, **JetBrains Mono**
handles every code, count and timestamp.

Motion is one curve and one distance, everywhere, via
`components/motion/reveal.tsx`. The hero's ambient orbs run on 26–38 second
cycles: long enough that nothing catches the eye deliberately. All of it is
disabled by `prefers-reduced-motion`.

---

## Data model

| Collection | Written by | Notes |
| --- | --- | --- |
| `users` | client (create/self-update only) | `role` moves only through `/api/admin/users` |
| `events` | **server only** | proposals and events both minted server-side |
| `tickets` | **server only** | clients can never create one or flip `checked_in` |
| `check_in_logs` | **server only** | append-only audit trail |

Capacity and the one-pass-per-student rule are enforced *inside* the booking
transaction. Checking them beforehand would let two simultaneous taps both pass
and oversell the venue.

No composite indexes are required — every query is shaped to run on Firestore's
automatic single-field indexes. See `lib/firestore-queries.ts` for why.

---

## Known gaps

- **The attendee list and approval board are snapshots**, not live feeds. Both
  read once and refresh on demand. A Firestore `onSnapshot` subscription would
  make them tick by themselves, which is worth doing before a real event.
- **Two organizers can open the same proposal.** Whoever decides first wins and
  the row leaves the other's queue only on their next load. A `reviewing_by`
  lease would close it; at the volume of one university's proposals, it has not
  been worth the complexity.
- **No email notification** when a proposal is approved or rejected. The
  decision and its reason are stored on the event; nothing delivers them yet.
- **Tests cover the offline scan logic only** — the part where a bug means
  someone gets turned away at a real gate. API routes are typechecked and
  manually exercised, not unit-tested.
