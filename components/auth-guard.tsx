"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/stub";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

/**
 * Client-side gate for authenticated pages.
 *
 * This is a UX guard, not the security boundary — it decides what to *render*.
 * The real enforcement lives in Firestore rules and in the server-side token
 * verification on every API route, both of which run whether or not this
 * component does.
 */
export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-bone-faint" />
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const needsSuperAdmin = allowedRoles.includes("superadmin") && allowedRoles.length === 1;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
        <ShieldAlert className="size-9 text-refuse" />

        <div>
          <h1 className="display text-[1.75rem] text-bone">
            {needsSuperAdmin ? "Super admin only" : "Not your gate"}
          </h1>
          <p className="mx-auto mt-2.5 max-w-[22rem] text-sm leading-relaxed text-bone-dim">
            This area needs{" "}
            {allowedRoles.map((r) => ROLE_LABELS[r].toLowerCase()).join(" or ")}
            {" "}access.
          </p>
        </div>

        {/*
         * Show the account and the role it actually resolved to.
         *
         * "You do not have access" without saying what you *do* have is the
         * least useful error an app can give — it leaves you unable to tell a
         * wrong account from a role that was never assigned. This turns a
         * support conversation into a glance.
         */}
        <div className="stub w-full max-w-[22rem] px-5 py-4 text-left">
          <FieldLabel>Signed in as</FieldLabel>
          <div className="mt-1.5 truncate font-mono text-[12px] text-bone">
            {profile.email}
          </div>

          <div className="mt-3.5">
            <FieldLabel>Your role</FieldLabel>
            <div className="mt-1.5 font-mono text-[13px] text-gold">
              {profile.role}
            </div>
          </div>
        </div>

        <p className="mx-auto max-w-[22rem] text-xs leading-relaxed text-bone-faint">
          {needsSuperAdmin
            ? "Super admin is never granted from inside the app. Set role to “superadmin” on your own document in Firestore › users, then reload."
            : "Ask a super admin to change your role from the admin panel."}
        </p>

        <Button variant="outline" onClick={() => router.push("/")}>
          Back to events
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
