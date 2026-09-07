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

          {/*
           * The message, on screen, behind one tap.
           *
           * It used to go only to `console.error`, which is unreachable for the
           * person actually hitting the fault: a marshal on a phone at a gate,
           * or a student who cannot open DevTools and would not be asked to.
           * "Something went wrong" with the cause hidden one layer away turns
           * every report into a guessing game — the fault is reproducible for
           * them and invisible to everyone who could fix it.
           *
           * Collapsed by default so the reassuring copy still leads, and the
           * stack is capped: past a few frames it is minified noise that pushes
           * the retry button off a small screen.
           */}
          {error.message ? (
            <details className="group mt-6">
              <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.14em] text-bone-faint transition-colors hover:text-bone-dim">
                Technical details
              </summary>

              <div className="mt-2.5 max-h-52 overflow-auto rounded-md bg-black/25 px-3 py-2.5">
                <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-bone-dim">
                  {error.message}
                </pre>

                {error.stack ? (
                  <pre className="mt-2 whitespace-pre-wrap break-words border-t border-[color:var(--line)] pt-2 font-mono text-[10px] leading-relaxed text-bone-faint">
                    {error.stack.split("\n").slice(1, 7).join("\n")}
                  </pre>
                ) : null}
              </div>
            </details>
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
