import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Fail loudly, and in the right place, when the config is missing.
 *
 * Without this, a deploy with no environment variables dies during prerender
 * with `FirebaseError: auth/invalid-api-key` attributed to `/_not-found` — a
 * page that has nothing to do with Firebase. That error sends people hunting
 * through their 404 handling instead of their Vercel project settings.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a missing one here means
 * the variable was absent when `next build` ran, not at runtime.
 */
const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => `NEXT_PUBLIC_FIREBASE_${camelToScreamingSnake(key)}`);

if (missing.length > 0) {
  throw new Error(
    `Firebase is not configured. Missing: ${missing.join(", ")}.\n` +
      "Locally: copy .env.example to .env.local and fill it in.\n" +
      "On Vercel: add these under Project Settings > Environment Variables, " +
      "then redeploy — NEXT_PUBLIC_* values are baked in at build time, so a " +
      "variable added after a build will not appear until you rebuild.",
  );
}

function camelToScreamingSnake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * `getApps()` guard: Next.js hot-reloading re-evaluates this module on every
 * edit, and `initializeApp` throws `duplicate-app` the second time around.
 */
export const app: FirebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

/**
 * Pre-filter the Google account chooser to the university tenant. This is a
 * convenience, NOT a security control — a user can still pick any account, so
 * the domain is re-checked client-side on sign-in and again in Firestore rules.
 */
googleProvider.setCustomParameters({
  hd: process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "",
  prompt: "select_account",
});
