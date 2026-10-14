// What the rep's beat screen shows about each retailer: how long since the last visit, and month-to-date targets.
// Pure functions.

export const OVERDUE_DAYS = 14;

/** The latest check-in at a retailer, from what the server knew and what this phone has captured since. */
export function lastVisitFor(retailerId, serverLast, localVisits = []) {
  const times = localVisits
    .filter((v) => v.retailerId != null && String(v.retailerId) === String(retailerId) && v.state !== "INVALID")
    .map((v) => v.capturedAt);
  if (serverLast) times.push(serverLast);
  if (times.length === 0) return null;
  return times.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

/** { days, never, label, tone } — tone: ok under a week, warn up to the overdue line, bad from 14 days, neutral if never. */
export function recency(lastIso, now = new Date()) {
  if (!lastIso) return { days: null, never: true, label: "Not visited yet", tone: "neutral" };
  const last = new Date(lastIso);
  const a = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.max(0, Math.round((b - a) / 86400000));
  const label = days === 0 ? "Visited today" : days === 1 ? "Visited yesterday" : "Visited " + days + " days ago";
  return { days, never: false, label, tone: days >= OVERDUE_DAYS ? "bad" : days >= 7 ? "warn" : "ok" };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** How far through the month we are, 0..1. */
export function elapsedFraction(progress) {
  if (!progress || !progress.daysInMonth) return 0;
  return Math.min(1, Math.max(0, (progress.daysInMonth - progress.daysLeft) / progress.daysInMonth));
}

/** on track when the share of the target achieved is at least the share of the month gone; warn when close; bad when far behind. */
export function paceTone(percent, elapsed) {
  if (percent >= 100) return "ok";
  const expected = elapsed * 100;
  if (percent >= expected) return "ok";
  return percent >= expected * 0.7 ? "warn" : "bad";
}

/** One bar per target that has been set. */
export function targetBars(progress) {
  if (!progress) return [];
  const elapsed = elapsedFraction(progress);
  const defs = [
    ["orders", "Orders", num(progress.ordersValue), progress.targetOrdersValue, "money"],
    ["collections", "Collections", num(progress.collections), progress.targetCollections, "money"],
    ["checkIns", "Check-ins", num(progress.checkIns), progress.targetCheckIns, "count"],
  ];
  return defs
    .filter(([, , , target]) => target !== null && target !== undefined)
    .map(([key, label, actual, target, kind]) => {
      const t = num(target);
      const percent = t > 0 ? Math.round((actual / t) * 100) : actual > 0 ? 100 : 0;
      return { key, label, actual, target: t, kind, percent, tone: t > 0 ? paceTone(percent, elapsed) : "ok", done: t > 0 && actual >= t };
    });
}
