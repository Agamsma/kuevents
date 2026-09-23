/**
 * Attaches the generated demo covers in `public/demo/` to the events that have
 * none, so the poster variant of the directory card can actually be looked at.
 *
 *   node scripts/demo-covers.mjs          # make the images first
 *   node scripts/demo-covers-apply.mjs    # attach them
 *   node scripts/demo-covers-apply.mjs --revert
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.
 *
 * TWO DELIBERATE LIMITS, because this writes to a real database:
 *
 *   It only ever touches an event whose `cover_image_url` is empty, so an
 *   organizer's real artwork can never be overwritten by a demo gradient.
 *
 *   `--revert` clears only the covers this script set, matched against the
 *   known `/demo/` paths — never a cover that came from Storage.
 *
 * The paths written are root-relative (`/demo/x.png`), which is why this is a
 * demo aid and not a seeding feature: real covers live in Firebase Storage and
 * go through `lib/storage.ts`. `next/image` serves a local path from our own
 * origin without touching `remotePatterns`, and the CSP allows `img-src
 * 'self'`, so these render under exactly the same rules as production art.
 */

import { readFileSync } from "node:fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnvLocal();

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT_KEY is not set in .env.local.");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/** Every path this script is allowed to write or clear. */
const COVERS = [
  "/demo/dental.png",
  "/demo/moot-court.png",
  "/demo/colloquium.png",
  "/demo/media-fest.png",
  "/demo/design-summit.png",
  "/demo/b-plan.png",
];

/*
 * Nudges a cover toward an event whose subject it suits. Purely cosmetic — an
 * event matching nothing still gets one, just by position.
 */
const AFFINITY = [
  [/dental|health|clinic|screen/i, "/demo/dental.png"],
  [/moot|court|law|debate/i, "/demo/moot-court.png"],
  [/doctoral|colloquium|research|symposium|seminar/i, "/demo/colloquium.png"],
  [/media|newsroom|film|journal/i, "/demo/media-fest.png"],
  [/design|summit|architect|studio/i, "/demo/design-summit.png"],
  [/b-plan|business|pitch|startup|venture/i, "/demo/b-plan.png"],
];

const revert = process.argv.includes("--revert");

async function main() {
  const snap = await db.collection("events").get();

  if (snap.empty) {
    console.log("No events found.");
    return;
  }

  let touched = 0;
  const used = new Set();

  for (const doc of snap.docs) {
    const data = doc.data();
    const current = data.cover_image_url ?? null;

    if (revert) {
      // Only ever clears a path this script could have written.
      if (current && COVERS.includes(current)) {
        await doc.ref.update({ cover_image_url: null });
        console.log(`cleared   ${data.title}`);
        touched += 1;
      }
      continue;
    }

    // Never overwrite artwork somebody actually uploaded.
    if (current) {
      console.log(`skipped   ${data.title} (already has a cover)`);
      continue;
    }

    const title = String(data.title ?? "");
    const match = AFFINITY.find(([re, path]) => re.test(title) && !used.has(path));
    const cover =
      match?.[1] ?? COVERS.find((path) => !used.has(path)) ?? COVERS[touched % COVERS.length];

    used.add(cover);

    await doc.ref.update({ cover_image_url: cover });
    console.log(`set       ${data.title.padEnd(34)} ${cover}`);
    touched += 1;
  }

  console.log(
    revert
      ? `\n${touched} demo cover(s) cleared.`
      : `\n${touched} demo cover(s) attached. Revert with --revert.`,
  );
}

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
