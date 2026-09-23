import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier.
import { authorize, parseBearerToken } from "./auth-decision.ts";

/*
 * These cover the refusal paths of the thing that guards every API route.
 *
 * Every case here is a way in if it returns the wrong answer, so they are
 * written as "this must be refused" rather than as a happy path with a few
 * negatives appended.
 */

describe("parseBearerToken", () => {
  it("reads a well-formed header", () => {
    assert.equal(parseBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
  });

  it("treats the scheme as case-insensitive, as RFC 7235 requires", () => {
    assert.equal(parseBearerToken("bearer tok"), "tok");
    assert.equal(parseBearerToken("BEARER tok"), "tok");
    assert.equal(parseBearerToken("BeArEr tok"), "tok");
  });

  it("tolerates surrounding and internal whitespace", () => {
    assert.equal(parseBearerToken("  Bearer tok  "), "tok");
    assert.equal(parseBearerToken("Bearer\ttok"), "tok");
  });

  it("refuses a missing header", () => {
    assert.equal(parseBearerToken(null), null);
    assert.equal(parseBearerToken(undefined), null);
    assert.equal(parseBearerToken(""), null);
    assert.equal(parseBearerToken("   "), null);
  });

  it("refuses another scheme", () => {
    assert.equal(parseBearerToken("Basic dXNlcjpwYXNz"), null);
    assert.equal(parseBearerToken("Token abc"), null);
  });

  it("refuses a scheme with no credential", () => {
    assert.equal(parseBearerToken("Bearer"), null);
    assert.equal(parseBearerToken("Bearer "), null);
  });

  it("refuses a header with extra parts rather than using the first", () => {
    // A JWT contains no spaces, so this is malformed input. Taking `a` and
    // discarding the rest is how a lenient parser becomes a way in.
    assert.equal(parseBearerToken("Bearer a b"), null);
    assert.equal(parseBearerToken("Bearer tok extra"), null);
  });
});

describe("authorize — domain", () => {
  const ok = { profileExists: true, profileRole: "student" as const };

  it("admits a university account", () => {
    const result = authorize({ email: "asha@karnavatiuniversity.edu.in", ...ok });
    assert.equal(result.ok, true);
  });

  it("admits regardless of case", () => {
    const result = authorize({ email: "Asha@Karnavatiuniversity.EDU.IN", ...ok });
    assert.equal(result.ok, true);
  });

  it("refuses an outside account", () => {
    const result = authorize({ email: "someone@gmail.com", ...ok });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 403);
  });

  it("refuses a lookalike domain", () => {
    // The reason `isUniversityEmail` compares the domain part rather than
    // calling endsWith on the whole address.
    const result = authorize({
      email: "attacker@evil-karnavatiuniversity.edu.in",
      ...ok,
    });
    assert.equal(result.ok, false);
  });

  it("refuses a subdomain of the university domain", () => {
    const result = authorize({
      email: "attacker@sub.karnavatiuniversity.edu.in",
      ...ok,
    });
    assert.equal(result.ok, false);
  });

  it("refuses the domain appearing in the local part", () => {
    const result = authorize({
      email: "karnavatiuniversity.edu.in@gmail.com",
      ...ok,
    });
    assert.equal(result.ok, false);
  });

  it("refuses a missing or malformed address", () => {
    assert.equal(authorize({ email: null, ...ok }).ok, false);
    assert.equal(authorize({ email: undefined, ...ok }).ok, false);
    assert.equal(authorize({ email: "", ...ok }).ok, false);
    assert.equal(authorize({ email: "no-at-sign", ...ok }).ok, false);
  });
});

describe("authorize — profile", () => {
  const email = "asha@karnavatiuniversity.edu.in";

  it("refuses an account with no profile document", () => {
    const result = authorize({
      email,
      profileExists: false,
      profileRole: undefined,
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 403);
  });

  it("refuses a profile carrying no role rather than assuming student", () => {
    const result = authorize({
      email,
      profileExists: true,
      profileRole: undefined,
      allowedRoles: ["student"],
    });
    assert.equal(result.ok, false);
  });
});

describe("authorize — roles", () => {
  const email = "asha@karnavatiuniversity.edu.in";
  const base = { email, profileExists: true };

  it("admits any role when the route names none", () => {
    for (const role of ["student", "scanner", "organizer", "superadmin"] as const) {
      assert.equal(authorize({ ...base, profileRole: role }).ok, true, role);
    }
  });

  it("refuses a student at a staff-only route", () => {
    const result = authorize({
      ...base,
      profileRole: "student",
      allowedRoles: ["scanner", "organizer", "superadmin"],
    });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.refusal.status, 403);
  });

  it("refuses a scanner at an organizer-only route", () => {
    const result = authorize({
      ...base,
      profileRole: "scanner",
      allowedRoles: ["organizer", "superadmin"],
    });
    assert.equal(result.ok, false);
  });

  it("refuses an organizer at a superadmin-only route", () => {
    // /api/admin/users. An organizer reaching this would be able to assign
    // roles, which is the escalation the whole role system exists to prevent.
    const result = authorize({
      ...base,
      profileRole: "organizer",
      allowedRoles: ["superadmin"],
    });
    assert.equal(result.ok, false);
  });

  it("does not let a superadmin be refused by a narrower route", () => {
    const result = authorize({
      ...base,
      profileRole: "superadmin",
      allowedRoles: ["superadmin"],
    });
    assert.equal(result.ok, true);
  });

  it("names the roles a route accepts, so the refusal is actionable", () => {
    const result = authorize({
      ...base,
      profileRole: "student",
      allowedRoles: ["organizer", "superadmin"],
    });
    assert.equal(
      result.ok === false && result.refusal.message,
      "Requires one of: organizer, superadmin.",
    );
  });

  it("returns the role it admitted, so the caller need not re-read it", () => {
    const result = authorize({ ...base, profileRole: "organizer" });
    assert.equal(result.ok === true && result.role, "organizer");
  });
});
