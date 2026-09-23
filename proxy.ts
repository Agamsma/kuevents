import { NextResponse, type NextRequest } from "next/server";

import { SIGNED_IN_HINT_COOKIE } from "@/lib/constants";

/**
 * Edge-side routing guard. (Next 16 renamed this convention from `middleware`
 * to `proxy`; the behaviour is unchanged.)
 *
 * Firebase Auth keeps its session in IndexedDB, which this layer cannot read,
 * so it does exactly two honest things:
 *
 *  1. Bounces requests for protected routes that carry no sign-in hint cookie
 *     straight to /login, saving a flash of empty UI on cold navigations.
 *  2. Applies the security headers that matter for a page that opens a camera.
 *
 * It is NOT the authorisation boundary. The hint cookie is client-writable and
 * proves nothing. Real enforcement is `requireCaller()` on every API route plus
 * Firestore security rules — both of which run regardless of what happens here.
 *
 * The domain rule itself (`@karnavatiuniversity.edu.in`) is enforced where the
 * identity actually is: `lib/auth-context.tsx` on the client, `requireCaller()`
 * on the server, and `firestore.rules` at the database. All three call into the
 * single predicate in `lib/auth-domain.ts`.
 */

/**
 * Routes with nothing useful to show a signed-out visitor.
 *
 * "/" is deliberately absent: the landing page's hero renders for everyone and
 * only its directory asks for an account. Bouncing anonymous visitors off the
 * front door would mean the first thing anyone sees is a login form for a
 * product they have not been told anything about.
 */
const PROTECTED_PREFIXES = [
  "/scanner",
  "/organizer",
  "/tickets",
  "/proposals",
  "/admin",
  "/dashboard",
  "/staff",
  "/events/request",
];

/**
 * Paths inside a protected prefix that must stay reachable signed out.
 *
 * `/staff/login` is the staff console's own front door. It sits under `/staff`,
 * so without this exception the guard above would bounce a signed-out marshal
 * to the *student* login — the one outcome that page exists to avoid.
 */
const PUBLIC_EXCEPTIONS = ["/staff/login"];

/* ───────────────────────────────────────────────────────────────────────────
   Content-Security-Policy
   ───────────────────────────────────────────────────────────────────────────
   Every origin below is one this app genuinely talks to. The list IS the risk
   of this file: `default-src 'self'` blocks anything omitted, and it fails at
   runtime in a browser, not at build time. Anything added here later should be
   added because a real request was blocked, not pre-emptively.

   Two origins people expect to see, deliberately ABSENT:

     fonts.googleapis.com / fonts.gstatic.com — `next/font/google` downloads
       the faces at build time and serves them from our own origin. Adding them
       would widen the policy for requests the browser never makes.

     lh3.googleusercontent.com — `photo_url` is captured from the Google
       profile and stored, but nothing renders it. If an avatar is ever added
       to /staff/people, this is the line that has to change with it.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * `<project>.firebaseapp.com`, which serves the `/__/auth/handler` page that
 * `signInWithPopup` opens. Inlined at build time like every NEXT_PUBLIC_ value.
 */
const AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const AUTH_ORIGIN = AUTH_DOMAIN ? `https://${AUTH_DOMAIN}` : "";

/** Firebase's REST surfaces, reached by `fetch` from the client SDK. */
const FIREBASE_CONNECT = [
  "https://identitytoolkit.googleapis.com", // sign-in, profile lookup
  "https://securetoken.googleapis.com", // ID token refresh
  "https://firestore.googleapis.com", // Firestore, including WebChannel
  "https://firebasestorage.googleapis.com", // cover upload
  "https://www.googleapis.com", // SDK discovery
];

function buildCsp(nonce: string, isDev: boolean): string {
  /*
   * `'strict-dynamic'` is the directive doing the real work. With it, a script
   * injected into the DOM by an attacker cannot execute even though it is
   * sitting in the document, because it carries no nonce and was not inserted
   * by a script that did. It also means the `'self'` beside it is ignored by
   * every browser implementing CSP3 — kept only for the ones that do not,
   * where it still beats nothing.
   *
   * `'unsafe-eval'` in development is not optional: React's dev build uses
   * `eval` to reconstruct server-side error stacks in the browser. Production
   * uses neither it nor `eval`.
   */
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    isDev ? "'unsafe-eval'" : "",
  ].filter(Boolean);

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,

    /*
     * Styles split into two directives on purpose.
     *
     * `style-src` governs <style> elements and stylesheets, and Next attaches
     * the nonce to the ones it emits. `style-src-attr` governs inline
     * `style="..."` ATTRIBUTES — and nonces do not apply to attributes, so a
     * nonce-only policy blocks every one of them.
     *
     * This app cannot live with that. framer-motion animates by writing inline
     * styles on every frame (`components/motion/*`), and the poster spotlight
     * sets its stops from data. A nonce-only `style-src` with no
     * `style-src-attr` falls back to `style-src`, blocks all of it, and leaves
     * the interface visually destroyed while the console fills with violations.
     *
     * Allowing inline style attributes is a real but small concession: CSS
     * injection can exfiltrate attribute values through selectors, and it needs
     * an injection point to begin with. The protection that matters against
     * XSS is `script-src` above, which stays strict.
     */
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",

    // blob: for the cover-image preview in the proposal form, data: for the
    // inline SVG QR code on a pass.
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com",
    "font-src 'self'",
    ["connect-src 'self'", ...FIREBASE_CONNECT, AUTH_ORIGIN]
      .filter(Boolean)
      .join(" "),

    // The sign-in popup's handler page, and the account chooser it forwards to.
    ["frame-src", AUTH_ORIGIN, "https://accounts.google.com"]
      .filter(Boolean)
      .join(" "),

    // /sw.js is the app-shell worker; blob: covers the decoder html5-qrcode
    // spins up at the gate.
    "worker-src 'self' blob:",

    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    !PUBLIC_EXCEPTIONS.includes(pathname) &&
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

  if (isProtected && !request.cookies.has(SIGNED_IN_HINT_COOKIE)) {
    /*
     * Bounce to the door that matches the room.
     *
     * Someone deep-linking into the staff console while signed out was landing
     * on the student sign-in page, which then returned them to a console — two
     * different products in one flow. The staff console has its own front door
     * and this is the one place that decides which one you meet.
     */
    const isStaffPath =
      pathname === "/staff" ||
      pathname.startsWith("/staff/") ||
      // The gate keeps its own bare screen outside /staff, but it is staff
      // work: a marshal opening it cold should meet the staff door too.
      pathname.startsWith("/scanner");
    const login = new URL(isStaffPath ? "/staff/login" : "/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  /*
   * A fresh nonce per request, from the platform CSPRNG.
   *
   * Next reads this back out of the `Content-Security-Policy` REQUEST header
   * during render and attaches it to the framework bootstrap, the page chunks
   * and any <Script>. That is why the policy is set on the request headers as
   * well as the response: set it only on the response and the header is
   * correct, the page carries no matching nonce, and every script on the site
   * is blocked.
   */
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");

  /*
   * HSTS: two years, subdomains included, preload-eligible.
   *
   * Production only. A browser that picked this up from a plaintext localhost
   * response would go on refusing http://localhost for every other project on
   * the machine, and there is no per-port scoping to save you. Browsers ignore
   * the header over http anyway; this is belt and braces.
   */
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  /*
   * Sign-in is a popup, and this is the header that decides whether it works.
   *
   * `signInWithPopup` opens accounts.google.com and then polls `popup.closed`
   * to notice when the user finishes or dismisses it. Under the default
   * `same-origin`, the browser severs the opener relationship and blocks that
   * read — the console fills with "Cross-Origin-Opener-Policy policy would
   * block the window.closed call" and the promise never settles, so sign-in
   * hangs with no error to show.
   *
   * `same-origin-allow-popups` keeps this document isolated from anything that
   * opens *it* while still permitting popups it opened itself. Set explicitly
   * rather than left to the platform's default, because which default applies
   * varies by host and this is not a header to discover in production.
   */
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  // The scanner needs the camera; nothing else on the origin does.
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()",
  );

  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Everything except Next internals and static assets — matching those
       * would add latency to every chunk request for no benefit.
       */
      source:
        "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|ico)$).*)",
      /*
       * Skip prefetches.
       *
       * A prefetch triggered by <Link> would otherwise be served a document
       * carrying one nonce, which the router may then reuse for a navigation
       * happening under a later request with a different one — scripts blocked
       * on a page that looked fine when it was fetched. Next recommends this
       * exclusion for exactly that reason. Prefetches return RSC payloads with
       * no inline bootstrap of their own, so they need neither the nonce nor
       * the redirect; the real navigation that follows gets both.
       */
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
