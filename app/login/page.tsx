"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth-domain";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/brand/mark";
import { FieldLabel, Perforation } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.64h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.56Z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.02-6.45-4.75H1.71v2.98A11.5 11.5 0 0 0 12 23.5Z"
      />
      <path
        fill="#FBBC05"
        d="M5.55 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.71a11.51 11.51 0 0 0 0 10.3l3.84-2.98Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.72 1.29 15.11.25 12 .25A11.5 11.5 0 0 0 1.71 6.85l3.84 2.98C6.46 7.1 9 4.75 12 4.75Z"
      />
    </svg>
  );
}

/**
 * Where to land after a successful sign-in.
 *
 * Read straight off `window.location` rather than with `useSearchParams()`.
 * That hook opts the whole route out of prerendering, which would serve a bare
 * spinner as the static HTML for the one page every user hits first.
 *
 * Only same-origin paths are honoured, so a crafted
 * `/login?next=https://evil.example` cannot turn sign-in into an open redirect.
 */
function resolveNextPath(): string {
  if (typeof window === "undefined") return "/";

  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return "/";

  return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(resolveNextPath());
  }, [loading, user, router]);

  const handleSignIn = useCallback(async () => {
    setSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace(resolveNextPath());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sign-in failed. Try again.";

      // A user closing the Google popup is not an error worth shouting about.
      if (!/popup-closed-by-user|cancelled-popup-request/.test(message)) {
        toast.error("Could not sign you in", {
          id: "signin",
          description: message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [signInWithGoogle, router]);

  // `loading` (restoring a session) and `submitting` (the user tapped) both
  // disable the button, but only the second may claim a sign-in is happening.
  const busy = submitting || loading;

  return (
    <main
      data-theme="paper"
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-5 py-10 text-ink"
    >
      {/*
       * Paper does not glow, so the blurred crimson and gold orbs that lit the
       * dark ground are gone. What replaces them is what light does to paper:
       * a single warm wash falling from the top-left, and a barely-there tint
       * pooling at the bottom. Flat white would read as a form; this reads as
       * a sheet lying under a lamp.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 15% 0%, #ffffff 0%, transparent 55%), radial-gradient(90% 60% at 85% 100%, #f5ece2 0%, transparent 60%)",
        }}
      />

      {/* The sign-in card IS a ticket stub, torn across the middle. */}
      <div className="animate-stub-in stub stub-notched relative w-full max-w-[23rem] overflow-hidden" style={{ ["--at" as string]: "62%" }}>
        <div className="px-7 pb-8 pt-9">
          {/*
           * The one place the university introduces itself by name and mark.
           * A student arriving here may have followed a link with no idea whose
           * platform this is; the crest answers that before the heading does.
           */}
          <Mark size={64} priority className="mb-5" />

          <FieldLabel>Karnavati University</FieldLabel>

          <h1 className="display mt-3 text-[2.75rem] text-ink">
            KU
            <br />
            Events
          </h1>

          <p className="mt-4 max-w-[17rem] text-[15px] leading-relaxed text-ink-dim">
            Your pass lives on your phone. The gate reads it even with no
            signal.
          </p>

          {/* Two facts, set as ticket fields — the product in six words. */}
          <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <FieldLabel>Admits</FieldLabel>
              <div className="mt-1 font-mono text-sm text-ink">ONE, ONCE</div>
            </div>
            <div>
              <FieldLabel>Works offline</FieldLabel>
              {/*
               * `--admit` is the gate's green and is tuned for a near-black
               * ground; on paper it is far too light to read. This is a claim
               * on a marketing card, not a verdict at a gate, so it takes the
               * brand colour rather than borrowing the gate's vocabulary.
               */}
              <div className="mt-1 font-mono text-sm text-ku-red">YES</div>
            </div>
          </div>
        </div>

        <Perforation className="mx-6" />

        <div className="px-7 pb-7 pt-6">
          <Button
            size="xl"
            variant="secondary"
            className="w-full"
            onClick={handleSignIn}
            disabled={busy}
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <GoogleMark />}
            {submitting ? "Signing in" : "Continue with Google"}
          </Button>

          {/*
           * `ink-soft`, not `ink-faint`: this is text, and faint measures
           * 3.68:1 on paper — legible enough for a rule or a disabled mark and
           * not for a sentence. `lib/theme.test.mts` asserts that distinction
           * rather than trusting it to be remembered.
           */}
          <p className="mt-4 text-center font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-ink-soft">
            @{ALLOWED_EMAIL_DOMAIN} only
          </p>
        </div>
      </div>
    </main>
  );
}
