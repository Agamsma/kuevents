import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Force `firebase-admin` into every server trace.
   *
   * It is on Next's automatic externals list, so Turbopack does not bundle it —
   * it emits a `require` resolved at runtime instead. That only works if the
   * package is actually present next to the deployed function, and the tracer
   * did not include it: every API route on Vercel returned
   *
   *   Error: Failed to load external module firebase-admin-<hash>/auth
   *
   * as a 500 with an empty body, while pages and middleware — which never
   * import it — served normally. Locally it was invisible, because `next start`
   * resolves straight out of node_modules on disk.
   *
   * Keyed `/**` rather than `/api/**`: the landing page and the event page also
   * reach `lib/events-server.ts` during SSR, so they need it in their trace too.
   */
  outputFileTracingIncludes: {
    "/**": ["./node_modules/firebase-admin/**/*"],
  },

  images: {
    /*
     * Event covers live in Firebase Storage. Narrowed to that one host on
     * purpose — a wildcard here would turn the image optimiser into an open
     * proxy that anyone could point at any URL on the internet.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
    ],
  },
};

export default nextConfig;
