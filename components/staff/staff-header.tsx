"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut, ScanLine } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/lib/auth-context";
import { MarkGlyph } from "@/components/brand/mark";
import { ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * The staff console's own header.
 *
 * Separate from `SiteHeader` rather than a variant of it, because the two are
 * answering different questions. The student header asks "what can I do here";
 * this one asks "what am I, and what am I responsible for". They share a
 * wordmark and a ground and nothing else.
 *
 * The signed-in account and the role that actually resolved are shown
 * permanently. Role is the thing that decides what works, it can change under
 * you mid-session — `requireCaller()` re-reads it on every API request, so a
 * demotion lands on the next click — and "why can't I see the review queue" is
 * answered instantly by a console that always says what it thinks you are.
 *
 * None of this is a boundary. It is a console for people who already have a
 * role; the role is enforced by `AuthGuard` for rendering and by
 * `requireCaller()` and `firestore.rules` for data.
 */
export function StaffHeader() {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname();

  const role = profile?.role;
  const canScan = role === "scanner" || role === "organizer" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  const nav = [
    { href: "/staff", label: "Console", show: true, exact: true },
    { href: "/staff/people", label: "People", show: isSuperAdmin, exact: false },
  ].filter((item) => item.show);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div className="glass flex h-14 items-center gap-3 rounded-full px-4 sm:px-5">
          <Link
            href="/staff"
            aria-label="KU Events staff console"
            className="flex shrink-0 items-center gap-2.5"
          >
            <MarkGlyph size={26} />
            <span className="display text-[17px] text-foreground">KU&nbsp;Events</span>
            {/*
              The marker, not a different logo. Someone glancing at a screenshot
              in a support thread needs to know which console they are looking
              at, and the wordmark alone does not say.
            */}
            <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary-foreground">
              Staff
            </span>
          </Link>

          <nav className="ml-4 hidden flex-1 items-center gap-0.5 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  isActive(item.href, item.exact)
                    ? "text-foreground"
                    : "text-subtle-foreground hover:text-muted-foreground",
                )}
              >
                {isActive(item.href, item.exact) ? (
                  <motion.span
                    layoutId="staff-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-accent"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}

            {/*
              The gate is a link out, not a tab. It leaves the console entirely
              — no chrome, full-bleed dark — so presenting it as a peer of
              Console and People would misdescribe where it takes you.
            */}
            {canScan ? (
              <Link
                href="/scanner"
                className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ScanLine className="size-3" />
                Gate
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/* Account and resolved role, always visible. */}
            {profile ? (
              <div className="hidden text-right leading-tight lg:block">
                <div className="max-w-[13rem] truncate font-mono text-[10px] text-subtle-foreground">
                  {profile.email}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </div>
              </div>
            ) : null}

            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-subtle-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              <ArrowLeft className="size-3" />
              Student site
            </Link>

            {user ? (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title={user.email ?? "Sign out"}
                className="rounded-full p-2 text-subtle-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* The nav collapses on small screens; these are the two that matter. */}
        <div className="mt-2 flex gap-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "glass flex-1 rounded-full px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                isActive(item.href, item.exact)
                  ? "text-foreground"
                  : "text-subtle-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          {canScan ? (
            <Link
              href="/scanner"
              className="glass flex-1 rounded-full px-3 py-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Gate
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
