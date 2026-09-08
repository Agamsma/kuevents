/**
 * Seeds Firestore with a couple of events and promotes an account to organizer,
 * so there is something to look at on first run.
 *
 *   npm run seed -- you@karnavatiuniversity.edu.in
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env.local. Safe to re-run: events
 * are written to fixed ids, so it updates rather than duplicating.
 */

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

loadEnvLocal();

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error(
    "FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local.\n" +
      "Firebase console > Project settings > Service accounts > Generate new private key,\n" +
      "then paste the JSON on one line.",
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(
  raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const events = [
  {
    id: "seed-techfest-2026",
    title: "Techfest 2026 — Opening Night",
    description:
      "Keynote, robotics showcase and the inter-college hackathon kickoff. Doors at six, badges at the desk.",
    venue: "Main Auditorium, UnitedWorld Campus",
    starts_at: now + 2 * DAY,
    ends_at: now + 2 * DAY + 4 * 60 * 60 * 1000,
    status: "published",
    track: "UIT",
    category: "Hackathon",
    expected_footfall: 400,
    capacity: 400,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-design-summit",
    title: "Karnavati Design Summit",
    description: "Portfolio reviews and studio talks with visiting designers.",
    venue: "UID Block B, Studio 4",
    starts_at: now + 9 * DAY,
    ends_at: now + 9 * DAY + 6 * 60 * 60 * 1000,
    status: "published",
    track: "UID",
    category: "Workshop",
    expected_footfall: 120,
    capacity: 120,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-moot-court",
    title: "National Moot Court Rounds",
    description:
      "Preliminary rounds, open to spectators. Formals only in the courtroom.",
    venue: "UWSL Moot Court Hall",
    starts_at: now + 5 * DAY,
    ends_at: now + 5 * DAY + 8 * 60 * 60 * 1000,
    status: "published",
    track: "UWSL",
    category: "Cultural",
    expected_footfall: 200,
    capacity: 200,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-dental-camp",
    title: "Free Dental Screening Camp",
    description:
      "Open to all students and staff. Walk-ins welcome; bring your ID card.",
    venue: "KSD Clinic Block, Ground Floor",
    starts_at: now + 4 * DAY,
    ends_at: now + 4 * DAY + 6 * 60 * 60 * 1000,
    status: "published",
    track: "KSD",
    category: "Workshop",
    expected_footfall: 300,
    capacity: 0,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-research-colloquium",
    title: "Doctoral Colloquium",
    description:
      "Six-minute thesis pitches from first-year scholars, followed by open Q&A.",
    venue: "KSR Seminar Hall",
    starts_at: now + 6 * DAY,
    ends_at: now + 6 * DAY + 4 * 60 * 60 * 1000,
    status: "published",
    track: "KSR",
    category: "Workshop",
    expected_footfall: 80,
    capacity: 80,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-media-fest",
    title: "Newsroom Live — Media Fest",
    description:
      "A working newsroom for one day: reporting, editing and a 6pm bulletin.",
    venue: "USLM Studio, Block C",
    starts_at: now + 8 * DAY,
    ends_at: now + 8 * DAY + 9 * 60 * 60 * 1000,
    status: "published",
    track: "USLM",
    category: "Cultural",
    expected_footfall: 220,
    capacity: 220,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-bplan-summit",
    title: "B-Plan Pitch Summit",
    description:
      "Student ventures pitch to a panel of alumni founders and investors.",
    venue: "UWSB Auditorium",
    starts_at: now + 10 * DAY,
    ends_at: now + 10 * DAY + 5 * 60 * 60 * 1000,
    status: "published",
    track: "UWSB",
    category: "Workshop",
    expected_footfall: 260,
    capacity: 260,
    tickets_issued: 0,
    cover_image_url: null,
  },
  {
    id: "seed-open-mic",
    title: "Open Mic Night",
    description: "Music, poetry, stand-up. Sign-ups at the door from 7pm.",
    venue: "Amphitheatre, Central Lawn",
    starts_at: now + 3 * DAY,
    ends_at: now + 3 * DAY + 3 * 60 * 60 * 1000,
    status: "published",
    track: "CLUB",
    category: "Unofficial",
    expected_footfall: 150,
    capacity: 150,
    tickets_issued: 0,
    cover_image_url: null,
  },
];

const organizerEmail = process.argv[2];

async function main() {
  let organizerUid = "seed-organizer";

  if (organizerEmail) {
    const snap = await db
      .collection("users")
      .where("email", "==", organizerEmail)
      .limit(1)
      .get();

    if (snap.empty) {
      console.warn(
        `No user found for ${organizerEmail}. Sign in to the app once, then re-run this to be promoted.`,
      );
    } else {
      organizerUid = snap.docs[0].id;
      // Superadmin, not organizer: the first person needs the admin panel to
      // promote everyone else, and nothing in the app can grant that role.
      await snap.docs[0].ref.update({ role: "superadmin" });
      console.log(`Promoted ${organizerEmail} to superadmin.`);
    }
  }

  const batch = db.batch();

  for (const event of events) {
    const { id, ...data } = event;

    const payload = {
      ...data,
      organizer_uid: organizerUid,
      created_by: organizerUid,
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
      starts_at: Timestamp.fromMillis(data.starts_at),
      ends_at: Timestamp.fromMillis(data.ends_at),
      created_at: Timestamp.now(),
    };

    // Write every field except `tickets_issued`, so a re-run cannot clobber a
    // live booking count back to zero. On a first create the field is simply
    // absent, which the booking transaction already reads as 0.
    const mergeFields = Object.keys(payload).filter((k) => k !== "tickets_issued");

    batch.set(db.collection("events").doc(id), payload, { mergeFields });
  }

  await batch.commit();
  console.log(`Seeded ${events.length} events.`);
}

/** Minimal .env.local reader — avoids a dotenv dependency for one script. */
function loadEnvLocal() {
  let contents;
  try {
    contents = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }

  for (const line of contents.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
