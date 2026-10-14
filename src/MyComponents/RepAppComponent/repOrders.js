// Order history for the rep app: merges what's on the phone with what the server
// knows, then filters / sorts / groups it. Pure functions — no React, no I/O.
import { STATE } from "./repSync";

export const STATUS = {
  PENDING: "PENDING",         // saved on the phone, not sent yet
  INVALID: "INVALID",         // server refused it
  FLAGGED: "FLAGGED",         // sent, but a price/stock moved — office will review
  WITH_OFFICE: "WITH_OFFICE", // sent, waiting for the office
  APPROVED: "APPROVED",
  INVOICED: "INVOICED",
  REJECTED: "REJECTED",
};

// label, badge tone
export const STATUS_META = {
  PENDING: ["Waiting to send", "warn"],
  INVALID: ["Refused", "bad"],
  FLAGGED: ["Sent — flagged", "warn"],
  WITH_OFFICE: ["Sent", "ok"],
  APPROVED: ["Approved", "ok"],
  INVOICED: ["Invoiced", "ok"],
  REJECTED: ["Rejected", "bad"],
};

export const ATTENTION = [STATUS.PENDING, STATUS.INVALID, STATUS.FLAGGED];

const SERVER_TO_STATUS = { APPROVED: STATUS.APPROVED, CONVERTED: STATUS.INVOICED, REJECTED: STATUS.REJECTED };

function localToStatus(state) {
  if (state === STATE.PENDING) return STATUS.PENDING;
  if (state === STATE.INVALID) return STATUS.INVALID;
  if (state === STATE.CONFLICT) return STATUS.FLAGGED;
  return STATUS.WITH_OFFICE;
}

const serverItem = (i) => ({
  productId: i.productId,
  name: i.productName,
  quantity: i.quantity,
  quotedPrice: i.quotedPrice,
  conflict: i.conflictReason
    ? { reason: i.conflictReason, quotedPrice: i.quotedPrice, currentPrice: i.currentPrice, availableQty: i.availableQty }
    : null,
});

/**
 * One list of every order the rep has: the ones still on the phone (including unsent
 * and refused) and the server's history (which goes back further than the 7 days the
 * phone keeps). Once the server has an order, its numbers and status win.
 */
export function unifyOrders(localOrders = [], serverOrders = []) {
  const serverByNumber = new Map(serverOrders.map((s) => [s.orderNumber, s]));
  const used = new Set();
  const out = [];

  for (const o of localOrders) {
    const server = o.serverOrderNumber ? serverByNumber.get(o.serverOrderNumber) : null;
    if (server) used.add(server.orderNumber);

    let status = localToStatus(o.state);
    if (server && SERVER_TO_STATUS[server.status]) status = SERVER_TO_STATUS[server.status];

    out.push({
      key: o.clientOrderId,
      clientOrderId: o.clientOrderId,
      orderNumber: o.serverOrderNumber || null,
      retailerId: o.retailerId,
      retailerName: o.retailerName || server?.retailerName || "",
      capturedAt: o.capturedAt || server?.capturedAt,
      total: Number(server ? server.totalAmount : o.total) || 0,
      remarks: o.remarks || server?.remarks || null,
      message: o.message,
      rejectReason: server?.rejectReason || null,
      staleEdit: !!o.staleEdit,
      status,
      local: true,
      items: server?.items?.length
        ? server.items.map(serverItem)
        : (o.items || []).map((i) => ({
            productId: i.productId,
            name: i.name,
            quantity: i.quantity,
            quotedPrice: i.quotedPrice,
            conflict: (o.conflicts || []).find((c) => c.productId === i.productId) || null,
          })),
    });
  }

  for (const s of serverOrders) {
    if (used.has(s.orderNumber)) continue;
    out.push({
      key: s.uKey || s.orderNumber,
      clientOrderId: null,
      orderNumber: s.orderNumber,
      retailerId: s.retailerId,
      retailerName: s.retailerName || "",
      capturedAt: s.capturedAt || s.createdAt,
      total: Number(s.totalAmount) || 0,
      remarks: s.remarks || null,
      message: null,
      rejectReason: s.rejectReason || null,
      status: SERVER_TO_STATUS[s.status] || (s.hasConflict ? STATUS.FLAGGED : STATUS.WITH_OFFICE),
      local: false,
      items: (s.items || []).map(serverItem),
    });
  }

  return out.sort((a, b) => timeOf(b) - timeOf(a));
}

const timeOf = (o) => {
  const t = new Date(o.capturedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

// ───────────── filtering ─────────────

export const DEFAULT_FILTERS = {
  q: "",
  status: "ALL",     // ALL | ATTENTION | one STATUS key
  retailerId: "",
  period: "ALL",     // ALL | TODAY | YESTERDAY | LAST7 | LAST30 | THIS_MONTH | LAST_MONTH | MONTH | CUSTOM
  month: "",         // yyyy-mm, used when period = MONTH
  from: "",          // yyyy-mm-dd, used when period = CUSTOM
  to: "",
  min: "",
  max: "",
  sort: "NEWEST",    // NEWEST | OLDEST | HIGHEST | LOWEST
};

export const PERIODS = [
  ["ALL", "All time"],
  ["TODAY", "Today"],
  ["YESTERDAY", "Yesterday"],
  ["LAST7", "Last 7 days"],
  ["LAST30", "Last 30 days"],
  ["THIS_MONTH", "This month"],
  ["LAST_MONTH", "Last month"],
  ["MONTH", "Pick a month…"],
  ["CUSTOM", "Custom dates…"],
];

export const SORTS = [
  ["NEWEST", "Newest first"],
  ["OLDEST", "Oldest first"],
  ["HIGHEST", "Highest value"],
  ["LOWEST", "Lowest value"],
];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Local-time midnight for "yyyy-mm-dd" (new Date("2026-10-01") would be UTC and shift a day).
function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** [start, endExclusive) for the chosen period, or null for "no date limit". */
export function periodRange(f, now = new Date()) {
  const today = startOfDay(now);
  switch (f.period) {
    case "TODAY": return [today, addDays(today, 1)];
    case "YESTERDAY": return [addDays(today, -1), today];
    case "LAST7": return [addDays(today, -6), addDays(today, 1)];
    case "LAST30": return [addDays(today, -29), addDays(today, 1)];
    case "THIS_MONTH": return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
    case "LAST_MONTH": return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
    case "MONTH": {
      const m = /^(\d{4})-(\d{2})$/.exec(f.month || "");
      return m ? [new Date(Number(m[1]), Number(m[2]) - 1, 1), new Date(Number(m[1]), Number(m[2]), 1)] : null;
    }
    case "CUSTOM": {
      const from = parseDay(f.from);
      const to = parseDay(f.to);
      if (!from && !to) return null;
      return [from || new Date(0), to ? addDays(to, 1) : new Date(8640000000000000)];
    }
    default: return null;
  }
}

const norm = (s) => String(s ?? "").toLowerCase();

function matchesText(o, q) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = norm([o.retailerName, o.orderNumber, o.remarks, ...o.items.map((i) => i.name)].join(" \n "));
  return tokens.every((t) => hay.includes(t));
}

export function applyFilters(list, f, now = new Date()) {
  const range = periodRange(f, now);
  const min = f.min === "" ? null : Number(f.min);
  const max = f.max === "" ? null : Number(f.max);

  const out = list.filter((o) => {
    if (f.status === "ATTENTION") { if (!ATTENTION.includes(o.status)) return false; }
    else if (f.status && f.status !== "ALL" && o.status !== f.status) return false;

    if (f.retailerId && String(o.retailerId) !== String(f.retailerId)) return false;

    if (range) {
      const t = timeOf(o);
      if (t < range[0].getTime() || t >= range[1].getTime()) return false;
    }
    if (min !== null && !Number.isNaN(min) && o.total < min) return false;
    if (max !== null && !Number.isNaN(max) && o.total > max) return false;
    return matchesText(o, f.q);
  });

  const by = {
    NEWEST: (a, b) => timeOf(b) - timeOf(a),
    OLDEST: (a, b) => timeOf(a) - timeOf(b),
    HIGHEST: (a, b) => b.total - a.total,
    LOWEST: (a, b) => a.total - b.total,
  }[f.sort] || ((a, b) => timeOf(b) - timeOf(a));
  return out.sort(by);
}

/** How many filters are narrowing the list (sort doesn't count). */
export function countActive(f) {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.status !== "ALL") n++;
  if (f.retailerId) n++;
  if (f.period !== "ALL" && periodRange(f)) n++;
  if (f.min !== "" || f.max !== "") n++;
  return n;
}

export function statusCounts(list, f, now = new Date()) {
  // Counted with every other filter applied, so a chip's number is what you'd get by tapping it.
  const base = applyFilters(list, { ...f, status: "ALL" }, now);
  const counts = { ALL: base.length, ATTENTION: base.filter((o) => ATTENTION.includes(o.status)).length };
  Object.keys(STATUS).forEach((k) => { counts[k] = base.filter((o) => o.status === k).length; });
  return counts;
}

export function summarize(list) {
  return { count: list.length, total: list.reduce((s, o) => s + o.total, 0) };
}

/** Retailers that appear in the history, for the retailer filter. */
export function retailersIn(list) {
  const seen = new Map();
  list.forEach((o) => { if (o.retailerId != null && !seen.has(String(o.retailerId))) seen.set(String(o.retailerId), o.retailerName); });
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ───────────── grouping ─────────────

export function dayLabel(d, now = new Date()) {
  const day = startOfDay(d).getTime();
  const today = startOfDay(now).getTime();
  if (day === today) return "Today";
  if (day === addDays(new Date(today), -1).getTime()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** Groups an already-sorted list under day headings (newest/oldest sorts only). */
export function groupByDay(list, now = new Date()) {
  const groups = [];
  for (const o of list) {
    const t = new Date(o.capturedAt);
    const key = Number.isNaN(t.getTime()) ? "unknown" : `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.orders.push(o);
    else groups.push({ key, label: key === "unknown" ? "Unknown date" : dayLabel(t, now), orders: [o] });
  }
  return groups.map((g) => ({ ...g, total: g.orders.reduce((s, o) => s + o.total, 0) }));
}
