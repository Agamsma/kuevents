"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { MarkGlyph } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

/**
 * The frosted header that floats over every page.
 *
 * Navigation is role-aware: a student never sees the gate, the review board or
 * the admin panel, so the surface stays as small as their actual job. These are
 * conveniences, not controls — every route guards itself.
 */
export function SiteHeader() {
  const { user, profile, signOut, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = profile?.role;
  const canScan = role === "scanner" || role === "organizer" || role === "superadmin";
  const canReview = role === "organizer" || role === "superadmin";
  const isSuperAdmin = role === "superadmin";

  const nav = [
    { href: "/", label: "Events", show: true },
    { href: "/tickets", label: "My passes", show: Boolean(user) },
    { href: "/proposals", label: "My proposals", show: Boolean(user) },
    { href: "/dashboard", label: "Dashboard", show: canReview },
    { href: "/scanner", label: "Gate", show: canScan },
    { href: "/admin", label: "Admin", show: isSuperAdmin },
  ].filter((item) => item.show);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div className="glass flex h-14 items-center gap-3 rounded-full px-4 sm:px-5">
          {/*
           * The crest leads, the wordmark follows.
           *
           * Only the flame is used here, not the full lockup — the lockup's own
           * "KARNAVATI UNIVERSITY" type is illegible at this size and would sit
           * next to a second wordmark saying nearly the same thing. The flame
           * is a silhouette and reads fine small.
           */}
          <Link
            href="/"
            aria-label="KU Events — home"
            className="flex shrink-0 items-center gap-2.5"
          >
            <MarkGlyph size={28} />
            <span className="display text-[18px] text-foreground">
              KU&nbsp;Events
            </span>
          </Link>

          <nav className="ml-4 hidden flex-1 items-center gap-0.5 md:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  isActive(item.href)
                    ? "text-foreground"
                    : "text-subtle-foreground hover:text-muted-foreground",
                )}
              >
                {isActive(item.href) ? (
                  <motion.span
                    layoutId="header-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-full bg-accent"
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {loading ? null : user ? (
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                title={user.email ?? "Sign out"}
                className="hidden rounded-full p-2 text-subtle-foreground transition-colors hover:text-foreground md:block"
              >
                <LogOut className="size-4" />
              </button>
            ) : (
              <Button size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            )}

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open ? (
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="glass mt-2 overflow-hidden rounded-2xl p-2 md:hidden"
            >
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block rounded-xl px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                    isActive(item.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {item.label}
                </Link>
              ))}

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void signOut();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left font-mono text-[11px] uppercase tracking-[0.14em] text-subtle-foreground transition-colors hover:bg-accent"
                >
                  <LogOut className="size-3.5" />
                  Sign out
                </button>
              ) : null}
            </motion.nav>
          ) : null}
        </AnimatePresence>
      </div>
    </header>
  );
}
