"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Search, UserCheck } from "lucide-react";

import { searchRoster, type CachedTicket } from "@/lib/db/indexeddb";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/stub";

/**
 * The way through when a code will not scan.
 *
 * Cracked screens, phones that died in the queue, displays too dim for the
 * camera — all routine at a real gate, and without a fallback the holder is
 * turned away despite having a valid pass. The marshal finds them on the
 * cached roster and admits them by hand.
 *
 * Two things make this safe rather than a bypass:
 *  - it can only admit someone who is *already on the roster*, so it is a
 *    different input method, not a different rule
 *  - every manual admission is flagged as such all the way to `check_in_logs`
 */
export function ManualAdmit({
  open,
  onOpenChange,
  eventId,
  onAdmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onAdmit: (ticket: CachedTicket) => Promise<void>;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CachedTicket[]>([]);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState<CachedTicket | null>(null);
  const [admitting, setAdmitting] = useState(false);

  /*
   * Debounced so a marshal typing a name does not fire a query per keystroke
   * against IndexedDB while the camera is also running.
   *
   * Every setState here happens inside the timeout or after the await — never
   * synchronously in the effect body, which would cascade a render on each
   * keystroke.
   */
  useEffect(() => {
    if (term.trim().length < 2) return;

    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchRoster(eventId, term)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 180);

    return () => window.clearTimeout(timer);
  }, [term, eventId]);

  const shortTerm = term.trim().length < 2;

  /**
   * Reset on close, in the close handler rather than an effect.
   *
   * Reopening must never show the last person the marshal looked up — at a gate
   * that is how you admit the wrong human.
   */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        setTerm("");
        setResults([]);
        setConfirming(null);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const confirm = useCallback(async () => {
    if (!confirming) return;

    setAdmitting(true);
    try {
      await onAdmit(confirming);
      handleOpenChange(false);
    } finally {
      setAdmitting(false);
    }
  }, [confirming, onAdmit, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        {confirming ? (
          <>
            <DialogHeader>
              <DialogTitle className="display text-[1.5rem]">
                Admit {confirming.user_name}?
              </DialogTitle>
              <DialogDescription>
                This is recorded as a manual admission — it will show in the
                audit trail as vouched for by you, not scanned.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-line bg-white/[0.02] p-4">
              <FieldLabel>Pass holder</FieldLabel>
              <div className="mt-1.5 text-[15px] font-medium text-bone">
                {confirming.user_name}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-bone-faint">
                {confirming.user_email}
              </div>

              {confirming.checked_in ? (
                <p className="mt-3 text-[13px] leading-relaxed text-refuse">
                  Already admitted at {formatDateTime(confirming.check_in_time)}.
                  Letting them through again would be a second entry on one pass.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setConfirming(null)}
                disabled={admitting}
              >
                Back
              </Button>
              <Button
                variant={confirming.checked_in ? "destructive" : "default"}
                onClick={confirm}
                disabled={admitting}
              >
                {admitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {confirming.checked_in ? "Admit anyway" : "Admit"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="display text-[1.5rem]">
                Find on the roster
              </DialogTitle>
              <DialogDescription>
                For when a code will not scan. Works offline — this searches the
                roster already on this device.
              </DialogDescription>
            </DialogHeader>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-bone-faint" />
              <input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Name, email or last 6 of the pass"
                aria-label="Search the roster"
                autoFocus
                className="w-full rounded-xl border border-line bg-white/[0.03] py-3 pl-11 pr-4 text-[15px] text-bone placeholder:text-bone-faint focus:border-crimson focus:outline-none"
              />
            </div>

            <div className="min-h-[12rem]">
              {shortTerm ? (
                <p className="py-10 text-center text-[13px] text-bone-faint">
                  Type at least two characters.
                </p>
              ) : searching ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-bone-faint" />
                </div>
              ) : results.length === 0 && !searching ? (
                <p className="py-10 text-center text-[13px] leading-relaxed text-bone-dim">
                  Nobody on this roster matches &ldquo;{term}&rdquo;.
                  <br />
                  <span className="text-bone-faint">
                    If they booked recently, re-download the roster.
                  </span>
                </p>
              ) : (
                <ul className="divide-y divide-[color:var(--line)]">
                  {results.map((ticket) => (
                    <li key={ticket.qr_hash}>
                      <button
                        type="button"
                        onClick={() => setConfirming(ticket)}
                        className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium text-bone">
                            {ticket.user_name}
                          </div>
                          <div className="truncate font-mono text-[10px] text-bone-faint">
                            {ticket.user_email}
                          </div>
                        </div>

                        {ticket.status !== "issued" ? (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-refuse">
                            {ticket.status}
                          </span>
                        ) : ticket.checked_in ? (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-faint">
                            Inside
                          </span>
                        ) : (
                          <UserCheck className="size-4 shrink-0 text-admit" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
