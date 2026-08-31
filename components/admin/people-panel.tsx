"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, ShieldCheck, Users2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth-domain";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { FieldLabel, Stub } from "@/components/ui/stub";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

interface AdminUser {
  uid: string;
  email: string;
  full_name: string;
  role: UserRole;
  photo_url: string | null;
}

/** Roles a super admin may hand out. `superadmin` is deliberately not here. */
const ASSIGNABLE: UserRole[] = ["student", "scanner", "organizer"];

const ROLE_STYLE: Record<UserRole, string> = {
  student: "border-line text-bone-dim",
  scanner: "border-admit/30 bg-admit/[0.08] text-admit",
  organizer: "border-crimson/35 bg-crimson/[0.1] text-crimson",
  superadmin: "border-gold/35 bg-gold/[0.1] text-gold",
};

/**
 * Role assignment, as a panel inside the admin dashboard.
 *
 * The list is loaded through `/api/admin/users` rather than read directly from
 * Firestore: the rules let you read your own profile and nobody else's, so a
 * client-side query over the whole `users` collection would fail. The API is
 * the deliberate exception, gated on `superadmin`.
 */
export function PeoplePanel({
  onCountChange,
}: {
  onCountChange?: (counts: Partial<Record<UserRole, number>>) => void;
}) {
  const { profile, getIdToken } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Your session expired. Sign in again.");

      const response = await fetch("/api/admin/users", {
        headers: { authorization: `Bearer ${token}` },
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not load users.");

      setUsers(body.users as AdminUser[]);
    } catch (error) {
      console.error("[admin] load failed", error);
      toast.error("Could not load users", {
        id: "admin-load",
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    // Async loader: every setState sits behind an await. See event-directory.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /**
   * Filtering happens in the browser.
   *
   * The whole directory is already loaded and a university's user table is
   * small, so a round trip per keystroke would make search feel worse, not
   * better. The API takes a `q` too, for when this list outgrows one page.
   */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;

    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        u.full_name.toLowerCase().includes(needle),
    );
  }, [users, search]);

  const counts = useMemo(() => {
    const map: Partial<Record<UserRole, number>> = {};
    for (const u of users) map[u.role] = (map[u.role] ?? 0) + 1;
    return map;
  }, [users]);

  // Hand the census up so the overview tab does not fetch the directory twice.
  useEffect(() => {
    onCountChange?.(counts);
  }, [counts, onCountChange]);

  const setRole = useCallback(
    async (user: AdminUser, role: UserRole) => {
      if (role === user.role) return;

      setSavingUid(user.uid);

      // Optimistic: the table updates immediately and rolls back on failure.
      // Role changes are the kind of thing an admin does in a burst, and a
      // spinner per row would make the panel feel broken.
      const previous = user.role;
      setUsers((current) =>
        current.map((u) => (u.uid === user.uid ? { ...u, role } : u)),
      );

      try {
        const token = await getIdToken();
        if (!token) throw new Error("Your session expired. Sign in again.");

        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: user.uid, role }),
        });

        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not save.");

        toast.success(`${user.full_name} is now ${ROLE_LABELS[role].toLowerCase()}`, {
          id: "admin-role",
        });
      } catch (error) {
        setUsers((current) =>
          current.map((u) => (u.uid === user.uid ? { ...u, role: previous } : u)),
        );
        toast.error("Could not change that role", {
          id: "admin-role",
          description: error instanceof Error ? error.message : "Try again.",
        });
      } finally {
        setSavingUid(null);
      }
    },
    [getIdToken],
  );

  return (
    <>
      <p className="mb-7 max-w-lg text-[14px] leading-relaxed text-bone-dim">
        Promote a student to organizer and they can review proposals, publish
        events and run the gate. Demote them and it stops on their next request.
      </p>

      {/* Role census. Four numbers that answer "who can do what" at a glance. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["student", "scanner", "organizer", "superadmin"] as UserRole[]).map((role) => (
          <Stub key={role} className="px-4 py-4">
            <FieldLabel>{ROLE_LABELS[role]}</FieldLabel>
            <div className="display mt-1.5 text-[1.75rem] leading-none text-bone tabular">
              {counts[role] ?? 0}
            </div>
          </Stub>
        ))}
      </div>

      <div className="relative mt-7">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-bone-faint" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search by name or @${ALLOWED_EMAIL_DOMAIN}`}
          aria-label="Search people"
          className="w-full rounded-full border border-line bg-white/[0.03] py-3 pl-11 pr-4 text-[15px] text-bone placeholder:text-bone-faint focus:border-crimson focus:outline-none"
        />
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="stub h-72 animate-pulse" />
        ) : visible.length === 0 ? (
          <Stub className="px-6 py-16 text-center">
            <Users2 className="mx-auto size-8 text-bone-faint" />
            <p className="mt-4 text-sm text-bone-dim">
              {search ? (
                <>Nobody matches &ldquo;{search}&rdquo;.</>
              ) : (
                <>No accounts yet. People appear here after their first sign-in.</>
              )}
            </p>
          </Stub>
        ) : (
          <Stub className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead className="text-right">Assign role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {visible.map((user) => {
                    const isSelf = user.uid === profile?.uid;
                    const locked = user.role === "superadmin" || isSelf;

                    return (
                      <motion.tr
                        key={user.uid}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-b border-line transition-colors hover:bg-white/[0.02]"
                      >
                        <TableCell className="max-w-[14rem]">
                          <div className="truncate font-medium text-bone">
                            {user.full_name}
                            {isSelf ? (
                              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-faint">
                                you
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate font-mono text-[10px] text-bone-faint">
                            {user.email}
                          </div>
                        </TableCell>

                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${ROLE_STYLE[user.role]}`}
                          >
                            {user.role === "superadmin" ? (
                              <ShieldCheck className="size-3" />
                            ) : null}
                            {ROLE_LABELS[user.role]}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          {locked ? (
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-faint">
                              {isSelf ? "Not yourself" : "Locked"}
                            </span>
                          ) : savingUid === user.uid ? (
                            <Loader2 className="ml-auto size-4 animate-spin text-bone-faint" />
                          ) : (
                            <div className="inline-flex gap-1 rounded-full border border-line p-1">
                              {ASSIGNABLE.map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => setRole(user, role)}
                                  aria-pressed={user.role === role}
                                  className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-colors ${
                                    user.role === role
                                      ? "bg-crimson/20 text-bone"
                                      : "text-bone-faint hover:bg-white/[0.05] hover:text-bone-dim"
                                  }`}
                                >
                                  {role === "student"
                                    ? "Student"
                                    : role === "scanner"
                                      ? "Gate"
                                      : "Organizer"}
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </Stub>
        )}
      </div>

      <p className="mt-6 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-faint">
        Super admin is granted out of band, never from this panel
      </p>
    </>
  );
}
