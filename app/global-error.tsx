"use client";

import { useEffect } from "react";

/**
 * The last line of defence: an error thrown in the root layout itself.
 *
 * This replaces the entire document, so it cannot use the app's providers,
 * fonts or CSS variables — by definition, whatever renders those is what
 * failed. Everything here is inline and self-contained on purpose.
 *
 * The realistic trigger is a missing Firebase config at runtime, since
 * `lib/firebase.ts` throws at module scope when a NEXT_PUBLIC_ value is absent.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0708",
          color: "#f4efe9",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "26rem" }}>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.5625rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#6d635f",
            }}
          >
            KU Events
          </div>

          <h1
            style={{
              margin: "0.75rem 0 0",
              fontSize: "1.75rem",
              fontWeight: 600,
              lineHeight: 1.1,
            }}
          >
            The app failed to start
          </h1>

          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.9375rem",
              lineHeight: 1.6,
              color: "#a89d97",
            }}
          >
            This is usually a configuration problem rather than a fault on your
            side. If it keeps happening, send whoever runs the site the
            reference below.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "1.25rem 0 0",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.6875rem",
                color: "#6d635f",
              }}
            >
              {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "9999px",
              border: "none",
              // Literal, not var(--crimson): global-error replaces the whole
              // document, so globals.css may never have loaded. Keep in step
              // with --crimson by hand.
              background: "#da5045",
              color: "#1a0207",
              fontSize: "0.9375rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
