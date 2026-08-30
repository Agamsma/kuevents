"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/lib/types";

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
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <ShieldAlert className="size-9 text-refuse" />
        <div>
          <h1 className="display text-[1.75rem] text-bone">Not your gate</h1>
          <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-bone-dim">
            This area is for {allowedRoles.join(" and ")} accounts. You are
            signed in as a{" "}
            <span className="font-medium text-bone">{profile.role}</span>. Ask an
            organizer if you need access.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to events
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
