"use client";

import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

/**
 * The standard page frame for signed-in surfaces.
 *
 * Header lives in one place (`SiteHeader`) so the nav, the active-tab pill and
 * the role-aware links cannot drift between the directory and the interior
 * pages. The top padding clears the fixed header.
 */
export function AppShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <SiteHeader />
      <main
        className={cn(
          "mx-auto w-full max-w-4xl px-5 pb-24 pt-28 sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </>
  );
}
