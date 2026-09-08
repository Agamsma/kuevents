"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db, googleProvider } from "@/lib/firebase";
import { SIGNED_IN_HINT_COOKIE } from "@/lib/constants";
import {
  DOMAIN_REJECTION_MESSAGE,
  isUniversityEmail,
} from "@/lib/auth-domain";
import type { UserProfile, UserRole } from "@/lib/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Fresh ID token for calling our own API routes. */
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Mirrors "there is a session" into a cookie the middleware can see.
 *
 * Purely a routing hint — it holds no identity and is trivially forgeable, so
 * nothing security-relevant may branch on it. See `middleware.ts`.
 */
function setSignedInHint(signedIn: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = signedIn
    ? `${SIGNED_IN_HINT_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax${secure}`
    : `${SIGNED_IN_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/**
 * Reads the caller's profile, creating it on first ever login.
 *
 * Role is assigned once and never overwritten here — an admin who promotes a
 * student to `organizer` must not be demoted by their next sign-in.
 */
async function ensureProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const existing = snap.data() as UserProfile;

    // Keep the display fields in step with Google without touching `role`.
    await setDoc(
      ref,
      {
        email: user.email ?? existing.email,
        full_name: user.displayName ?? existing.full_name,
        photo_url: user.photoURL ?? null,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ...existing,
      uid: user.uid,
      email: user.email ?? existing.email,
      full_name: user.displayName ?? existing.full_name,
      photo_url: user.photoURL ?? null,
    };
  }

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email!,
    full_name: user.displayName ?? user.email!.split("@")[0],
    role: "student" satisfies UserRole,
    photo_url: user.photoURL ?? null,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  await setDoc(ref, {
    ...profile,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      // Belt and braces: a session could predate the domain rule, or be minted
      // by a provider that bypassed the sign-in path below.
      if (nextUser && !isUniversityEmail(nextUser.email)) {
        await fbSignOut(auth);
        setSignedInHint(false);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSignedInHint(Boolean(nextUser));
      setUser(nextUser);

      if (nextUser) {
        try {
          setProfile(await ensureProfile(nextUser));
        } catch (error) {
          console.error("[auth] failed to load profile", error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const credential = await signInWithPopup(auth, googleProvider);

    if (!isUniversityEmail(credential.user.email)) {
      // Sign the rejected account straight back out so no partial session
      // lingers in IndexedDB for the next visit.
      await fbSignOut(auth);
      throw new Error(DOMAIN_REJECTION_MESSAGE);
    }

    /*
     * Write the hint cookie here, not only in `onAuthStateChanged`.
     *
     * The listener fires on its own schedule, and the caller navigates the
     * moment this promise resolves. Someone who signs in and immediately taps
     * "My passes" was losing that race: `proxy.ts` saw a protected route with
     * no cookie and bounced them back to /login — from a session that had in
     * fact just succeeded.
     *
     * Setting it synchronously here means the cookie exists before anything can
     * navigate. The listener still sets it, which is harmless and remains the
     * authority for every other path into a session (a reload, a restored
     * session, a sign-out).
     */
    setSignedInHint(true);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const getIdToken = useCallback(async () => {
    return auth.currentUser ? auth.currentUser.getIdToken() : null;
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, signInWithGoogle, signOut, getIdToken }),
    [user, profile, loading, signInWithGoogle, signOut, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}
