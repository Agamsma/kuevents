import { NextResponse, type NextRequest } from "next/server";

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
  "/events/request",
];

const SIGNED_IN_HINT = "ku_signed_in";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !request.cookies.has(SIGNED_IN_HINT)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
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
