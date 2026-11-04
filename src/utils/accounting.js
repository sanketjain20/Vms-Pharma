// Accounting screen helpers: periods (Indian financial year from April), money and dates, and grouping the trial balance.

/** ACCOUNTING module (42): View 147, Add 148 (bank statement lines), Edit 149 (matching), Download 150 (Tally XML). */
export const ACCOUNTING_MODULE_ID = 42;

const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The financial year (1 April – 31 March) a day falls in, as its first year: 31 Mar 2027 -> 2026. */
export const fyStartYear = (d) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);

/** Ready-made periods, worked out for a given day (today unless a test passes one). */
export function presetRange(id, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (id) {
    case "month": return { fromDate: isoDate(new Date(y, m, 1)), toDate: isoDate(today) };
    case "lastMonth": return { fromDate: isoDate(new Date(y, m - 1, 1)), toDate: isoDate(new Date(y, m, 0)) };
    case "quarter": {
      // Indian quarters follow the financial year: Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar
      const q = Math.floor(m / 3) * 3;
      return { fromDate: isoDate(new Date(y, q, 1)), toDate: isoDate(today) };
    }
    case "lastFy": {
      const s = fyStartYear(today) - 1;
      return { fromDate: `${s}-04-01`, toDate: `${s + 1}-03-31` };
    }
    case "fy":
    default: return { fromDate: `${fyStartYear(today)}-04-01`, toDate: isoDate(today) };
  }
}

export const PRESETS = [
  { id: "month", name: "This month" },
  { id: "lastMonth", name: "Last month" },
  { id: "quarter", name: "This quarter" },
  { id: "fy", name: "This financial year" },
  { id: "lastFy", name: "Last financial year" },
];

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,24,750.00 (Indian grouping); a negative amount gets a minus sign: −₹500.00. */
export const money = (v) => {
  const n = Number(v || 0);
  return `${n < 0 ? "−" : ""}₹${inr.format(Math.abs(n))}`;
};

/** A blank instead of ₹0.00, for debit / credit columns where only one side has a figure. */
export const moneyOrBlank = (v) => (Number(v || 0) === 0 ? "" : money(v));

/** "2026-10-31" -> "31 Oct 2026". */
export const showDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(iso);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const GROUP_ORDER = ["Asset", "Liability", "Equity", "Income", "Expense"];

/** Trial balance rows grouped as Assets, Liabilities, Equity, Income, Expenses, each with its debit and credit subtotal. */
export function groupTrialBalance(rows = []) {
  return GROUP_ORDER.map((group) => {
    const items = rows.filter((r) => (r.group || "Expense") === group);
    return {
      group,
      items,
      debit: items.reduce((s, r) => s + Number(r.debit || 0), 0),
      credit: items.reduce((s, r) => s + Number(r.credit || 0), 0),
    };
  }).filter((g) => g.items.length > 0);
}

/** What a book adds up to over the period: money in, money out. */
export const bookTotals = (entries = []) => ({
  receipts: entries.reduce((s, e) => s + Number(e.receipts || 0), 0),
  payments: entries.reduce((s, e) => s + Number(e.payments || 0), 0),
});

/** The rows whose text contains every word of the search, ignoring case. */
export function searchRows(rows = [], query = "", fields = []) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((r) => {
    const text = fields.map((f) => r[f] ?? "").join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}


/** The vouchers typed by hand, as the server names them, with what each is for. */
export const VOUCHER_TYPES = [
  { id: "PAYMENT", name: "Payment", hint: "Money out of cash or bank: an expense, drawings, paying GST" },
  { id: "RECEIPT", name: "Receipt", hint: "Money into cash or bank: capital brought in, other income" },
  { id: "CONTRA", name: "Contra", hint: "Cash to bank or back: a deposit or a withdrawal" },
  { id: "JOURNAL", name: "Journal", hint: "No money moves: a correction, depreciation, a transfer between heads" },
];

export const CASH = "Cash in Hand";
export const BANK = "Bank";

const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/**
 * The ledger lines of a simple voucher. Receipt: debit the cash / bank it came into, credit where it came from.
 * Payment: debit what it was for, credit the cash / bank it left. Contra: debit where the money went, credit where it left.
 */
export function simpleLines({ type, money, account, amount, direction }) {
  const a = round2(amount);
  if (type === "RECEIPT") return [{ ledger: money, debit: a, credit: 0 }, { ledger: account, debit: 0, credit: a }];
  if (type === "PAYMENT") return [{ ledger: account, debit: a, credit: 0 }, { ledger: money, debit: 0, credit: a }];
  if (type === "CONTRA") {
    const [to, from] = direction === "toCash" ? [CASH, BANK] : [BANK, CASH];
    return [{ ledger: to, debit: a, credit: 0 }, { ledger: from, debit: 0, credit: a }];
  }
  return [];
}

/** A journal's debits, credits and whether they agree (to the paisa). */
export function voucherTotals(lines = []) {
  const debit = round2(lines.reduce((s, l) => s + round2(l.debit), 0));
  const credit = round2(lines.reduce((s, l) => s + round2(l.credit), 0));
  return { debit, credit, balanced: debit > 0 && Math.abs(debit - credit) < 0.005 };
}

/** A ledger balance the way books print it: ₹1,200.00 Dr (debit) or ₹300.00 Cr (credit). */
export const drCr = (v) => {
  const n = round2(v);
  if (n === 0) return money(0);
  return `${money(Math.abs(n))} ${n > 0 ? "Dr" : "Cr"}`;
};

/** What a physical cash count says against the cash book: short, excess or matching. */
export function cashCountResult(counted, book) {
  if (counted === "" || counted === null || counted === undefined || Number.isNaN(Number(counted))) return null;
  const diff = round2(Number(counted) - Number(book || 0));
  return { diff, kind: diff === 0 ? "match" : diff < 0 ? "short" : "excess" };
}

/* ── bank statement files ───────────────────────────────────────────────── */

/** The cells of one CSV line: commas (or ; / tab), double-quoted cells with "" for a quote. */
export function csvCells(line, sep = ",") {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

/** A bank's date as yyyy-mm-dd: 31/10/2026, 31-10-26, 31.10.2026, 2026-10-31, 31-Oct-2026, 31 Oct 2026. Day first, as Indian banks print. */
export function parseBankDate(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const ok = (y, m, d) => {
    const year = y < 100 ? 2000 + y : y;
    const dt = new Date(year, m - 1, d);
    return dt.getFullYear() === year && dt.getMonth() === m - 1 && dt.getDate() === d ? isoDate(dt) : null;
  };
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return ok(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})[\s/-]([A-Za-z]{3,4})[a-z]*[\s,/-]*(\d{2,4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return ok(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
  return null;
}

/** An amount as a bank prints it: 1,23,456.78 / ₹500 / (120.00) / 500 Dr. Blank is 0. */
export function parseBankAmount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  const negative = /^\(.*\)$/.test(t) || /^-/.test(t);
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return null;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const HEADS = {
  date: [/^(txn|tran|transaction|value|posting|book)?\s*\.?\s*date$/i, /date/i],
  narration: [/narration|description|particulars|remarks|details/i],
  reference: [/ref|chq|cheque|utr|instrument/i],
  debit: [/^(debit|withdrawals?|withdrawal amt\.?|dr\.?|debit amount|paid out)$/i, /withdraw|debit/i],
  credit: [/^(credit|deposits?|deposit amt\.?|cr\.?|credit amount|paid in)$/i, /deposit|credit/i],
  amount: [/^amount|^amt/i],
  type: [/^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|txn type|d\/c)$/i],
};

/** Which column holds what, from a header row (null when it isn't one). */
export function statementColumns(cells) {
  const lower = cells.map((c) => c.replace(/\s+/g, " ").trim());
  const find = (key, skip = []) => {
    for (const re of HEADS[key]) {
      const i = lower.findIndex((c, j) => c && re.test(c) && !skip.includes(j));
      if (i >= 0) return i;
    }
    return -1;
  };
  const date = find("date");
  if (date < 0) return null;
  const narration = find("narration", [date]);
  const reference = find("reference", [date, narration]);
  const debit = find("debit", [date, narration, reference]);
  const credit = find("credit", [date, narration, reference, debit]);
  const amount = find("amount", [date, narration, reference, debit, credit]);
  const type = find("type", [date, narration, reference, debit, credit, amount]);
  if ((debit < 0 || credit < 0) && amount < 0) return null;
  return { date, narration, reference, debit, credit, amount, type };
}

/**
 * The lines of a bank statement exported as CSV: finds the header row (Date, Narration / Description, Ref / Chq / UTR,
 * Withdrawal / Debit and Deposit / Credit, or one Amount column with a Dr / Cr column or a sign), skips the bank's
 * title and balance rows, and returns the lines with what couldn't be read.
 */
export function parseStatementCsv(text) {
  const raw = String(text || "").replace(/^﻿/, "").split(/\r?\n/);
  const sep = [",", ";", "\t"].map((s) => [s, (raw.slice(0, 30).join("\n").match(new RegExp(s === "\t" ? "\t" : `\\${s}`, "g")) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  let cols = null, headAt = -1;
  for (let i = 0; i < Math.min(raw.length, 60) && !cols; i++) { const c = statementColumns(csvCells(raw[i], sep)); if (c) { cols = c; headAt = i; } }
  if (!cols) return { lines: [], problems: ["No header row with a Date column and Debit / Credit (or Amount) columns was found."], columns: null };
  const lines = [], problems = [];
  for (let i = headAt + 1; i < raw.length; i++) {
    if (!raw[i].trim()) continue;
    const c = csvCells(raw[i], sep);
    const date = parseBankDate(c[cols.date]);
    if (!date) { if (c.some((x) => x)) problems.push(`Row ${i + 1}: no date (skipped)`); continue; }
    let type, amount;
    if (cols.debit >= 0 && cols.credit >= 0) {
      const dr = parseBankAmount(c[cols.debit]), cr = parseBankAmount(c[cols.credit]);
      if (dr === null || cr === null) { problems.push(`Row ${i + 1}: an amount can't be read`); continue; }
      if (Math.abs(dr) > 0) { type = "DEBIT"; amount = Math.abs(dr); } else if (Math.abs(cr) > 0) { type = "CREDIT"; amount = Math.abs(cr); } else continue;
    } else {
      const a = parseBankAmount(c[cols.amount]);
      if (a === null || a === 0) { if (a === null) problems.push(`Row ${i + 1}: the amount can't be read`); continue; }
      const t = cols.type >= 0 ? String(c[cols.type] || "").toUpperCase() : "";
      type = /^(DR|D|DEBIT|WITHDRAWAL)/.test(t) ? "DEBIT" : /^(CR|C|CREDIT|DEPOSIT)/.test(t) ? "CREDIT" : a < 0 ? "DEBIT" : "CREDIT";
      amount = Math.abs(a);
    }
    lines.push({ transactionDate: date, transactionType: type, amount, referenceNumber: cols.reference >= 0 ? c[cols.reference] || null : null, narration: cols.narration >= 0 ? c[cols.narration] || null : null });
  }
  return { lines, problems, columns: cols };
}

/** The accounting reports that can be exported, by tab. */
export const EXPORTABLE = { trial: "trial", pnl: "pnl", balance: "balance", cashflow: "cashflow", stock: "stock", gst: "gst", day: "day", cash: "cash", bank: "bank", vouchers: "vouchers", audit: "audit" };

/** Who did what in the books, for people. */
export const AUDIT_ACTIONS = {
  VOUCHER_POSTED: "Voucher posted", VOUCHER_CANCELLED: "Voucher cancelled", HEAD_ADDED: "Head added", HEAD_SWITCHED_OFF: "Head switched off",
  HEAD_SWITCHED_ON: "Head switched on", GST_SET_OFF: "GST set off", BOOKS_CLOSED: "Books closed", BOOKS_REOPENED: "Books reopened",
  OPENING_SAVED: "Opening balances saved", STATEMENT_LINE_ADDED: "Statement line added", STATEMENT_IMPORTED: "Statement imported",
  STATEMENT_MATCHED: "Statement line matched", STATEMENT_AUTO_MATCHED: "Statement auto-matched", EXPORTED: "Exported",
};
