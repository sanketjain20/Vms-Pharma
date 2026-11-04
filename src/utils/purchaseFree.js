// Free goods on a purchase line (a supplier scheme such as 10 + 1). The supplier bills the paid quantity only; the
// free units come into stock too, so each received unit really costs the bill spread over all of them — the same
// rule the server applies to the batch (PurchaseItem.effectiveUnitCost).

const int = (v) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : 0);

/** Units taken into stock: paid + free. */
export const receivedQty = (quantity, freeQuantity) => int(quantity) + Math.max(int(freeQuantity), 0);

/** What one received unit really costs (2 decimals): 100 at ₹90 + 10 free → 81.82. Without free goods, the rate. */
export function effectiveCost(rate, quantity, freeQuantity) {
  const r = parseFloat(rate);
  if (!Number.isFinite(r)) return null;
  const paid = int(quantity);
  const free = Math.max(int(freeQuantity), 0);
  if (free === 0 || paid + free === 0) return r;
  return Math.round(((r * paid) / (paid + free)) * 100) / 100;
}

/** "110 into stock at ₹81.82 each" for a line with free goods, else "". */
export function freeNote(rate, quantity, freeQuantity) {
  if (Math.max(int(freeQuantity), 0) === 0) return "";
  const cost = effectiveCost(rate, quantity, freeQuantity);
  return `${receivedQty(quantity, freeQuantity)} into stock${cost === null ? "" : ` at ₹${cost.toFixed(2)} each`}`;
}
