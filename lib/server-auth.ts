import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { isUniversityEmail } from "@/lib/auth-domain";
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
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
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

  if (!isUniversityEmail(decoded.email)) {
    throw new AuthError("Account is outside the university domain.", 403);
  }

  const snap = await adminDb().collection("users").doc(decoded.uid).get();
  if (!snap.exists) {
    throw new AuthError("No profile for this account.", 403);
  }

  const profile = snap.data() as UserProfile;

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new AuthError(
      `Requires one of: ${allowedRoles.join(", ")}.`,
      403,
    );
  }

  return {
    uid: decoded.uid,
    email: decoded.email!,
    role: profile.role,
    name: profile.full_name ?? decoded.name ?? decoded.email!,
  };
}
