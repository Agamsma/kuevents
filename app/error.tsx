"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";

/**
 * Route-level error boundary.
 *
 * Without this, a single thrown render anywhere in a client component
 * white-screens the whole route — the user gets a blank page with no way back
 * and no idea what happened. This catches it, keeps the app navigable, and
 * offers the two things that actually help: retry, and a way home.
 *
 * `reset()` re-renders the segment without a full reload, so a transient
 * failure (a bad Firestore response, a race on mount) usually clears on the
 * first press.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Production stack traces are stripped, so the digest is the only handle
    // that ties this screen to a server log line.
    console.error("[route error]", error.digest ?? "", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-16">
      <Stub notched notchAt="calc(100% - 5rem)" className="w-full max-w-md overflow-hidden">
        <div className="px-6 pb-7 pt-7">
          <div className="flex size-11 items-center justify-center rounded-full bg-refuse/10 ring-1 ring-refuse/25">
            <TriangleAlert className="size-5 text-refuse" />
          </div>

          <h1 className="display mt-5 text-[1.75rem] leading-tight text-bone">
            That page hit a problem
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-bone-dim">
            Nothing you did caused this and nothing was lost. Trying again
            usually clears it.
          </p>

          {error.digest ? (
            <div className="mt-6">
              <FieldLabel>Reference</FieldLabel>
              <div className="mt-1.5 font-mono text-[11px] text-bone-faint">
                {error.digest}
              </div>
            </div>
          ) : null}
        </div>

        <Perforation className="mx-6" />

        <div className="flex h-20 items-center gap-2.5 px-6">
          <Button onClick={reset}>
            <RotateCw className="size-4" />
            Try again
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/">Back to events</Link>
          </Button>
        </div>
      </Stub>
    </main>
  );
}
