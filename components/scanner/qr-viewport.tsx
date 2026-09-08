"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { CameraOff, Loader2 } from "lucide-react";

const READER_ID = "ku-qr-reader";

/**
 * Camera viewport wrapping html5-qrcode.
 *
 * Two details make or break a gate queue:
 *
 *  - The library is imported dynamically inside the effect. It touches `document`
 *    at module scope, which would break the server render.
 *  - Decode callbacks fire many times a second while a code sits in frame. We
 *    debounce identical payloads here so the parent's scan handler — which
 *    writes to IndexedDB — sees one event per physical ticket, not forty.
 */
export function QrViewport({
  active,
  onScan,
  onCameraError,
  /** Ignore a repeat of the same payload within this window. */
  repeatSuppressionMs = 2500,
}: {
  active: boolean;
  onScan: (payload: string) => void;
  onCameraError?: (message: string) => void;
  repeatSuppressionMs?: number;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ payload: string; at: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /*
   * Keep the newest callbacks reachable without restarting the camera when the
   * parent re-renders — tearing down a video stream mid-queue is very visible.
   *
   * `onCameraError` needs this as much as `onScan` does, and did not have it.
   * The console passes it as an inline arrow, so it had a new identity on every
   * render; with it in the effect's dependency array, the camera was being
   * stopped and restarted on every state change — and a scan sets four pieces
   * of state. That churn is what kept catching `stop()` on a scanner that had
   * not finished starting.
   */
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const onCameraErrorRef = useRef(onCameraError);
  useEffect(() => {
    onCameraErrorRef.current = onCameraError;
  }, [onCameraError]);

  const handleDecoded = useCallback(
    (payload: string) => {
      const now = Date.now();
      const last = lastScanRef.current;

      if (last && last.payload === payload && now - last.at < repeatSuppressionMs) {
        return;
      }

      lastScanRef.current = { payload, at: now };
      onScanRef.current(payload);
    },
    [repeatSuppressionMs],
  );

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let instance: Html5Qrcode | null = null;

    async function start() {
      setStatus("starting");
      setErrorMessage(null);

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );

        if (disposed) return;

        instance = new Html5Qrcode(READER_ID, {
          // QR only: skipping the other symbologies roughly halves decode time.
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = instance;

        await instance.start(
          { facingMode: "environment" },
          {
            fps: 12,
            // A square box centred in the frame; the library scales it to fit.
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => handleDecoded(decodedText),
          () => {
            // Fires continuously for every frame without a code in it. Noise.
          },
        );

        if (disposed) {
          // Same synchronous-throw trap as the cleanup below: `.catch()` on the
          // returned promise cannot absorb a throw that happens before the
          // promise exists.
          try {
            await instance.stop();
          } catch {
            // Never fully started; nothing to stop.
          }
          return;
        }

        setStatus("running");
      } catch (error) {
        if (disposed) return;

        const message = describeCameraError(error);
        setErrorMessage(message);
        setStatus("error");
        onCameraErrorRef.current?.(message);
      }
    }

    void start();

    return () => {
      disposed = true;
      const current = instance ?? scannerRef.current;
      scannerRef.current = null;

      if (current) {
        /*
         * `stop()` THROWS SYNCHRONOUSLY when the scanner is not running —
         * "Cannot stop, scanner is not running or paused." It does not reject.
         *
         * This used to be `Promise.resolve(current.stop()).catch(...)`, written
         * against the belief that it rejects. `Promise.resolve()` can only
         * absorb a rejection from a promise it is handed; a synchronous throw
         * inside the argument escapes before `.catch()` is ever attached. And
         * because React catches anything thrown in an effect cleanup, that
         * escaped straight into the route's error boundary — the gate showed
         * "That page hit a problem" on a scan whose check-in had already been
         * written.
         *
         * The try/catch is the fix; the `.catch()` stays for the case the
         * comment originally described, since `stop()` can also reject once it
         * genuinely is running.
         */
        try {
          Promise.resolve(current.stop())
            .catch(() => undefined)
            .finally(() => {
              try {
                current.clear();
              } catch {
                // Already torn down.
              }
            });
        } catch {
          // Never started, or already stopped. Still release the element.
          try {
            current.clear();
          } catch {
            // Already torn down.
          }
        }
      }
    };
    // `onCameraError` is deliberately absent from these deps: it is read
    // through a ref, so the camera survives the parent re-rendering. `active`
    // is the only thing that should ever start or stop it.
  }, [active, handleDecoded]);

  return (
    <div className="stub relative aspect-square w-full overflow-hidden bg-black">
      <div id={READER_ID} className="size-full" />

      {status === "running" ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* Reticle: four corner brackets and a sweeping crimson line. The
              brackets are the aiming target; the sweep says "still looking". */}
          <div className="absolute left-1/2 top-1/2 size-[62%] -translate-x-1/2 -translate-y-1/2">
            <span className="absolute left-0 top-0 size-7 rounded-tl-md border-l-2 border-t-2 border-crimson" />
            <span className="absolute right-0 top-0 size-7 rounded-tr-md border-r-2 border-t-2 border-crimson" />
            <span className="absolute bottom-0 left-0 size-7 rounded-bl-md border-b-2 border-l-2 border-crimson" />
            <span className="absolute bottom-0 right-0 size-7 rounded-br-md border-b-2 border-r-2 border-crimson" />

            <div className="absolute inset-0 overflow-hidden">
              <div
                className="animate-scan-sweep h-px bg-[linear-gradient(to_right,transparent,var(--crimson),transparent)]"
                style={{ ["--sweep-distance" as string]: "100%" }}
              />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Hold the pass steady
          </div>
        </div>
      ) : null}

      {status === "starting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-dim">
          <Loader2 className="size-5 animate-spin" />
          Waking the camera
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <CameraOff className="size-7 text-refuse" />
          <p className="text-[13px] leading-relaxed text-bone-dim">{errorMessage}</p>
        </div>
      ) : null}

      {!active && status === "idle" ? (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] uppercase tracking-[0.16em] text-bone-faint">
          Camera off
        </div>
      ) : null}
    </div>
  );
}

function describeCameraError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? "";
  const message = error instanceof Error ? error.message : String(error);

  if (name === "NotAllowedError" || /permission/i.test(message)) {
    return "Camera permission was denied. Allow camera access for this site in your browser settings, then reload.";
  }
  if (name === "NotFoundError" || /no camera|not found/i.test(message)) {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError" || /in use/i.test(message)) {
    return "The camera is being used by another app. Close it and try again.";
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Camera access needs HTTPS. Open this page over https:// (or on localhost) to scan.";
  }

  return message || "Could not start the camera.";
}
