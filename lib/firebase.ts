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
