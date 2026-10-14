// Closing the day: handing the cash you collected to the office. Pure functions.
import { STATE } from "./repSync";
import { COLLECTION_STATUS as CS } from "./repCollections";

export const HANDOVER_STATUS = { PENDING: "PENDING", INVALID: "INVALID", SENT: "SENT", RECEIVED: "RECEIVED", FLAGGED: "FLAGGED" };

// label, badge tone
export const HANDOVER_STATUS_META = {
  PENDING: ["Waiting to send", "warn"],
  INVALID: ["Refused", "bad"],
  SENT: ["Sent — awaiting office", "info"],
  RECEIVED: ["Received by office", "ok"],
  FLAGGED: ["Flagged by office", "bad"],
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100 + 0; // + 0 turns -0 into 0
export const MAX_CASH = 100000000;

/**
 * Cash collections that can still be handed over: cash, on this phone, not refused by the server, not rejected by the
 * office, and not already part of a day-close (here or on the server).
 * `list` is the unified collection list (see repCollections.unifyCollections).
 */
export function eligibleCash(list) {
  return list
    .filter((c) => c.mode === "CASH" && c.local && c.clientCollectionId)
    .filter((c) => [CS.PENDING, CS.SENT, CS.CONFIRMED].includes(c.status))
    .filter((c) => !c.handedOver && !c.handoverClientId)
    .sort((a, b) => String(a.capturedAt).localeCompare(String(b.capturedAt)));
}

export function expectedCash(collections) {
  return round2(collections.reduce((s, c) => s + num(c.amount), 0));
}

/** counted - expected: negative is a shortage, positive is extra. Rounded so 0.1 + 0.2 never shows as a difference. */
export function difference(counted, expected) {
  return round2(num(counted) - num(expected));
}

/** null when fine, otherwise the sentence to show. Mirrors the server so the rep isn't refused later. */
export function validateHandover({ count, counted }) {
  if (!count) return "There is no cash to hand over.";
  const text = String(counted ?? "").trim();
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n < 0) return "Enter the cash you are handing over (0 if none).";
  if (/\.\d{3,}/.test(text) && Number(n.toFixed(2)) !== n) return "Amount can have at most 2 decimal places.";
  if (n > MAX_CASH) return "That amount looks too large — check for an extra zero.";
  return null;
}

const timeOf = (h) => {
  const t = new Date(h.capturedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

function localStatus(state) {
  if (state === STATE.PENDING) return HANDOVER_STATUS.PENDING;
  if (state === STATE.INVALID) return HANDOVER_STATUS.INVALID;
  return HANDOVER_STATUS.SENT;
}

/** What is on the phone plus what the office has done with each day-close. */
export function unifyHandovers(local = [], server = []) {
  const byId = new Map(server.map((s) => [s.clientHandoverId, s]));
  const used = new Set();
  const out = [];

  for (const h of local) {
    const s = byId.get(h.clientHandoverId);
    if (s) used.add(s.clientHandoverId);
    let status = localStatus(h.state);
    if (s && s.status === "RECEIVED") status = HANDOVER_STATUS.RECEIVED;
    else if (s && s.status === "FLAGGED") status = HANDOVER_STATUS.FLAGGED;
    const expected = s ? num(s.expectedCash) : h.serverExpected != null ? num(h.serverExpected) : num(h.expectedCash);
    out.push({
      key: h.clientHandoverId,
      clientHandoverId: h.clientHandoverId,
      status,
      counted: num(h.cashCounted),
      expected,
      difference: difference(h.cashCounted, expected),
      count: (h.collectionIds || []).length,
      note: h.note || s?.note || null,
      capturedAt: h.capturedAt,
      officeNote: s?.officeNote || null,
      message: h.message,
      attempted: !!h.attempted,
      local: true,
    });
  }

  for (const s of server) {
    if (used.has(s.clientHandoverId)) continue;
    out.push({
      key: s.uKey || s.clientHandoverId,
      clientHandoverId: null,
      status: s.status === "RECEIVED" ? HANDOVER_STATUS.RECEIVED : s.status === "FLAGGED" ? HANDOVER_STATUS.FLAGGED : HANDOVER_STATUS.SENT,
      counted: num(s.cashCounted),
      expected: num(s.expectedCash),
      difference: num(s.difference),
      count: num(s.collectionsCount),
      note: s.note || null,
      capturedAt: s.closedAt,
      officeNote: s.officeNote || null,
      message: null,
      attempted: true,
      local: false,
    });
  }
  return out.sort((a, b) => timeOf(b) - timeOf(a));
}

/** Sentence about a day-close's difference: "Short by ₹100.00", "₹50.00 extra", or "Matches". */
export function differenceText(diff, money) {
  if (diff === 0) return "Matches what you collected";
  return diff < 0 ? "Short by " + money(-diff) : money(diff) + " extra";
}
