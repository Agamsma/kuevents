"use client";

import { useCallback, useEffect } from "react";

import { SiteHeader } from "@/components/site-header";
import { AmbientPaper } from "@/components/motion/ambient";
import { FieldLabel } from "@/components/ui/stub";
import { Tabs, TabsContent, TabsList, TabsPill, TabsTrigger } from "@/components/ui/tabs";

export interface DashboardTab {
  value: string;
  label: string;
  /** Shown as a count beside the label. Omit or 0 to hide. */
  badge?: number;
  content: React.ReactNode;
}

/**
 * The frame both dashboards share.
 *
 * The active tab is mirrored into `?tab=` so a specific view is linkable and
 * survives a reload — an organizer who lands on the review queue from a
 * notification should not be dropped back on the overview. Written with
 * `replaceState` rather than the router so switching tabs does not push a
 * history entry per click and turn Back into a tab-cycling button.
 */
export function DashboardShell({
  eyebrow,
  title,
  description,
  tabs,
  action,
  controlledTab,
  onTabChange,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  tabs: DashboardTab[];
  action?: React.ReactNode;
  /** The dashboard owns the tab, so overview cards can jump between them. */
  controlledTab: string;
  onTabChange: (tab: string) => void;
}) {
  /*
   * Restore `?tab=` once on mount.
   *
   * Read off `window.location` rather than with `useSearchParams()`, which
   * would opt the whole route out of prerendering for a value that is only
   * needed after hydration.
   *
   * Runs once: re-running on every render would fight the user's own clicks.
   */
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && tabs.some((t) => t.value === requested)) {
      onTabChange(requested);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback(
    (next: string) => {
      onTabChange(next);

      // `replaceState`, not the router: pushing a history entry per tab click
      // would turn Back into a tab-cycling button.
      const url = new URL(window.location.href);
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", url);
    },
    [onTabChange],
  );

  const tab = controlledTab;

  return (
    <div data-theme="paper" className="min-h-dvh bg-paper text-ink">
      <AmbientPaper />
      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl px-5 pb-24 pt-28 outline-none sm:px-6"
      >
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <FieldLabel>{eyebrow}</FieldLabel>
            <h1 className="display mt-2.5 text-[clamp(2rem,6vw,2.75rem)] text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

          {action ? <div className="shrink-0">{action}</div> : null}
        </header>

        <Tabs value={tab} onValueChange={handleChange} className="mt-9">
          <TabsList className="mb-9 flex-wrap">
            {tabs.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {tab === entry.value ? <TabsPill /> : null}
                {entry.label}
                {entry.badge ? (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-primary tabular">
                    {entry.badge}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((entry) => (
            <TabsContent key={entry.value} value={entry.value}>
              {entry.content}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

/** A single headline number. Used across both dashboard overviews. */
export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "admit" | "gold" | "refuse";
}) {
  const toneClass =
    tone === "admit"
      ? "text-admit"
      : tone === "gold"
        ? "text-primary"
        : tone === "refuse"
          ? "text-refuse"
          : "text-foreground";

  return (
    <div className="stub px-5 py-5">
      <FieldLabel>{label}</FieldLabel>
      <div className={`display mt-2 text-[2rem] leading-none tabular ${toneClass}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 font-mono text-[10px] text-subtle-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
