// Collections for the rep app: merges what's on the phone with what the office has done, then filters and
// summarises. Pure functions — no React, no I/O.
import { STATE } from "./repSync";
import { periodRange } from "./repOrders";

export const COLLECTION_STATUS = {
  PENDING: "PENDING",     // saved on the phone, not sent yet
  INVALID: "INVALID",     // the server refused it
  SENT: "SENT",           // the office has it, hasn't decided
  CONFIRMED: "CONFIRMED", // booked against the retailer
  REJECTED: "REJECTED",   // the office said no
};

// label, badge tone
export const COLLECTION_STATUS_META = {
  PENDING: ["Waiting to send", "warn"],
  INVALID: ["Refused", "bad"],
  SENT: ["Sent — awaiting office", "info"],
  CONFIRMED: ["Confirmed", "ok"],
  REJECTED: ["Rejected", "bad"],
};

export const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", CARD: "Card" };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const timeOf = (c) => {
  const t = new Date(c.capturedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

function localStatus(state) {
  if (state === STATE.PENDING) return COLLECTION_STATUS.PENDING;
  if (state === STATE.INVALID) return COLLECTION_STATUS.INVALID;
  return COLLECTION_STATUS.SENT;
}

/**
 * Every collection the rep has: the ones still on the phone (including unsent/refused) plus the office's
 * record (which goes back further than the 7 days the phone keeps and carries their decision).
 * `total` and `capturedAt` are deliberately the same names orders use, so the by-day grouping is shared.
 */
export function unifyCollections(local = [], server = []) {
  const serverById = new Map(server.map((s) => [s.clientCollectionId, s]));
  const used = new Set();
  const out = [];

  for (const c of local) {
    const s = serverById.get(c.clientCollectionId);
    if (s) used.add(s.clientCollectionId);
    let status = localStatus(c.state);
    if (s && s.status === "CONFIRMED") status = COLLECTION_STATUS.CONFIRMED;
    else if (s && s.status === "REJECTED") status = COLLECTION_STATUS.REJECTED;

    out.push({
      key: c.clientCollectionId,
      clientCollectionId: c.clientCollectionId,
      retailerId: c.retailerId,
      retailerName: c.retailerName || s?.retailerName || "",
      amount: num(c.amount),
      total: num(c.amount),
      mode: c.mode,
      reference: c.reference || s?.referenceNumber || null,
      note: c.note || s?.note || null,
      capturedAt: c.capturedAt,
      status,
      message: c.message,
      rejectReason: s?.rejectReason || null,
      attempted: !!c.attempted,
      invoiceId: c.invoiceId ?? s?.invoiceId ?? null,
      invoiceNumber: c.invoiceNumber || s?.invoiceNumber || null,
      handoverClientId: c.handoverClientId || null,
      handedOver: !!c.handoverClientId || !!s?.handedOver,
      local: true,
    });
  }

  for (const s of server) {
    if (used.has(s.clientCollectionId)) continue;
    out.push({
      key: s.uKey || s.clientCollectionId,
      clientCollectionId: null, // not on this phone any more: nothing to cancel or discard
      retailerId: s.retailerId,
      retailerName: s.retailerName || "",
      amount: num(s.amount),
      total: num(s.amount),
      mode: s.paymentMode,
      reference: s.referenceNumber || null,
      note: s.note || null,
      capturedAt: s.collectedAt,
      status: s.status === "CONFIRMED" ? COLLECTION_STATUS.CONFIRMED : s.status === "REJECTED" ? COLLECTION_STATUS.REJECTED : COLLECTION_STATUS.SENT,
      message: null,
      rejectReason: s.rejectReason || null,
      attempted: true,
      invoiceId: s.invoiceId ?? null,
      invoiceNumber: s.invoiceNumber || null,
      handoverClientId: null,
      handedOver: !!s.handedOver,
      local: false,
    });
  }

  return out.sort((a, b) => timeOf(b) - timeOf(a));
}

// ───────────── filtering ─────────────

export const DEFAULT_COLLECTION_FILTERS = {
  q: "",
  status: "ALL",
  retailerId: "",
  period: "ALL",
  month: "",
  from: "",
  to: "",
};

const norm = (s) => String(s ?? "").toLowerCase();

function matchesText(c, q) {
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = norm([c.retailerName, c.reference, c.note, MODE_LABEL[c.mode] || c.mode, c.amount].join(" \n "));
  return tokens.every((t) => hay.includes(t));
}

export function applyCollectionFilters(list, f, now = new Date()) {
  const range = periodRange(f, now);
  return list
    .filter((c) => {
      if (f.status && f.status !== "ALL" && c.status !== f.status) return false;
      if (f.retailerId && String(c.retailerId) !== String(f.retailerId)) return false;
      if (range) {
        const t = timeOf(c);
        if (t < range[0].getTime() || t >= range[1].getTime()) return false;
      }
      return matchesText(c, f.q);
    })
    .sort((a, b) => timeOf(b) - timeOf(a));
}

export function collectionStatusCounts(list, f, now = new Date()) {
  // counted with every other filter applied, so a chip's number is what tapping it gives
  const base = applyCollectionFilters(list, { ...f, status: "ALL" }, now);
  const counts = { ALL: base.length };
  Object.keys(COLLECTION_STATUS).forEach((k) => { counts[k] = base.filter((c) => c.status === k).length; });
  return counts;
}

export function countActiveCollectionFilters(f) {
  let n = 0;
  if (f.q.trim()) n++;
  if (f.status !== "ALL") n++;
  if (f.retailerId) n++;
  if (f.period !== "ALL" && periodRange(f)) n++;
  return n;
}

// ───────────── summaries ─────────────

const COUNTS_AS_COLLECTED = [COLLECTION_STATUS.PENDING, COLLECTION_STATUS.SENT, COLLECTION_STATUS.CONFIRMED];
const sum = (list) => list.reduce((s, c) => s + c.amount, 0);
const sameDay = (iso, now) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

/** Refused and rejected money was never collected as far as the books go, so it is left out of "collected". */
export function collectionSummary(list, now = new Date()) {
  const month = (iso) => { const d = new Date(iso); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); };
  return {
    collectedToday: sum(list.filter((c) => COUNTS_AS_COLLECTED.includes(c.status) && sameDay(c.capturedAt, now))),
    awaitingOffice: sum(list.filter((c) => c.status === COLLECTION_STATUS.PENDING || c.status === COLLECTION_STATUS.SENT)),
    confirmedThisMonth: sum(list.filter((c) => c.status === COLLECTION_STATUS.CONFIRMED && month(c.capturedAt))),
  };
}

/** Money the rep has taken from this retailer that the office hasn't booked yet. */
export function awaitingForRetailer(list, retailerId) {
  return sum(list.filter((c) =>
    String(c.retailerId) === String(retailerId) &&
    (c.status === COLLECTION_STATUS.PENDING || c.status === COLLECTION_STATUS.SENT)));
}

export function retailersInCollections(list) {
  const seen = new Map();
  list.forEach((c) => { if (c.retailerId != null && !seen.has(String(c.retailerId))) seen.set(String(c.retailerId), c.retailerName); });
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// ───────────── the entry form ─────────────

export const MAX_COLLECTION = 10000000;

/** null when fine, otherwise the sentence to show. Mirrors the server's rules so the rep isn't refused later. */
export function validateCollection({ retailerId, amount, mode, reference, invoiceLeft = null }) {
  if (!retailerId) return "Pick the retailer you collected from.";
  const text = String(amount ?? "").trim();
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n <= 0) return "Enter the amount you collected.";
  if (/\.\d{3,}/.test(text) && Number(n.toFixed(2)) !== n) return "Amount can have at most 2 decimal places.";
  if (n > MAX_COLLECTION) return "That amount looks too large — check for an extra zero.";
  if (invoiceLeft !== null && invoiceLeft !== undefined && n > invoiceLeft + 0.005) {
    return "That invoice only has ₹" + Number(invoiceLeft).toFixed(2) + " left to collect.";
  }
  if (!["CASH", "UPI", "CHEQUE", "CARD"].includes(mode)) return "Choose how they paid.";
  if (mode === "CHEQUE" && !String(reference ?? "").trim()) return "Enter the cheque number.";
  if (String(reference ?? "").trim().length > 100) return "That reference is too long.";
  return null;
}
