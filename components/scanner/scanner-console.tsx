"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CloudUpload,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  UserSearch,
  Wifi,
  WifiOff,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { fetchEventTickets, fetchOpenEvents } from "@/lib/firestore-queries";
import { parseQrPayload } from "@/lib/qr";
import { playError, playNeutral, playSuccess, primeAudio } from "@/lib/sound";
import { flushSyncQueue, startAutoSync } from "@/lib/sync-client";
import { formatDateTime } from "@/lib/format";
import {
  gateDb,
  getDeviceId,
  pendingScanCount,
  purgeEvent,
  replaceRoster,
  resolveScan,
  rosterStats,
  type CachedTicket,
  type RosterMeta,
  type ScanOutcome,
} from "@/lib/db/indexeddb";
import type { EventDoc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";
import { QrViewport } from "@/components/scanner/qr-viewport";
import { ScanOverlay } from "@/components/scanner/scan-overlay";
import { ManualAdmit } from "@/components/scanner/manual-admit";

const ACTIVE_EVENT_KEY = "ku_events_active_event";

interface ScanLogEntry {
  id: string;
  at: number;
  kind: ScanOutcome["kind"];
  label: string;
  manual: boolean;
}

export function ScannerConsole() {
  const { user, profile, getIdToken } = useAuth();

  const [events, setEvents] = useState<EventDoc[]>([]);

  /**
   * The event this device was working when the tab last closed.
   *
   * Read in a lazy initialiser rather than an effect so the gate console comes
   * back up already pointed at the right roster — a marshal whose phone slept
   * mid-queue should not have to re-pick the event. Safe to touch
   * `localStorage` here because <AuthGuard> renders a spinner until auth
   * resolves, so this component only ever mounts on the client.
   */
  const [eventId, setEventId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(ACTIVE_EVENT_KEY),
  );

  const [meta, setMeta] = useState<RosterMeta | null>(null);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0 });
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);

  const [cameraOn, setCameraOn] = useState(false);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);
  const [log, setLog] = useState<ScanLogEntry[]>([]);

  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const deviceId = useMemo(
    () => (typeof window === "undefined" ? "" : getDeviceId()),
    [],
  );

  // ── Connectivity ──────────────────────────────────────────────────────────
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const refreshLocalState = useCallback(async (id: string | null) => {
    setPending(await pendingScanCount());

    if (!id) {
      setMeta(null);
      setStats({ total: 0, checkedIn: 0 });
      return;
    }

    const [rosterMeta, counts] = await Promise.all([
      gateDb.roster_meta.get(id),
      rosterStats(id),
    ]);

    setMeta(rosterMeta ?? null);
    setStats(counts);
  }, []);

  useEffect(() => {
    // Every setState here follows an await on IndexedDB, so nothing is set
    // synchronously. The rule does not trace async callees.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshLocalState(eventId);
  }, [eventId, refreshLocalState]);

  // ── Background sync ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    return startAutoSync(getIdToken, (result) => {
      setPending(result.remaining);

      if (result.uploaded > 0) {
        toast.success(`Synced ${result.uploaded} check-in${result.uploaded === 1 ? "" : "s"}`, {
          id: "autosync",
          description: result.duplicates
            ? `${result.duplicates} were already recorded upstream.`
            : undefined,
        });
        void refreshLocalState(eventId);
      }
    });
  }, [user, getIdToken, eventId, refreshLocalState]);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await fetchOpenEvents());
    } catch (error) {
      console.error("[scanner] event list failed", error);
      toast.error("Could not load events", {
        id: "gate-events",
        description: "You need a connection to pick an event.",
      });
    }
  }, []);

  const downloadRoster = useCallback(
    async (target: EventDoc) => {
      setDownloading(true);
      try {
        const tickets = await fetchEventTickets(target.id);

        const cached: CachedTicket[] = tickets.map((t) => ({
          qr_hash: t.qr_hash,
          ticket_id: t.id,
          event_id: t.event_id,
          user_name: t.user_name,
          user_email: t.user_email,
          seat_label: t.seat_label ?? null,
          status: t.status ?? "issued",
          // Carry the server's check-in state across so a second device
          // starting fresh mid-event does not re-admit people.
          checked_in: t.checked_in ? 1 : 0,
          check_in_time: t.check_in_time,
        }));

        await replaceRoster(target.id, cached, {
          event_id: target.id,
          event_title: target.title,
          event_venue: target.venue,
          downloaded_at: Date.now(),
        });

        localStorage.setItem(ACTIVE_EVENT_KEY, target.id);
        setEventId(target.id);
        await refreshLocalState(target.id);
        setPickerOpen(false);

        toast.success(`Roster cached — ${cached.length} passes`, {
          id: "roster",
          description: "This gate can now scan with no signal.",
        });
      } catch (error) {
        console.error("[scanner] roster download failed", error);
        toast.error("Roster download failed", {
          id: "roster",
          description: error instanceof Error ? error.message : "Check your connection.",
        });
      } finally {
        setDownloading(false);
      }
    },
    [refreshLocalState],
  );

  /**
   * Applies a resolved scan: feedback, overlay, log, counters.
   *
   * Shared by the camera and the manual-admit path so a hand-entered admission
   * behaves identically from here on — same overlay, same chime, same queue.
   */
  const applyOutcome = useCallback(
    (result: ScanOutcome, key: string) => {
      if (result.kind === "admitted") playSuccess();
      else playError();

      setOutcome(result);
      setLog((entries) =>
        [
          {
            id: `${key}-${Date.now()}`,
            at: Date.now(),
            kind: result.kind,
            label: "ticket" in result ? result.ticket.user_name : "Unknown pass",
            manual: result.kind === "admitted" && Boolean(result.manual),
          },
          ...entries,
        ].slice(0, 20),
      );

      void refreshLocalState(eventId);
    },
    [eventId, refreshLocalState],
  );

  // ── The scan path. Nothing here awaits the network. ───────────────────────
  const handleScan = useCallback(
    async (payload: string) => {
      if (!eventId || !user) return;

      const qrHash = parseQrPayload(payload);

      if (!qrHash) {
        playNeutral();
        setOutcome({ kind: "unreadable", raw: payload });
        return;
      }

      const result = await resolveScan({
        qrHash,
        eventId,
        scannedBy: user.uid,
        deviceId,
      });

      applyOutcome(result, qrHash);
    },
    [eventId, user, deviceId, applyOutcome],
  );

  /**
   * Admits someone found by name instead of by camera.
   *
   * Runs through exactly the same `resolveScan` transaction, so the roster
   * check, the duplicate check and the outbox entry are identical — the only
   * difference is the `manual` flag, which follows the record to the audit
   * trail. This is a different input method, not a different rule.
   */
  const handleManualAdmit = useCallback(
    async (ticket: CachedTicket) => {
      if (!eventId || !user) return;

      const result = await resolveScan({
        qrHash: ticket.qr_hash,
        eventId,
        scannedBy: user.uid,
        deviceId,
        manual: true,
      });

      applyOutcome(result, ticket.qr_hash);
    },
    [eventId, user, deviceId, applyOutcome],
  );

  const manualSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await flushSyncQueue(getIdToken);
      setPending(result.remaining);

      if (result.error === "offline") {
        toast.error("Still offline", {
          id: "sync",
          description: `${result.remaining} check-in(s) waiting. They upload themselves.`,
        });
      } else if (result.error) {
        toast.error("Sync failed", { id: "sync", description: result.error });
      } else if (result.uploaded || result.duplicates) {
        toast.success(`Uploaded ${result.uploaded} check-in(s)`, { id: "sync" });
        void refreshLocalState(eventId);
      } else {
        toast.success("Everything is synced", { id: "sync" });
      }
    } finally {
      setSyncing(false);
    }
  }, [getIdToken, eventId, refreshLocalState]);

  const startCamera = useCallback(async () => {
    await primeAudio();
    setCameraOn(true);
  }, []);

  // Keep the screen awake — a locked phone mid-queue is the classic gate failure.
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!cameraOn || !("wakeLock" in navigator)) return;

    let released = false;

    const acquire = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Denied or unsupported — not worth interrupting the marshal over.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLockRef.current?.release().catch(() => undefined);
      wakeLockRef.current = null;
    };
  }, [cameraOn]);

  const remaining = Math.max(stats.total - stats.checkedIn, 0);
  const pct = stats.total > 0 ? (stats.checkedIn / stats.total) * 100 : 0;

  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pb-8 pt-4 outline-none"
    >
      <ScanOverlay outcome={outcome} onDismiss={() => setOutcome(null)} />

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-faint transition-colors hover:text-bone"
        >
          <ArrowLeft className="size-3" />
          Exit gate
        </Link>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
              online
                ? "border-admit/30 bg-admit/[0.08] text-admit"
                : "border-gold/30 bg-gold/[0.08] text-gold"
            }`}
          >
            {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {online ? "Online" : "Offline"}
          </span>

          {pending > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/30 bg-crimson/[0.08] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-crimson tabular">
              {pending} queued
            </span>
          ) : null}
        </div>
      </header>

      {/* ── Roster ─────────────────────────────────────────────────────── */}
      <Stub className="overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
          <div className="min-w-0">
            <FieldLabel>Gate</FieldLabel>
            <div className="display mt-1.5 truncate text-[1.25rem] text-bone">
              {meta?.event_title ?? "No event selected"}
            </div>
            <div className="mt-1 font-mono text-[10px] text-bone-faint">
              {meta
                ? `Cached ${formatDateTime(meta.downloaded_at)}`
                : "Download a roster while you still have signal"}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPickerOpen(true);
              void loadEvents();
            }}
          >
            <Download className="size-3.5" />
            {meta ? "Change" : "Roster"}
          </Button>
        </div>

        {meta ? (
          <>
            <Perforation className="mx-5" />

            <div className="px-5 pb-5 pt-4">
              {/* The count is the number that matters, so it is the biggest
                  thing on the card. `aria-live` announces it as people are
                  admitted, so a marshal using a screen reader hears the door
                  count move without hunting for it. */}
              <div
                className="flex items-end justify-between gap-4"
                aria-live="polite"
                aria-atomic="true"
              >
                <div>
                  <FieldLabel>Admitted</FieldLabel>
                  <div className="display mt-1 text-[2.5rem] leading-none text-admit tabular">
                    {stats.checkedIn}
                    <span className="text-[1.25rem] text-bone-faint">
                      /{stats.total}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <FieldLabel>Still outside</FieldLabel>
                  <div className="display mt-1 text-[1.75rem] leading-none text-bone tabular">
                    {remaining}
                  </div>
                </div>
              </div>

              <div
                className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Share of passes admitted"
              >
                <div
                  className="h-full rounded-full bg-admit transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
      </Stub>

      {/* ── Camera ─────────────────────────────────────────────────────── */}
      {meta ? (
        <>
          <QrViewport
            active={cameraOn}
            onScan={handleScan}
            onCameraError={(message) =>
              toast.error("Camera unavailable", { id: "camera", description: message })
            }
          />

          <div className="flex gap-2">
            {cameraOn ? (
              <Button variant="secondary" className="flex-1" size="lg" onClick={() => setCameraOn(false)}>
                Pause camera
              </Button>
            ) : (
              <Button className="flex-1" size="lg" onClick={startCamera}>
                Start scanning
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={manualSync}
              disabled={syncing}
              aria-label="Sync queued check-ins now"
            >
              {syncing ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <CloudUpload className="size-4" />
              )}
              Sync
            </Button>
          </div>

          {/* The fallback. Quiet, but always reachable — the moment it is
              needed, the queue is stopped and someone is at the front of it. */}
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="mx-auto -mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-faint transition-colors hover:text-bone"
          >
            <UserSearch className="size-3.5" />
            Code won&rsquo;t scan? Find them by name
          </button>
        </>
      ) : null}

      {/* ── Recent scans ───────────────────────────────────────────────── */}
      {log.length > 0 ? (
        <Stub className="overflow-hidden px-5 py-4">
          <FieldLabel className="mb-3">Recent</FieldLabel>
          <ul className="divide-y divide-[color:var(--line)]">
            {log.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    entry.kind === "admitted" ? "bg-admit" : "bg-refuse"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-bone">
                  {entry.label}
                  {entry.manual ? (
                    <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                      by hand
                    </span>
                  ) : null}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                    entry.kind === "admitted" ? "text-admit" : "text-refuse"
                  }`}
                >
                  {entry.kind.replace("_", " ")}
                </span>
                <span className="font-mono text-[10px] text-bone-faint tabular">
                  {new Date(entry.at).toLocaleTimeString("en-IN", { hour12: false })}
                </span>
              </li>
            ))}
          </ul>
        </Stub>
      ) : null}

      {meta ? (
        <button
          type="button"
          onClick={async () => {
            if (pending > 0) {
              toast.error("Sync first", {
                id: "purge",
                description: `${pending} check-in(s) have not reached the server yet.`,
              });
              return;
            }
            await purgeEvent(meta.event_id);
            localStorage.removeItem(ACTIVE_EVENT_KEY);
            setEventId(null);
            await refreshLocalState(null);
            toast.success("Cached roster cleared", { id: "purge" });
          }}
          className="mx-auto mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-faint transition-colors hover:text-refuse"
        >
          <Trash2 className="size-3" />
          Clear cached roster
        </button>
      ) : null}

      <p className="mt-auto pt-5 text-center font-mono text-[10px] text-bone-faint">
        {profile?.full_name ?? user?.email} · Device {deviceId.slice(-6)}
      </p>

      {meta ? (
        <ManualAdmit
          open={manualOpen}
          onOpenChange={setManualOpen}
          eventId={meta.event_id}
          onAdmit={handleManualAdmit}
        />
      ) : null}

      {/* ── Event picker ───────────────────────────────────────────────── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="display text-[1.4rem]">
              Download roster
            </DialogTitle>
            <DialogDescription>
              Every pass for the event is cached on this device, so the gate
              keeps working with no signal.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-bone-dim">
                No published events found.
              </p>
            ) : (
              events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  disabled={downloading}
                  onClick={() => downloadRoster(event)}
                  className="flex w-full flex-col items-start gap-1 rounded-md border border-line p-3.5 text-left transition-colors hover:border-[color:var(--line-strong)] hover:bg-white/[0.04] disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-bone">{event.title}</span>
                  <span className="font-mono text-[10px] text-bone-dim">
                    {formatDateTime(event.starts_at)} · {event.venue}
                  </span>
                  <span className="font-mono text-[10px] text-bone-faint tabular">
                    {event.tickets_issued ?? 0} issued
                  </span>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)} disabled={downloading}>
              {downloading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Downloading
                </>
              ) : (
                "Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
