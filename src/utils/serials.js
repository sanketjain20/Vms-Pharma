// Serial numbers / IMEI (Phase 6). The same rules as the server (Utils/SerialNumbers.java): a serial is written down
// trimmed, without spaces, in upper case; a list needs one per unit and none repeated.

export const MAX_LENGTH = 80;

/** " sn 001 " → "SN001". */
export const normalizeSerial = (raw) => String(raw ?? "").replace(/\s+/g, "").toUpperCase();

/** What was typed, pasted or scanned (one per line, or separated by commas / semicolons) → the serials, blanks dropped. */
export const parseSerials = (text) => String(text ?? "").split(/[\n,;]+/).map(normalizeSerial).filter(Boolean);

/** The serials that appear more than once. */
export const repeatedSerials = (serials) => {
  const seen = new Set();
  const repeated = new Set();
  (serials || []).forEach((s) => (seen.has(s) ? repeated.add(s) : seen.add(s)));
  return [...repeated];
};

/** Why this list can't be used for `needed` units, or "" when it can. */
export function serialProblem(serials, needed) {
  const list = serials || [];
  const repeated = repeatedSerials(list);
  if (repeated.length) return `Entered more than once: ${repeated.join(", ")}`;
  const tooLong = list.find((s) => s.length > MAX_LENGTH);
  if (tooLong) return `Longer than ${MAX_LENGTH} characters: ${tooLong}`;
  if (list.length !== needed) return `${list.length} of ${needed} serial number${needed === 1 ? "" : "s"} entered`;
  return "";
}

/** Whether a product (from the product list) tracks serial numbers. */
export const tracksSerials = (product) => !!product?.trackSerial;

/** "Warranty till 22-10-2027" from "2027-10-22"; "" when none. */
export function warrantyText(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-");
  return y && m && d ? `Warranty till ${d}-${m}-${y}` : "";
}
