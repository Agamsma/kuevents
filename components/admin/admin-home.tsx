"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { DashboardShell, StatCard } from "@/components/dashboard/dashboard-shell";
import { EventsPanel } from "@/components/dashboard/events-panel";
import { RequestsPanel } from "@/components/dashboard/requests-panel";
import { PeoplePanel } from "@/components/admin/people-panel";

interface Counts {
  events: number;
  issued: number;
  capacity: number;
}

/**
 * The super admin's view of the whole platform.
 *
 * Same shell and the same panels as the organizer dashboard, with the scope
 * widened: every event rather than their own, plus people and roles. Reusing
 * the panels means an admin is looking at exactly the interface organizers use,
 * which is what makes their oversight useful when something is reported.
 */
export function AdminHome() {
  const [counts, setCounts] = useState<Counts>({ events: 0, issued: 0, capacity: 0 });
  const [roleCounts, setRoleCounts] = useState<Partial<Record<UserRole, number>>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [tab, setTab] = useState("overview");

  // Stable identities: these are handed to panels whose reporting effects
  // depend on them, and a fresh closure each render would loop.
  const handleCounts = useCallback((next: Counts) => setCounts(next), []);
  const handleRoles = useCallback(
    (next: Partial<Record<UserRole, number>>) => setRoleCounts(next),
    [],
  );
  const handlePending = useCallback((next: number) => setPendingCount(next), []);

  const totalPeople = useMemo(
    () => Object.values(roleCounts).reduce((sum, n) => sum + (n ?? 0), 0),
    [roleCounts],
  );

  const tabs = useMemo(
    () => [
      {
        value: "overview",
        label: "Overview",
        content: (
          <AdminOverview
            counts={counts}
            roleCounts={roleCounts}
            totalPeople={totalPeople}
            pendingCount={pendingCount}
            onGoToPeople={() => setTab("people")}
            onGoToRequests={() => setTab("requests")}
          />
        ),
      },
      {
        value: "people",
        label: "People",
        content: <PeoplePanel onCountChange={handleRoles} />,
      },
      {
        value: "events",
        label: "All events",
        content: <EventsPanel scope="all" onCountsChange={handleCounts} />,
      },
      {
        value: "requests",
        label: "Requests",
        badge: pendingCount,
        content: <RequestsPanel onCountChange={handlePending} />,
      },
    ],
    [counts, roleCounts, totalPeople, pendingCount, handleCounts, handleRoles, handlePending],
  );

  return (
    <DashboardShell
      eyebrow="Super admin"
      title="Platform"
      description="Everything on KU Events, and who is allowed to do what."
      tabs={tabs}
      controlledTab={tab}
      onTabChange={setTab}
    />
  );
}

function AdminOverview({
  counts,
  roleCounts,
  totalPeople,
  pendingCount,
  onGoToPeople,
  onGoToRequests,
}: {
  counts: Counts;
  roleCounts: Partial<Record<UserRole, number>>;
  totalPeople: number;
  pendingCount: number;
  onGoToPeople: () => void;
  onGoToRequests: () => void;
}) {
  const staff =
    (roleCounts.organizer ?? 0) +
    (roleCounts.scanner ?? 0) +
    (roleCounts.superadmin ?? 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="People" value={totalPeople} hint={`${staff} with a role`} />
        <StatCard label="Events" value={counts.events} />
        <StatCard label="Passes issued" value={counts.issued} tone="admit" />
        <StatCard
          label="In review"
          value={pendingCount}
          tone={pendingCount > 0 ? "gold" : undefined}
        />
      </div>

      {/*
       * Counts are loaded lazily by the panels themselves, so the overview
       * shows zeros until a tab has been opened. Said plainly rather than
       * dressed up as real data, which would be worse than saying nothing.
       */}
      {totalPeople === 0 || counts.events === 0 ? (
        <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-faint">
          Some totals fill in once you open the matching tab
        </p>
      ) : null}

      {pendingCount > 0 ? (
        <Stub notched notchAt="calc(100% - 4.5rem)" className="overflow-hidden">
          <div className="px-5 pb-5 pt-5">
            <h2 className="display text-[1.25rem] text-bone">
              {pendingCount} {pendingCount === 1 ? "proposal" : "proposals"} waiting
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-bone-dim">
              Any organizer can clear these — you do not have to. Nothing reaches
              the directory until one of them does.
            </p>
          </div>

          <Perforation className="mx-5" />

          <div className="flex h-[4.5rem] items-center px-5">
            <Button size="sm" variant="gold" onClick={onGoToRequests}>
              Review them
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Stub>
      ) : null}

      {/* Role census, and the one thing only a super admin can do. */}
      <Stub notched notchAt="calc(100% - 4.5rem)" className="overflow-hidden">
        <div className="px-5 pb-5 pt-5">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/30">
              <ShieldCheck className="size-5 text-gold" />
            </div>
            <div className="min-w-0">
              <h2 className="display text-[1.25rem] text-bone">Who can do what</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-bone-dim">
                Assigning the organizer role is how a KU account gets its own
                dashboard, the review queue and the gate scanner.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {(["student", "scanner", "organizer", "superadmin"] as UserRole[]).map(
              (role) => (
                <div key={role}>
                  <dt>
                    <FieldLabel>{ROLE_LABELS[role]}</FieldLabel>
                  </dt>
                  <dd className="mt-1 font-mono text-[15px] text-bone tabular">
                    {roleCounts[role] ?? 0}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </div>

        <Perforation className="mx-5" />

        <div className="flex h-[4.5rem] items-center px-5">
          <Button size="sm" variant="outline" onClick={onGoToPeople}>
            Manage roles
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </Stub>
    </div>
  );
}
