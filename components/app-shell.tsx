"use client";

import { SiteHeader } from "@/components/site-header";
import { AmbientPaper } from "@/components/motion/ambient";
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
  theme,
}: {
  children: React.ReactNode;
  className?: string;
  /**
   * Opt this page onto the paper ground. Omitting it keeps the obsidian scale.
   *
   * Explicit rather than defaulted, because `attendee-list.tsx` — an organizer
   * surface that stays dark until Phase 3 — uses this same shell. A default of
   * "paper" here would put ink-coloured text on a dark ground the moment it was
   * added, and the roster is only ever looked at during an event.
   */
  theme?: "paper";
}) {
  return (
    <div
      data-theme={theme}
      className={cn(theme === "paper" && "min-h-dvh bg-paper text-ink")}
    >
      {theme === "paper" ? <AmbientPaper /> : null}
      <SiteHeader />
      <main
        id="main"
        // `-outline-offset` keeps the focus ring inside the viewport when the
        // skip link lands here, instead of clipping against the edge.
        tabIndex={-1}
        className={cn(
          "mx-auto w-full max-w-4xl px-5 pb-24 pt-28 outline-none sm:px-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
