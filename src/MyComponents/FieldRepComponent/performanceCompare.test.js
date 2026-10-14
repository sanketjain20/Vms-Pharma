import { buildCsv, delta, deltaPoints, monthLabel, targetMonths, targetProgress, targetRow, thisMonth } from "./performanceHelpers";

describe("delta (change from the previous period)", () => {
  it("shows a percentage with an arrow, coloured by whether it is good", () => {
    expect(delta(150, 100)).toEqual({ text: "▲ 50%", direction: "up", tone: "good" });
    expect(delta(75, 100)).toEqual({ text: "▼ 25%", direction: "down", tone: "bad" });
  });
  it("treats a fall as good when lower is better (missed visits)", () => {
    expect(delta(2, 4, { lowerIsBetter: true })).toMatchObject({ direction: "down", tone: "good" });
    expect(delta(6, 4, { lowerIsBetter: true })).toMatchObject({ direction: "up", tone: "bad" });
  });
  it("says 'New' for a rise from zero, and never Infinity", () => {
    expect(delta(500, 0)).toMatchObject({ text: "New", direction: "up", tone: "good" });
    expect(delta(0, 0)).toMatchObject({ text: "No change", direction: "flat" });
    expect(delta(0, 500)).toMatchObject({ direction: "down", tone: "bad" });
  });
  it("shows nothing when there is no previous figure", () => {
    expect(delta(5, null)).toMatchObject({ text: "", direction: "none" });
    expect(delta(5, undefined)).toMatchObject({ text: "" });
    expect(delta(NaN, 5)).toMatchObject({ text: "" });
  });
  it("a change that rounds to 0% reads as no change", () => {
    expect(delta(100.1, 100)).toMatchObject({ text: "No change", direction: "flat" });
  });
});

describe("deltaPoints (percentages compared in points)", () => {
  it("is the difference in points", () => {
    expect(deltaPoints(80, 60)).toEqual({ text: "▲ 20 pts", direction: "up", tone: "good" });
    expect(deltaPoints(50, 60)).toEqual({ text: "▼ 10 pts", direction: "down", tone: "bad" });
    expect(deltaPoints(60, 60)).toMatchObject({ text: "No change" });
  });
  it("is blank when either side is undefined (nothing was planned)", () => {
    expect(deltaPoints(null, 60).text).toBe("");
    expect(deltaPoints(60, null).text).toBe("");
  });
});

describe("targetProgress", () => {
  it("is null when no target was set", () => {
    expect(targetProgress(500, null)).toBeNull();
    expect(targetProgress(500, undefined)).toBeNull();
  });
  it("gives a percentage that can pass 100, and marks it done", () => {
    expect(targetProgress(400, 1000)).toEqual({ percent: 40, done: false });
    expect(targetProgress(1500, 1000)).toEqual({ percent: 150, done: true });
  });
  it("a zero target never divides by zero", () => {
    expect(targetProgress(0, 0)).toEqual({ percent: 0, done: false });
    expect(targetProgress(3, 0)).toEqual({ percent: 100, done: false });
  });
});

describe("months for targets", () => {
  it("labels a month and offers last, this and next month", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("nonsense")).toBe("");
    expect(targetMonths(new Date(2026, 9, 3))).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(targetMonths(new Date(2026, 0, 15))).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(thisMonth(new Date(2026, 9, 31))).toBe("2026-10");
  });
});

describe("targetRow (typed targets to the server's shape)", () => {
  it("turns blanks into null and text into numbers", () => {
    expect(targetRow("r1", { ordersValue: "50000", collections: "", checkIns: " 20 " })).toEqual({ row: { repUKey: "r1", ordersValue: 50000, collections: null, checkIns: 20 } });
    expect(targetRow("r1", {})).toEqual({ row: { repUKey: "r1", ordersValue: null, collections: null, checkIns: null } });
  });
  it("refuses negative, non-numeric, fractional check-ins, 3 decimals, and absurd values", () => {
    expect(targetRow("r", { ordersValue: "-1" }).problem).toMatch(/Orders target/);
    expect(targetRow("r", { collections: "abc" }).problem).toMatch(/Collections target/);
    expect(targetRow("r", { checkIns: "2.5" }).problem).toMatch(/whole number/);
    expect(targetRow("r", { ordersValue: "10.123" }).problem).toMatch(/2 decimal/);
    expect(targetRow("r", { ordersValue: "1000000001" }).problem).toMatch(/too large/);
    expect(targetRow("r", { checkIns: "100001" }).problem).toMatch(/too large/);
  });
  it("accepts zero as a real target", () => {
    expect(targetRow("r", { ordersValue: "0" }).row.ordersValue).toBe(0);
  });
});

describe("buildCsv — targets, any-day and the previous period", () => {
  const r = (o = {}) => ({
    repUKey: "u", repName: "Ravi", plannedVisits: 1, completedVisits: 1, missedVisits: 0, compliancePercent: 100, totalCheckIns: 1, unplannedVisits: 0,
    activeDays: 1, ordersCount: 1, ordersValue: 10, avgOrderValue: 10, awaitingCount: 0, approvedCount: 0, convertedCount: 0, rejectedCount: 0,
    approvalPercent: null, strikeRatePercent: null, collectionsCount: 0, collectionsConfirmed: 0, collectionsAwaiting: 0, ...o,
  });
  it("adds the any-day and target columns", () => {
    const csv = buildCsv({ from: "a", to: "b", rows: [r({ flexibleRetailers: 4, flexibleVisited: 3, targetOrdersValue: 5000, targetCollections: 2000, targetCheckIns: 30 })], totals: null });
    const lines = csv.split("\r\n");
    expect(lines[1].endsWith("Any-day retailers,Any-day visited,Target: orders,Target: collections,Target: check-ins")).toBe(true);
    expect(lines[2].endsWith(",4,3,5000,2000,30")).toBe(true);
  });
  it("adds the previous period when there is one, and not otherwise", () => {
    const withPrev = buildCsv({
      from: "2026-10-05", to: "2026-10-11", rows: [r()], totals: r({ repName: "All reps" }),
      previousFrom: "2026-09-28", previousTo: "2026-10-04", previousRows: [r({ ordersValue: 7 })], previousTotals: r({ ordersValue: 7 }),
    });
    expect(withPrev).toContain("Previous period 2026-09-28 to 2026-10-04");
    expect(buildCsv({ from: "a", to: "b", rows: [r()], totals: null })).not.toContain("Previous period");
  });
});
