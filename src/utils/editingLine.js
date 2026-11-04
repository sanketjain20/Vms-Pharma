// Editing a line of a bill (Sales, Sales Edit): the line leaves the table while it is in the entry form, so it can't be
// deleted or changed there meanwhile, and goes back to its place on "Update Item" (changed) or "Cancel edit" (as it was).

import { lineGst, snapRate } from "./salesSchemes";

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** Takes line `index` out of the table: { lines: the rest, editing: { line, index } }. */
export function takeLine(lines, index) {
  return { lines: lines.filter((_, i) => i !== index), editing: { line: lines[index], index } };
}

/** Puts a line back where the edited one was (or at the end, if the table has since got shorter). */
export function putBack(lines, editing, line = editing.line) {
  const at = Math.min(Math.max(editing.index, 0), lines.length);
  return [...lines.slice(0, at), line, ...lines.slice(at)];
}

/**
 * Starts editing line `index` while another may already be in the form: that one goes back first (unchanged), and
 * `index` — a position in the table as it shows now — is taken from the table as it is then.
 */
export function switchEdit(lines, editing, index) {
  if (!editing) return takeLine(lines, index);
  const restored = putBack(lines, editing);
  return takeLine(restored, index >= editing.index ? index + 1 : index);
}

/**
 * The GST % a line is billed at, for the entry form: its override, its product's rate, the common rate it was saved
 * with — or, for a line from before product-wise GST, the rate its own GST amount works out to (snapped to a slab).
 * As a rate it follows the quantity; the ₹ amount alone would not.
 */
export function editRateOf(line) {
  const g = lineGst(line);
  if (g.rate !== null && g.rate !== undefined) return g.rate;
  const taxable = num(line.sellingPrice) * num(line.quantity) - num(line.schemeDiscount);
  return taxable > 0 ? snapRate((num(line.taxAmount) / taxable) * 100) : 0;
}

/**
 * What an edit keeps from the line it changes: its key and scheme choice always; its price change and GST override
 * only while it is still the same product (a different product starts from that product's own price and rate).
 */
export function keptOnEdit(line, productId) {
  if (!line) return {};
  const kept = { lineKey: line.lineKey, schemeOff: !!line.schemeOff };
  if (String(line.productId) !== String(productId)) return kept;
  if (line.overrideRate !== null && line.overrideRate !== undefined) {
    Object.assign(kept, { overrideRate: line.overrideRate, overrideReason: line.overrideReason || "" });
  }
  if (line.priceOverrideReason) {
    Object.assign(kept, {
      sellingPrice: line.sellingPrice, listPrice: line.listPrice ?? null,
      priceOverrideReason: line.priceOverrideReason, belowCostConfirmed: !!line.belowCostConfirmed,
    });
  }
  return kept;
}
