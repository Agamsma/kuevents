/**
 * The authorisation decisions, separated from the I/O that feeds them.
 *
 * `requireCaller()` is what stands between an anonymous request and every API
 * route in this app, and it had no tests — not because nobody wanted them, but
 * because it could not have any. It reached straight into `adminAuth()` and
 * `adminDb()`, so exercising even the "wrong role is refused" path meant
 * standing up the Admin SDK and an emulator, and the README says plainly that
 * there is no emulator wired up.
 *
 * So the decisions moved here, where they are pure: header in, verdict out. No
 * Firebase, no network, no clock. `server-auth.ts` keeps the I/O — verify the
 * token, load the profile — and asks these functions what the answer is. The
 * split follows the one the rest of `lib/` already uses, and it is why the
 * refusal paths below are now covered by `auth-decision.test.mts` rather than
 * by hoping.
 *
 * Same statuses and same messages as before the split. This was a refactor with
 * tests attached, not a change of behaviour.
 */

import { isUniversityEmail } from "./auth-domain.ts";
import type { UserRole } from "./types.ts";

/** A refusal, shaped so the caller can throw it as an `AuthError`. */
export interface AuthRefusal {
  status: 401 | 403;
  message: string;
}

/**
 * Extracts the credential from an `Authorization: Bearer <token>` header.
 *
 * Returns null for anything that is not exactly that, which the caller turns
 * into a 401. Deliberately strict:
 *
 *  - the scheme is compared case-insensitively, because RFC 7235 says auth
 *    schemes are case-insensitive and some clients send `bearer`
 *  - a header with more than two parts is refused rather than having its first
 *    token used; a JWT never contains a space, so `Bearer a b` is malformed
 *    input and guessing at its intent is how a parser becomes a vulnerability
 *  - an empty token is refused, so `Bearer ` cannot read as a credential
 */
export function parseBearerToken(
  header: string | null | undefined,
): string | null {
  if (!header) return null;

  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "bearer") return null;

  return token.length > 0 ? token : null;
}

/**
 * Decides whether a verified identity may proceed.
 *
 * Called only after the token's signature has been checked — this function
 * trusts `email` to have come out of a verified token and never from the body,
 * a query parameter or a header. It answers the three questions that remain:
 * is the account inside the university, does it have a profile, and does that
 * profile carry a role the route accepts.
 *
 * `profileRole` is `undefined` when no `users` document exists. That is
 * distinct from a document with a missing role, which is treated as a profile
 * that exists but cannot satisfy any role requirement — a half-written user
 * record must not inherit access.
 */
export function authorize(params: {
  email: string | null | undefined;
  profileExists: boolean;
  profileRole: UserRole | undefined;
  allowedRoles?: UserRole[];
}): { ok: true; role: UserRole } | { ok: false; refusal: AuthRefusal } {
  const { email, profileExists, profileRole, allowedRoles } = params;

  if (!isUniversityEmail(email)) {
    return {
      ok: false,
      refusal: {
        status: 403,
        message: "Account is outside the university domain.",
      },
    };
  }

  if (!profileExists) {
    return {
      ok: false,
      refusal: { status: 403, message: "No profile for this account." },
    };
  }

  /*
   * Checked before the role comparison rather than defaulted to "student".
   *
   * Defaulting would mean a user document that somehow lost its `role` still
   * passed any route allowing students. A profile that cannot state its own
   * role is refused.
   */
  if (!profileRole) {
    return {
      ok: false,
      refusal: { status: 403, message: "No profile for this account." },
    };
  }

  if (allowedRoles && !allowedRoles.includes(profileRole)) {
    return {
      ok: false,
      refusal: {
        status: 403,
        message: `Requires one of: ${allowedRoles.join(", ")}.`,
      },
    };
  }

  return { ok: true, role: profileRole };
}
