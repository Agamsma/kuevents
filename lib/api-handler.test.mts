import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError, apiRoute, readJson } from "./api-handler.ts";

/**
 * The guarantee under test: a client can always parse what comes back.
 *
 * These exist because the opposite shipped. Every API route rethrew anything
 * that was not an `AuthError`, Next turned that into a 500 with an empty body,
 * and the browser's `response.json()` reported `Unexpected end of JSON input` —
 * naming the parse and hiding the fault. A student saw that sentence where the
 * reason they had no pass should have been.
 */

const request = (body?: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
  });

describe("apiRoute", () => {
  it("passes a successful response straight through", async () => {
    const handler = apiRoute("t", async () => Response.json({ ok: true }));
    const response = await handler(request());

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("returns JSON, not an empty body, when a handler throws", async () => {
    const handler = apiRoute("t", async () => {
      throw new Error("connection to 10.0.0.4:5432 refused");
    });

    const response = await handler(request());
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.notEqual(text, "", "an empty body is what this exists to prevent");
    assert.doesNotThrow(() => JSON.parse(text));
    assert.equal(typeof JSON.parse(text).error, "string");
  });

  it("does not leak an unexpected error's message to the caller", async () => {
    const secret = "postgres://admin:hunter2@10.0.0.4/kuevents";
    const handler = apiRoute("t", async () => {
      throw new Error(secret);
    });

    const body = await (await handler(request())).json();
    assert.ok(!body.error.includes(secret));
    assert.ok(!body.error.includes("10.0.0.4"));
  });

  it("honours the status and message of an ApiError", async () => {
    const handler = apiRoute("t", async () => {
      throw new ApiError("`event_id` is required.", 400);
    });

    const response = await handler(request());
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "`event_id` is required.");
  });

  it("honours any error carrying a status, so AuthError and BookingError work", async () => {
    // Duck-typed on purpose: the wrapper must stay out of the firebase-admin
    // import graph, so it cannot `instanceof` the error classes defined there.
    class BookingError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.status = status;
      }
    }

    const handler = apiRoute("t", async () => {
      throw new BookingError("You already have a pass for this event.", 409);
    });

    const response = await handler(request());
    assert.equal(response.status, 409);
    assert.equal(
      (await response.json()).error,
      "You already have a pass for this event.",
    );
  });

  it("ignores a status outside the error range rather than trusting it", async () => {
    const bogus = Object.assign(new Error("boom"), { status: 200 });
    const handler = apiRoute("t", async () => {
      throw bogus;
    });

    // A thrown error must never produce a 2xx, whatever it claims about itself.
    assert.equal((await handler(request())).status, 500);
  });
});

describe("readJson", () => {
  it("parses a JSON body", async () => {
    assert.deepEqual(await readJson(request({ event_id: "abc" })), {
      event_id: "abc",
    });
  });

  it("turns a malformed body into a 400, not a crash", async () => {
    const handler = apiRoute("t", async (r) => Response.json(await readJson(r)));
    const response = await handler(request("{not json"));

    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Body must be JSON.");
  });

  it("turns an empty body into a 400", async () => {
    const handler = apiRoute("t", async (r) => Response.json(await readJson(r)));
    const response = await handler(
      new Request("http://test/api", { method: "POST" }),
    );

    assert.equal(response.status, 400);
  });
});
