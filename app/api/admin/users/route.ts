import { NextResponse } from "next/server";

import { ApiError, apiRoute, readJson } from "@/lib/api-handler";
import { adminDb } from "@/lib/firebase-admin";
import { isUniversityEmail } from "@/lib/auth-domain";
import { requireCaller } from "@/lib/server-auth";
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
export const GET = apiRoute("admin users list", async (request) => {
  await requireCaller(request, ["superadmin"]);

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
});

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
export const PATCH = apiRoute("admin users patch", async (request) => {
  const caller = await requireCaller(request, ["superadmin"]);

  const body = await readJson<{ uid?: unknown; role?: unknown }>(request);

  if (typeof body.uid !== "string" || !body.uid) {
    throw new ApiError("`uid` is required.", 400);
  }

  if (
    typeof body.role !== "string" ||
    !ASSIGNABLE_ROLES.includes(body.role as UserRole)
  ) {
    throw new ApiError(
      `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}. Super admin is granted out of band.`,
      400,
    );
  }

  if (body.uid === caller.uid) {
    throw new ApiError(
      "You cannot change your own role. Ask another super admin.",
      400,
    );
  }

  const ref = adminDb().collection("users").doc(body.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new ApiError("No such user.", 404);
  }

  const target = snap.data() as UserProfile;

  if (!isUniversityEmail(target.email)) {
    throw new ApiError("That account is outside the university domain.", 400);
  }

  if (target.role === "superadmin") {
    throw new ApiError("Super admins cannot be demoted from here.", 403);
  }

  await ref.update({ role: body.role, updated_at: Date.now() });

  return NextResponse.json({ ok: true, uid: body.uid, role: body.role });
});
