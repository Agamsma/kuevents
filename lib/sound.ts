"use client";

/**
 * Gate feedback tones, synthesised rather than loaded from files.
 *
 * A gate scanner is used offline and often on a first cold load in a basement,
 * so shipping .mp3s that may not be cached is a liability. WebAudio needs no
 * network and no assets, and gives us a distinct enough success/error pair that
 * a marshal can work by ear without looking at the screen.
 */

/**
 * One context for the life of the page, deliberately never torn down.
 *
 * Browsers cap a document at a handful of AudioContexts (~6 in Chrome) and
 * closing one is asynchronous, so creating a fresh context per scanner mount
 * would eventually throw and leave a gate silent mid-queue. A single suspended
 * context costs nothing; the `closed` guard below recreates it only if the
 * browser tears it down on our behalf.
 */
let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (ctx && ctx.state !== "closed") return ctx;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  return ctx;
}

/**
 * Browsers suspend audio until a user gesture. Call this from the tap that
 * starts the camera so the first scan is not silent.
 */
export async function primeAudio(): Promise<void> {
  const audio = audioContext();
  if (audio && audio.state === "suspended") {
    await audio.resume().catch(() => undefined);
  }
}

function tone(params: {
  freq: number;
  startAt: number;
  duration: number;
  type?: OscillatorType;
  peak?: number;
}) {
  const audio = audioContext();
  if (!audio) return;

  const { freq, startAt, duration, type = "sine", peak = 0.22 } = params;
  const t0 = audio.currentTime + startAt;

  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);

  // Short attack then exponential decay — a click-free blip that cuts through
  // crowd noise without the harshness of a square-wave buzzer.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Rising two-note chime. Admitted. */
export function playSuccess(): void {
  tone({ freq: 880, startAt: 0, duration: 0.11 });
  tone({ freq: 1318.5, startAt: 0.09, duration: 0.18 });
  vibrate([35]);
}

/** Low double buzz. Refused — duplicate, cancelled, or unknown code. */
export function playError(): void {
  tone({ freq: 220, startAt: 0, duration: 0.16, type: "square", peak: 0.16 });
  tone({ freq: 165, startAt: 0.18, duration: 0.26, type: "square", peak: 0.16 });
  vibrate([90, 60, 90]);
}

/** Neutral tick, for a code that is not one of ours at all. */
export function playNeutral(): void {
  tone({ freq: 520, startAt: 0, duration: 0.09, type: "triangle", peak: 0.14 });
  vibrate([20]);
}

function vibrate(pattern: number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(pattern);
  }
}
