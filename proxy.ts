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

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");

  /*
   * Content-Security-Policy — the directives that hold without nonces.
   *
   * Deliberately incomplete, and worth being honest about why. A real
   * `script-src` needs a per-request nonce threaded through Next's inline
   * bootstrap scripts; anything less is `'unsafe-inline'`, which is a CSP that
   * looks like protection and provides almost none. That is a separate piece of
   * work, not something to half-do here.
   *
   * What is set below still closes real holes and cannot break the app:
   *
   *   object-src 'none'      — no Flash/applet embedding, an old XSS vector
   *   base-uri 'self'        — stops an injected <base> silently repointing
   *                            every relative URL on the page, including the
   *                            script Next loads its chunks from
   *   form-action 'self'     — an injected form cannot POST the page's fields
   *                            to another origin
   *   frame-ancestors 'none' — the modern X-Frame-Options; that header is
   *                            ignored by browsers that honour this one
   *   upgrade-insecure-requests — no mixed content on a page that opens a
   *                            camera and handles ID tokens
   */
  response.headers.set(
    "Content-Security-Policy",
    [
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  );

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
    /*
     * Everything except Next internals and static assets — matching those would
     * add latency to every chunk request for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|ico)$).*)",
  ],
};
