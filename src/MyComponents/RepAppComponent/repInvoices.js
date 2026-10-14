// Invoices a rep can collect against. Pure functions.
import { COLLECTION_STATUS as CS } from "./repCollections";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;

const timeOf = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : t;
};

/** Money this rep has already collected against an invoice that the office has not booked yet. */
export function unbookedAgainst(invoiceId, collectionHistory) {
  return round2(
    collectionHistory
      .filter((c) => c.invoiceId != null && String(c.invoiceId) === String(invoiceId))
      .filter((c) => c.status === CS.PENDING || c.status === CS.SENT)
      .reduce((s, c) => s + num(c.amount), 0)
  );
}

/**
 * The retailer's open invoices with what is really left to collect (the server's figure minus what this rep has
 * already collected and not yet had booked), oldest due first. Invoices with nothing left are dropped.
 */
export function invoicesFor(retailerId, invoices, collectionHistory) {
  if (!retailerId) return [];
  return invoices
    .filter((i) => String(i.retailerId) === String(retailerId))
    .map((i) => ({ ...i, left: Math.max(0, round2(num(i.remainingAmount) - unbookedAgainst(i.salesId, collectionHistory))) }))
    .filter((i) => i.left > 0)
    .sort((a, b) => {
      const da = a.dueDate ? timeOf(a.dueDate) : Infinity;
      const db = b.dueDate ? timeOf(b.dueDate) : Infinity;
      return da - db || timeOf(a.invoiceDate) - timeOf(b.invoiceDate);
    });
}

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** { text, overdue } — "Overdue by 12 days", "Due today", "Due in 3 days", "Due 12 Oct", or nothing. */
export function dueInfo(invoice, now = new Date()) {
  const due = parseDay(invoice.dueDate);
  if (!due) return { text: "", overdue: false };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due - today) / DAY);
  if (days < 0) return { text: "Overdue by " + -days + " day" + (days === -1 ? "" : "s"), overdue: true };
  if (days === 0) return { text: "Due today", overdue: false };
  if (days <= 7) return { text: "Due in " + days + " day" + (days === 1 ? "" : "s"), overdue: false };
  return { text: "Due " + due.getDate() + " " + MONTHS[due.getMonth()], overdue: false };
}

/** One line for the picker: "INV00123 · Overdue by 4 days · ₹3,200.00 left". */
export function invoiceLabel(invoice, money, now = new Date()) {
  const due = dueInfo(invoice, now).text;
  return [invoice.invoiceNumber, due, money(invoice.left) + " left"].filter(Boolean).join(" · ");
}
