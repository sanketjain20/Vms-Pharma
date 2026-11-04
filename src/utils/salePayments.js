// How a bill is paid: one or more payments, each in a mode (Cash, UPI, Card) — "Rs 500 cash + Rs 300 UPI".
// The same rules as the server (Utils/SalePayments.java), so the screen refuses what the server would.

import { useEffect, useState } from "react";
import { fetchCustomItemSetting } from "./customItems";

export const PAYMENT_MODES = [
  { id: "CASH", name: "Cash" },
  { id: "UPI", name: "UPI" },
  { id: "CARD", name: "Card" },
];

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/** "ONLINE" (the old name) is UPI; unknown -> CASH. */
export const normMode = (m) => {
  const u = String(m || "").toUpperCase();
  if (u === "ONLINE") return "UPI";
  return PAYMENT_MODES.some((p) => p.id === u) ? u : "CASH";
};

export const modeName = (m) => (PAYMENT_MODES.find((p) => p.id === normMode(m)) || { name: m }).name;

/** The bill total rounded to the rupee (half up) and the round-off: 1247.37 -> { net: 1247, roundOff: -0.37 }. */
export function roundToRupee(exact) {
  const e = r2(exact);
  const net = Math.round(e);
  return { net, roundOff: r2(net - e) };
}

/** "- 0.37" / "+ 0.40" / "" for a round-off. */
export const roundOffText = (roundOff) => (!roundOff ? "" : `${roundOff < 0 ? "-" : "+"} ${Math.abs(roundOff).toFixed(2)}`);

export const paymentsTotal = (payments) => r2((payments || []).reduce((s, p) => s + num(p.amount), 0));

/** The payments a payment type starts with: paid in full = one payment of the whole bill; part = one to fill in. */
export function startPayments(type, net, mode = "CASH") {
  if (type === "CREDIT") return [];
  return [{ mode: normMode(mode), amount: type === "PAID" ? r2(net).toFixed(2) : "", reference: "" }];
}

/** Paid in full: the last payment is whatever the others leave of the bill (the clerk types the cash, UPI fills in). */
export function fillLast(payments, net) {
  if (!payments || payments.length === 0) return payments;
  const others = paymentsTotal(payments.slice(0, -1));
  const last = { ...payments[payments.length - 1], amount: Math.max(0, r2(net - others)).toFixed(2) };
  return [...payments.slice(0, -1), last];
}

/** Why these payments can't be saved for this payment type, or "". */
export function paymentsProblem(type, net, payments) {
  const list = payments || [];
  if (type === "CREDIT") return list.length ? "A credit bill is not paid now" : "";
  if (list.length === 0) return "Add a payment";
  if (list.some((p) => !(num(p.amount) > 0))) return "Each payment needs an amount";
  const total = paymentsTotal(list);
  if (type === "PAID" && Math.abs(total - r2(net)) > 0.005) {
    return `The payments add up to ₹${total.toFixed(2)} but the bill is ₹${r2(net).toFixed(2)}`;
  }
  if (type === "PARTIAL" && total >= r2(net)) return "A part payment must be less than the bill";
  return "";
}

/** What the server takes: [{ mode, amount, reference }]. */
export const paymentPayload = (payments) => (payments || []).map((p) => ({
  mode: normMode(p.mode),
  amount: r2(num(p.amount)),
  reference: p.reference && p.reference.trim() ? p.reference.trim() : null,
}));

/** The bill's mode as the screens send it with the payments (the server works it out too): one mode, or SPLIT. */
export const billingModeOf = (payments) => {
  const modes = [...new Set((payments || []).map((p) => normMode(p.mode)))];
  return modes.length > 1 ? "SPLIT" : modes[0] || "CASH";
};

/** Whether the shop rounds bill totals to the rupee (Settings -> Billing). True until known: the server's default. */
export function useRoundBillTotal(enabled = true) {
  const [round, setRound] = useState(true);
  useEffect(() => {
    if (!enabled) return undefined; // e.g. a sales order: not a bill, nothing to ask
    let live = true;
    fetchCustomItemSetting().then((s) => { if (live && typeof s.roundBillTotal === "boolean") setRound(s.roundBillTotal); });
    return () => { live = false; };
  }, [enabled]);
  return round;
}
