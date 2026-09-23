/**
 * CSV encoding for the attendee export.
 *
 * In `lib/` rather than beside the button because it is a security boundary,
 * and a security boundary that cannot be tested is one nobody can check. The
 * component keeps the download; this keeps the rules about what a cell may
 * contain.
 */

/**
 * Encodes one cell.
 *
 * Two separate problems, and only one of them is about commas.
 *
 * Quoting and doubling inner quotes is the RFC 4180 part: a name containing a
 * comma would otherwise shift every later column, and names containing commas
 * are ordinary.
 *
 * The other problem is that Excel and Google Sheets read a cell beginning with
 * `=`, `+`, `-`, `@`, tab or carriage return as a FORMULA — quoted or not.
 * Quoting does nothing about it.
 *
 * That matters here because the most interesting column is the student's own
 * Google display name. They choose it, it is copied onto the ticket at booking,
 * and an organizer later downloads the list and opens it in Excel. A display
 * name of `=HYPERLINK("http://example.invalid","Payroll")` becomes a link the
 * organizer's spreadsheet renders and invites them to click; the DDE forms are
 * worse. It is CSV injection (CWE-1236), and carrying it out needs nothing but
 * an edit to your own Google profile.
 *
 * A leading apostrophe is the usual advice and is wrong for this file. It
 * survives into anything that parses the CSV properly, so every consumer
 * downstream — another script, a database import — reads a name that starts
 * with a quote mark. A TAB stops the formula parser just as well, is stripped
 * by Excel on display, and stays ordinary whitespace to anything reading the
 * file as data.
 */
export function csvCell(cell: unknown): string {
  const text = String(cell ?? "");
  const risky = /^[=+\-@\t\r]/.test(text);

  return `"${(risky ? `\t${text}` : text).replace(/"/g, '""')}"`;
}

/**
 * Encodes a grid, CRLF-terminated as RFC 4180 specifies.
 *
 * The caller adds the UTF-8 BOM. That is a decision about the file, not about
 * its contents — without it Excel reads the bytes as the system codepage and
 * every non-ASCII name in the list arrives mangled.
 */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
