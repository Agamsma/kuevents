import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { authorize, parseBearerToken } from "@/lib/auth-decision";
import type { UserProfile, UserRole } from "@/lib/types";

export interface AuthedCaller {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 503,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Verifies the `Authorization: Bearer <firebase-id-token>` header and resolves
 * the caller's role from Firestore.
 *
 * The role deliberately comes from the `users` document rather than the token's
 * custom claims: an organizer demoted mid-event should lose scanner access on
 * their next request, not an hour later when their token expires.
 */
export async function requireCaller(
  request: Request,
  allowedRoles?: UserRole[],
): Promise<AuthedCaller> {
  // Parsing and the authorisation decisions live in `lib/auth-decision.ts`,
  // where they are pure and therefore tested. This function is the I/O around
  // them: verify the signature, load the profile.
  const token = parseBearerToken(request.headers.get("authorization"));

  if (!token) {
    throw new AuthError("Missing bearer token.", 401);
  }

  // Resolved before the verification try/catch on purpose. If the Admin SDK
  // cannot start — no service account, malformed key — that is a 503 the
  // operator must fix, not a 401 telling a marshal at the gate to sign in
  // again. Collapsing the two makes a misconfigured deploy look like every
  // device having simultaneously expired.
  let verifier;
  try {
    verifier = adminAuth();
  } catch (error) {
    console.error("[auth] Admin SDK unavailable", error);
    throw new AuthError(
      "Server auth is not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY.",
      503,
    );
  }

  let decoded;
  try {
    // `checkRevoked` costs an extra lookup but means a revoked gate device
    // stops syncing immediately rather than at token expiry.
    decoded = await verifier.verifyIdToken(token, true);
  } catch {
    throw new AuthError("Invalid or expired session.", 401);
  }

  /*
   * The profile is read before the domain is checked, which costs one lookup
   * for an account that was never going to be admitted. Worth it: `authorize`
   * then answers with the whole picture in one place, and the order of the
   * refusals is decided there — in a pure function with tests — rather than
   * being an emergent property of how this function happens to be sequenced.
   */
  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  const profile = snap.exists ? (snap.data() as UserProfile) : undefined;

  const decision = authorize({
    email: decoded.email,
    profileExists: snap.exists,
    profileRole: profile?.role,
    allowedRoles,
  });

  if (!decision.ok) {
    throw new AuthError(decision.refusal.message, decision.refusal.status);
  }

  return {
    uid: decoded.uid,
    email: decoded.email!,
    role: decision.role,
    name: profile?.full_name ?? decoded.name ?? decoded.email!,
  };
}
