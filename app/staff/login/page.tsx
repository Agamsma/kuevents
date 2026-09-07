"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth-domain";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/brand/mark";
import { FieldLabel, Perforation } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

/**
 * The staff front door.
 *
 * A DOOR, NOT A LOCK. This is the same Google sign-in against the same account
 * as `/login`; what differs is where it sends you and what it says when you do
 * not belong. Anyone may type `/staff` directly and skip this page entirely.
 *
 * What actually stops them is unchanged by this file: `AuthGuard` decides what
 * renders, and `requireCaller()` — which re-reads the role from the `users`
 * document on every API request — plus `firestore.rules` decide what the data
 * does. Nothing here should ever be mistaken for a second boundary.
 *
 * It exists because one account doing two jobs needs two front doors to feel
 * like two jobs.
 */

/** The roles with somewhere to go inside the console. */
const STAFF_ROLES: UserRole[] = ["scanner", "organizer", "superadmin"];

function landingFor(role: UserRole): string {
  // Someone whose only role is `scanner` has no console to look at — the gate
  // is their entire job, so send them straight to it rather than to a page
  // whose every panel would refuse them.
  return role === "scanner" ? "/scanner" : "/staff";
}

export default function StaffLoginPage() {
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const role = profile?.role;
  const hasStaffRole = role ? STAFF_ROLES.includes(role) : false;

  useEffect(() => {
    /*
     * The loop guard.
     *
     * `/staff` bounces here when there is no role, and this bounces there when
     * there is one. While auth is still resolving, `profile` is null and `role`
     * is undefined — indistinguishable from "student" — so redirecting during
     * that window would ping-pong between the two pages. Waiting for `loading`
     * to settle is what makes the pair terminate.
     */
    if (loading || !user || !role) return;
    if (hasStaffRole) router.replace(landingFor(role));
  }, [loading, user, role, hasStaffRole, router]);

  const handleSignIn = useCallback(async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      // The effect above takes it from here once the profile resolves; routing
      // on a role we have not read yet would be a guess.
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign-in failed. Try again.";

      if (!/popup-closed-by-user|cancelled-popup-request/.test(message)) {
        toast.error("Could not sign you in", { id: "staff-signin", description: message });
      }
    } finally {
      setSubmitting(false);
    }
  }, [signInWithGoogle]);

  const busy = submitting || loading;

  return (
    <main
      data-theme="paper"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-5 py-10 text-ink"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 20% 0%, #ffffff 0%, transparent 55%), radial-gradient(90% 60% at 80% 100%, #f5ece2 0%, transparent 60%)",
        }}
      />

      <div
        className="animate-stub-in stub stub-notched relative w-full max-w-[23rem] overflow-hidden"
        style={{ ["--at" as string]: "58%" }}
      >
        <div className="px-7 pb-8 pt-9">
          <Mark size={56} priority className="mb-5" />

          <FieldLabel>Karnavati University</FieldLabel>

          <h1 className="display mt-3 text-[2.25rem] leading-[1.05] text-ink">
            Staff console
          </h1>

          {/*
           * Three states, and the two that are not "sign in" matter more,
           * because they are the ones nobody tests: a student who follows a
           * staff link must land somewhere that explains itself.
           */}
          {user && profile && !hasStaffRole ? (
            <>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-dim">
                This account does not have staff access.
              </p>

              <div className="mt-6 rounded-lg bg-paper-sunk px-4 py-3.5">
                <FieldLabel>Signed in as</FieldLabel>
                <div className="mt-1.5 truncate font-mono text-[12px] text-ink">
                  {profile.email}
                </div>

                <div className="mt-3">
                  <FieldLabel>Your role</FieldLabel>
                  <div className="mt-1.5 font-mono text-[13px] text-ku-red">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
                Ask a super admin to change your role. Nothing is wrong with your
                account — it simply is not a staff one.
              </p>
            </>
          ) : (
            <p className="mt-4 max-w-[17rem] text-[15px] leading-relaxed text-ink-dim">
              Review proposals, manage events and work the gate. You need a staff
              role on your KU account to get in.
            </p>
          )}
        </div>

        <Perforation className="mx-6" />

        <div className="px-7 pb-7 pt-6">
          {user && profile && !hasStaffRole ? (
            <Button variant="outline" size="xl" className="w-full" asChild>
              <Link href="/">
                <ArrowLeft className="size-4" />
                Back to KU Events
              </Link>
            </Button>
          ) : (
            <Button
              size="xl"
              variant="secondary"
              className="w-full"
              onClick={handleSignIn}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ShieldCheck className="size-5" />
              )}
              {submitting ? "Signing in" : "Continue with Google"}
            </Button>
          )}

          <p className="mt-4 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-soft">
            @{ALLOWED_EMAIL_DOMAIN} only
          </p>
        </div>
      </div>
    </main>
  );
}
