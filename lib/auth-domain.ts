/**
 * The single source of truth for "is this a Karnavati account?".
 *
 * Imported by the client (sign-in), the API routes (token verification) and the
 * middleware, so the rule can never drift between layers.
 */

export const ALLOWED_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "karnavatiuniversity.edu.in";

export function isUniversityEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  // Compare only the domain part, lower-cased. Matching on `endsWith` over the
  // whole address would also accept `attacker@evil-karnavatiuniversity.edu.in`.
  const at = email.lastIndexOf("@");
  if (at === -1) return false;

  return email.slice(at + 1).toLowerCase() === ALLOWED_EMAIL_DOMAIN.toLowerCase();
}

export const DOMAIN_REJECTION_MESSAGE = `Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in to KU Events.`;
