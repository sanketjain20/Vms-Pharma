// Credit position of a retailer, from what the phone knows: the invoiced balance and limit the
// office keeps, plus the rep's own orders that aren't invoiced yet (so a rep can't unknowingly
// pile three orders on a retailer who is already at the limit). Pure functions.
//
// Same rules as the office app: a limit of 0 means "no limit set"; "near" is 80% or more of the limit.
import { STATUS } from "./repOrders";

export const NEAR_RATIO = 0.8;

// Orders that will still turn into money owed: not refused, not rejected, not yet invoiced
// (invoiced ones are already inside the retailer's outstanding balance).
const OPEN = [STATUS.PENDING, STATUS.WITH_OFFICE, STATUS.FLAGGED, STATUS.APPROVED];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function pendingOrderValue(history, retailerId, excludeKey = null) {
  return history
    .filter((o) => String(o.retailerId) === String(retailerId) && OPEN.includes(o.status) && o.key !== excludeKey)
    .reduce((s, o) => s + num(o.total), 0);
}

/**
 * level: "none" (no limit set) | "ok" | "near" | "over", judged on exposure *after* this order.
 * excludeKey: the order being edited, so it isn't counted twice.
 */
export function creditStatus(retailer, history = [], orderTotal = 0, excludeKey = null) {
  if (!retailer) return null;
  const limit = num(retailer.creditLimit);
  const outstanding = num(retailer.outstandingBalance);
  const pending = pendingOrderValue(history, retailer.retailerId, excludeKey);
  const thisOrder = num(orderTotal);
  const hasLimit = limit > 0;

  const before = outstanding + pending;
  const after = before + thisOrder;

  let level = "none";
  if (hasLimit) level = after > limit ? "over" : after >= limit * NEAR_RATIO ? "near" : "ok";

  return {
    hasLimit, limit, outstanding, pending, thisOrder,
    exposureBefore: before,
    exposureAfter: after,
    available: hasLimit ? limit - before : null,
    usedPercent: hasLimit ? Math.round((after / limit) * 100) : null,
    level,
    alreadyOver: hasLimit && before > limit,
    pushesOver: hasLimit && before <= limit && after > limit,
    overBy: hasLimit && after > limit ? after - limit : 0,
  };
}
