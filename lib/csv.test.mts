import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Relative, with the extension: `node --test` resolves neither the `@/` alias
// nor a bare specifier.
import { csvCell, toCsv } from "./csv.ts";

describe("csvCell — RFC 4180", () => {
  it("quotes every cell, so a parser never has to guess", () => {
    assert.equal(csvCell("Asha"), '"Asha"');
  });

  it("survives a comma without shifting the row", () => {
    assert.equal(csvCell("KSD Clinic Block, Ground Floor"), '"KSD Clinic Block, Ground Floor"');
  });

  it("doubles inner quotes", () => {
    assert.equal(csvCell('She said "hello"'), '"She said ""hello"""');
  });

  it("renders null and undefined as empty rather than as words", () => {
    assert.equal(csvCell(null), '""');
    assert.equal(csvCell(undefined), '""');
  });

  it("keeps numbers intact", () => {
    assert.equal(csvCell(42), '"42"');
    assert.equal(csvCell(0), '"0"');
  });
});

describe("csvCell — formula injection", () => {
  /*
   * The attacker is a student editing their own Google display name, and the
   * victim is an organizer opening the export in Excel. Each of these is a
   * character Excel and Sheets treat as the start of a formula.
   */
  it("neutralises a leading =", () => {
    assert.equal(
      csvCell('=HYPERLINK("http://example.invalid","Payroll")'),
      '"\t=HYPERLINK(""http://example.invalid"",""Payroll"")"',
    );
  });

  it("neutralises the other formula leaders", () => {
    for (const lead of ["=", "+", "-", "@"]) {
      const encoded = csvCell(`${lead}cmd`);
      assert.equal(encoded, `"\t${lead}cmd"`, lead);
    }
  });

  it("neutralises a leading tab or carriage return", () => {
    // Both are accepted as formula leaders once Excel trims them.
    assert.equal(csvCell("\t=1+1"), '"\t\t=1+1"');
    assert.equal(csvCell("\r=1+1"), '"\t\r=1+1"');
  });

  it("prefixes a tab rather than an apostrophe", () => {
    // An apostrophe would survive into every downstream consumer of the file.
    const encoded = csvCell("=1+1");
    assert.ok(encoded.startsWith('"\t'), encoded);
    assert.ok(!encoded.includes("'"), encoded);
  });

  it("leaves an ordinary name untouched", () => {
    // The guard must not tax the 99% case — no stray whitespace on real names.
    assert.equal(csvCell("Asha Mehta"), '"Asha Mehta"');
    assert.equal(csvCell("O'Neill"), `"O'Neill"`);
  });

  it("does not fire on a character merely containing a leader", () => {
    assert.equal(csvCell("a=b"), '"a=b"');
    assert.equal(csvCell("asha@karnavatiuniversity.edu.in"), '"asha@karnavatiuniversity.edu.in"');
  });

  it("still catches a negative number, which is the acceptable false positive", () => {
    // "-5" is a formula leader to Excel and cannot be told apart from "-cmd"
    // without guessing at intent. Guessing wrong in the other direction is an
    // executed formula, so this one errs toward a stray tab.
    assert.equal(csvCell("-5"), '"\t-5"');
  });
});

describe("toCsv", () => {
  it("joins rows with CRLF, as the spec requires", () => {
    const csv = toCsv([
      ["Name", "Email"],
      ["Asha", "asha@karnavatiuniversity.edu.in"],
    ]);

    assert.equal(
      csv,
      '"Name","Email"\r\n"Asha","asha@karnavatiuniversity.edu.in"',
    );
  });

  it("carries the escaping through a whole grid", () => {
    const csv = toCsv([["=BAD()", "ok, then"]]);
    assert.equal(csv, '"\t=BAD()","ok, then"');
  });

  it("handles an empty grid", () => {
    assert.equal(toCsv([]), "");
  });
});
