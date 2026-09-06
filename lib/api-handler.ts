/**
 * One guarantee, applied to every API route: **the client always gets JSON.**
 *
 * Without this, any throw a handler does not explicitly catch becomes a bare
 * 500 with an empty body. The client then calls `response.json()` on nothing
 * and reports `Unexpected end of JSON input` — a parse error that names the
 * symptom and hides the cause, sending whoever is debugging it into the client
 * when the fault is on the server. Every route now fails the same legible way.
 *
 * Deliberately free of the `firebase-admin` import chain. If this module were
 * pulled into that graph, a failure to load it would take the error reporter
 * down with the thing it exists to report on.
 *
 * It also uses the Web-standard `Response.json()` rather than `NextResponse`,
 * which route handlers accept identically. That keeps the module loadable
 * outside the framework, so `api-handler.test.mts` can exercise the guarantee
 * under plain `node --test` instead of trusting it.
 */

/**
 * Thrown by a handler to choose a status and a message safe to show a user.
 *
 * `status` is assigned in the body rather than declared as a constructor
 * parameter property: Node's `--test` type stripping cannot compile those, and
 * this module has to stay importable by `api-handler.test.mts`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Both `ApiError` and `server-auth`'s `AuthError` carry a numeric `status`.
 * Duck-typed rather than imported, for the isolation reason above.
 */
function intendedStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("status" in error)) return null;

  const status = (error as { status: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 600
    ? status
    : null;
}

/**
 * Wraps a route handler.
 *
 * Errors carrying a `status` are the handler speaking deliberately, so their
 * message reaches the caller. Anything else is a bug: it is logged in full
 * server-side and reported to the caller as a generic 500, because an
 * unexpected error's message routinely contains connection strings, file
 * paths and internal identifiers.
 */
export function apiRoute<T extends unknown[]>(
  name: string,
  handler: (request: Request, ...rest: T) => Promise<Response>,
): (request: Request, ...rest: T) => Promise<Response> {
  return async (request, ...rest) => {
    try {
      return await handler(request, ...rest);
    } catch (error) {
      const status = intendedStatus(error);

      if (status !== null) {
        return Response.json({ error: (error as Error).message }, { status });
      }

      console.error(`[${name}] unhandled`, error);

      return Response.json(
        { error: "Something went wrong on our side. Please try again." },
        { status: 500 },
      );
    }
  };
}

/** Parses a JSON body, turning malformed input into a 400 rather than a 500. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Body must be JSON.", 400);
  }
}
