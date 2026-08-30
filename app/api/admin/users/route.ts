import { NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase-admin";
import { isUniversityEmail } from "@/lib/auth-domain";
import { AuthError, requireCaller } from "@/lib/server-auth";
import type { UserProfile, UserRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES: UserRole[] = ["student", "scanner", "organizer"];

/**
 * Lists users for the super admin panel.
 *
 * Reads run server-side rather than from the client so a plain student can
 * never enumerate the directory — `firestore.rules` lets you read your own
 * profile and nobody else's, and this route is the deliberate exception,
 * gated on `superadmin`.
 */
export async function GET(request: Request) {
  try {
    await requireCaller(request, ["superadmin"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  // Firestore has no substring search. The user table for one university is
  // small enough to filter in memory; if this ever needs to scale, the answer
  // is a search index, not a cleverer query.
  const snap = await adminDb().collection("users").limit(1000).get();

  const users = snap.docs
    .map((doc) => {
      const data = doc.data() as UserProfile;
      return {
        uid: doc.id,
        email: data.email ?? "",
        full_name: data.full_name ?? "",
        role: (data.role ?? "student") as UserRole,
        photo_url: data.photo_url ?? null,
      };
    })
    .filter((user) => {
      if (!search) return true;
      return (
        user.email.toLowerCase().includes(search) ||
        user.full_name.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "en-IN"));

  return NextResponse.json({ ok: true, users });
}

/**
 * Changes a user's role.
 *
 * Three things this refuses to do, each of which would be a way to lock the
 * university out of its own admin panel or quietly escalate:
 *
 *  - grant `superadmin` (that stays a manual, out-of-band act)
 *  - change your own role (no self-demotion, no accidental lockout)
 *  - touch an account outside the university domain
 */
export async function PATCH(request: Request) {
  let caller;
  try {
    caller = await requireCaller(request, ["superadmin"]);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let body: { uid?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof body.uid !== "string" || !body.uid) {
    return NextResponse.json({ error: "`uid` is required." }, { status: 400 });
  }

  if (
    typeof body.role !== "string" ||
    !ASSIGNABLE_ROLES.includes(body.role as UserRole)
  ) {
    return NextResponse.json(
      {
        error: `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}. Super admin is granted out of band.`,
      },
      { status: 400 },
    );
  }

  if (body.uid === caller.uid) {
    return NextResponse.json(
      { error: "You cannot change your own role. Ask another super admin." },
      { status: 400 },
    );
  }

  const ref = adminDb().collection("users").doc(body.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    return NextResponse.json({ error: "No such user." }, { status: 404 });
  }

  const target = snap.data() as UserProfile;

  if (!isUniversityEmail(target.email)) {
    return NextResponse.json(
      { error: "That account is outside the university domain." },
      { status: 400 },
    );
  }

  if (target.role === "superadmin") {
    return NextResponse.json(
      { error: "Super admins cannot be demoted from here." },
      { status: 403 },
    );
  }

  await ref.update({ role: body.role, updated_at: Date.now() });

  return NextResponse.json({ ok: true, uid: body.uid, role: body.role });
}
