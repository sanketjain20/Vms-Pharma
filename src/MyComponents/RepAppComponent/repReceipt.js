// The payment receipt a rep can show, print or send to a retailer. Pure functions — no React, no I/O.
//
// It is an acknowledgement slip, NOT a tax invoice: until the office has confirmed the payment it says so plainly,
// so a retailer is never told their account was credited when it hasn't been yet.

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below100(n) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? ONES[h] + " Hundred" : "", r ? below100(r) : ""].filter(Boolean).join(" ");
}

/** Whole numbers in Indian words (thousand, lakh, crore). */
export function numberToIndianWords(n) {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  return [
    crore ? numberToIndianWords(crore) + " Crore" : "",
    lakh ? below100(lakh) + " Lakh" : "",
    thousand ? below100(thousand) + " Thousand" : "",
    rest ? below1000(rest) : "",
  ].filter(Boolean).join(" ");
}

/** "Rupees Two Thousand Five Hundred and Fifty Paise only" */
export function amountInWords(amount) {
  const paise = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts = [];
  if (rupees > 0 || p === 0) parts.push("Rupees " + numberToIndianWords(rupees));
  if (p > 0) parts.push((rupees > 0 ? "and " : "") + below100(p) + " Paise");
  return parts.join(" ") + " only";
}

/** Short, stable and the same on the phone and the printout. Not a sequence number — it comes from the collection's id. */
export function receiptNumber(c) {
  const id = String((c && (c.clientCollectionId || c.key)) || "").replace(/-/g, "");
  return "RC-" + (id.slice(0, 8).toUpperCase() || "00000000");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "03 Oct 2026, 04:55 PM" — fixed format, so it reads the same on every phone and in tests. */
export function formatReceiptDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  const h = d.getHours();
  return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p(h % 12 === 0 ? 12 : h % 12)}:${p(d.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

const MODE = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", CARD: "Card" };
const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function isConfirmed(c) {
  return c && c.status === "CONFIRMED";
}

/** Only money that is actually on its way to, or in, the books gets a receipt — not refused or rejected entries. */
export function canIssueReceipt(c) {
  return !!c && ["PENDING", "SENT", "CONFIRMED"].includes(c.status);
}

export function receiptModel(c, { company, repName }) {
  const confirmed = isConfirmed(c);
  return {
    company: company || "Your supplier",
    number: receiptNumber(c),
    date: formatReceiptDate(c.capturedAt),
    retailer: c.retailerName,
    amount: Number(c.amount) || 0,
    amountText: money(c.amount),
    words: amountInWords(c.amount),
    mode: MODE[c.mode] || c.mode,
    reference: c.reference || null,
    invoice: c.invoiceNumber || null,
    repName: repName || "",
    confirmed,
    statusLine: confirmed
      ? "Recorded in the books by " + (company || "the office") + "."
      : "Acknowledgement only. Pending confirmation by " + (company || "the office") + ".",
  };
}

/** Plain text, for Share / WhatsApp / copy. */
export function receiptText(c, ctx) {
  const m = receiptModel(c, ctx);
  return [
    m.company,
    "PAYMENT RECEIPT " + m.number,
    "Date: " + m.date,
    "Received from: " + m.retailer,
    "Amount: " + m.amountText,
    "(" + m.words + ")",
    "Mode: " + m.mode + (m.reference ? " · Ref " + m.reference : ""),
    "Against: " + (m.invoice ? "Invoice " + m.invoice : "Account balance"),
    m.repName ? "Collected by: " + m.repName : null,
    m.statusLine,
  ].filter(Boolean).join("\n");
}

export const whatsappLink = (text) => "https://wa.me/?text=" + encodeURIComponent(text);
