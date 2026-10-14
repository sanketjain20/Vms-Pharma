// Pure helpers for the rep Performance tab: date presets, validation, display text, CSV.

export const MAX_DAYS = 93; // the server's limit — checked here too so the user gets a message instead of a 400

export const PERIODS = [
  ["TODAY", "Today"],
  ["YESTERDAY", "Yesterday"],
  ["LAST7", "Last 7 days"],
  ["LAST30", "Last 30 days"],
  ["THIS_MONTH", "This month"],
  ["LAST_MONTH", "Last month"],
  ["CUSTOM", "Custom"],
];

/** yyyy-mm-dd in LOCAL time (toISOString would shift the day for anyone east or west of UTC). */
export const ymd = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function periodDates(preset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "TODAY": return { from: ymd(today), to: ymd(today) };
    case "YESTERDAY": return { from: ymd(addDays(today, -1)), to: ymd(addDays(today, -1)) };
    case "LAST30": return { from: ymd(addDays(today, -29)), to: ymd(today) };
    case "THIS_MONTH": return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
    case "LAST_MONTH":
      return {
        from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "LAST7":
    default: return { from: ymd(addDays(today, -6)), to: ymd(today) };
  }
}

const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** null when the range is fine, otherwise the sentence to show. */
export function rangeProblem({ from, to }) {
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return "Pick both a start and an end date.";
  if (a > b) return "The start date must be on or before the end date.";
  const days = Math.round((b - a) / 86400000) + 1;
  if (days > MAX_DAYS) return `Pick a period of at most ${MAX_DAYS} days.`;
  return null;
}

export const pctText = (p) => (p === null || p === undefined ? "—" : `${p}%`);

/** compliance / order-conversion colour band: good ≥ 80, middling ≥ 50, poor below. */
export const band = (p) => (p === null || p === undefined ? "none" : p >= 80 ? "good" : p >= 50 ? "mid" : "poor");

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Excel treats a leading = + - @ as a formula: neutralise it (a retailer or rep name is user-typed text)
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const line = (cells) => cells.map(csvCell).join(",");

export function buildCsv(report) {
  if (!report) return "";
  const head = [
    "Rep", "Planned visits", "Completed", "Missed", "Compliance %", "Check-ins", "Unplanned", "Active days",
    "Orders", "Order value (excl. rejected)", "Avg order value", "Awaiting review", "Approved", "Invoiced", "Rejected",
    "Approval %", "Order conversion %", "Collections", "Collected (confirmed)", "Collected (awaiting)",
    "Any-day retailers", "Any-day visited", "Target: orders", "Target: collections", "Target: check-ins",
  ];
  const row = (r) => [
    r.repName, r.plannedVisits, r.completedVisits, r.missedVisits, r.compliancePercent ?? "", r.totalCheckIns,
    r.unplannedVisits, r.activeDays, r.ordersCount, r.ordersValue, r.avgOrderValue, r.awaitingCount, r.approvedCount,
    r.convertedCount, r.rejectedCount, r.approvalPercent ?? "", r.strikeRatePercent ?? "", r.collectionsCount,
    r.collectionsConfirmed, r.collectionsAwaiting,
    r.flexibleRetailers ?? "", r.flexibleVisited ?? "", r.targetOrdersValue ?? "", r.targetCollections ?? "", r.targetCheckIns ?? "",
  ];
  const out = [line([`Rep performance ${report.from} to ${report.to}`]), line(head), ...report.rows.map((r) => line(row(r)))];
  if (report.totals) out.push(line(row(report.totals)));

  if (report.previousTotals) {
    out.push("", line([`Previous period ${report.previousFrom} to ${report.previousTo}`]), line(head));
    (report.previousRows || []).forEach((r) => out.push(line(row(r))));
    out.push(line(row({ ...report.previousTotals, repName: "All reps" })));
  }

  if (report.days && report.days.length) {
    out.push("", line([`Day by day`]));
    out.push(line(["Date", "Planned", "Visited", "Missed retailers", "Unplanned stops", "Orders", "Order value", "Collected", "First check-in", "Last check-in"]));
    report.days.forEach((d) => out.push(line([
      d.date, d.planned, d.visited, (d.missed || []).join("; "), d.unplanned, d.orders, d.ordersValue, d.collected,
      d.firstCheckIn ? d.firstCheckIn.replace("T", " ") : "", d.lastCheckIn ? d.lastCheckIn.replace("T", " ") : "",
    ])));
  }
  return out.join("\r\n");
}

// ───────────── comparison with the previous period ─────────────

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Change from the previous period as a percentage. direction is up/down/flat/none; tone says whether that is good or
 * bad (for "missed visits", going down is good — pass lowerIsBetter). A rise from zero is "New" rather than infinity %.
 */
export function delta(current, previous, { lowerIsBetter = false } = {}) {
  const cur = Number(current);
  const prev = Number(previous);
  if (previous === null || previous === undefined || !Number.isFinite(prev) || !Number.isFinite(cur)) {
    return { text: "", direction: "none", tone: "neutral" };
  }
  if (cur === prev) return { text: "No change", direction: "flat", tone: "neutral" };
  const up = cur > prev;
  const good = lowerIsBetter ? !up : up;
  if (prev === 0) return { text: up ? "New" : "", direction: up ? "up" : "down", tone: good ? "good" : "bad" };
  const pct = Math.round((Math.abs(cur - prev) / Math.abs(prev)) * 100);
  if (pct === 0) return { text: "No change", direction: "flat", tone: "neutral" };
  return { text: (up ? "▲ " : "▼ ") + pct + "%", direction: up ? "up" : "down", tone: good ? "good" : "bad" };
}

/** Same idea for percentages (compliance, strike rate): the difference in points, not a percentage of a percentage. */
export function deltaPoints(current, previous) {
  if (!isNum(current) || !isNum(previous)) return { text: "", direction: "none", tone: "neutral" };
  const d = current - previous;
  if (d === 0) return { text: "No change", direction: "flat", tone: "neutral" };
  return { text: (d > 0 ? "▲ " : "▼ ") + Math.abs(d) + " pts", direction: d > 0 ? "up" : "down", tone: d > 0 ? "good" : "bad" };
}

/** { percent, done } for a target, or null when no target was set for it. */
export function targetProgress(actual, target) {
  if (target === null || target === undefined) return null;
  const t = Number(target);
  const a = Number(actual) || 0;
  if (!Number.isFinite(t)) return null;
  const percent = t > 0 ? Math.round((a / t) * 100) : a > 0 ? 100 : 0;
  return { percent, done: t > 0 && a >= t };
}

/** "October 2026" for "2026-10". */
export function monthLabel(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || "");
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const thisMonth = (now = new Date()) => ymd(now).slice(0, 7);

/** [last month, this month, next month] as yyyy-MM — the months worth setting targets for. */
export function targetMonths(now = new Date()) {
  const at = (n) => ymd(new Date(now.getFullYear(), now.getMonth() + n, 1)).slice(0, 7);
  return [at(-1), at(0), at(1)];
}

const blank = (v) => v === null || v === undefined || String(v).trim() === "";

/** One rep's typed targets → the server's shape (blank = no target). Returns { row } or { problem }. */
export function targetRow(repUKey, input) {
  const num = (v, label, whole) => {
    if (blank(v)) return { value: null };
    const text = String(v).trim();
    const n = Number(text);
    if (!Number.isFinite(n) || n < 0) return { problem: label + " must be a number, 0 or more." };
    if (whole && !Number.isInteger(n)) return { problem: label + " must be a whole number." };
    if (!whole && /\.\d{3,}/.test(text) && Number(n.toFixed(2)) !== n) return { problem: label + " can have at most 2 decimal places." };
    if (n > (whole ? 100000 : 1000000000)) return { problem: label + " is too large." };
    return { value: n };
  };
  const o = num(input.ordersValue, "Orders target", false);
  if (o.problem) return { problem: o.problem };
  const c = num(input.collections, "Collections target", false);
  if (c.problem) return { problem: c.problem };
  const v = num(input.checkIns, "Check-ins target", true);
  if (v.problem) return { problem: v.problem };
  return { row: { repUKey, ordersValue: o.value, collections: c.value, checkIns: v.value } };
}
