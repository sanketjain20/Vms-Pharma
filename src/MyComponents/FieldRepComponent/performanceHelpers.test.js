import { MAX_DAYS, band, buildCsv, pctText, periodDates, rangeProblem, ymd } from "./performanceHelpers";

jest.mock("../../Config/apiClient");

const NOW = new Date(2026, 9, 14, 15, 30); // Wed 14 Oct 2026

describe("periodDates", () => {
  it("builds each preset in local time", () => {
    expect(periodDates("TODAY", NOW)).toEqual({ from: "2026-10-14", to: "2026-10-14" });
    expect(periodDates("YESTERDAY", NOW)).toEqual({ from: "2026-10-13", to: "2026-10-13" });
    expect(periodDates("LAST7", NOW)).toEqual({ from: "2026-10-08", to: "2026-10-14" });
    expect(periodDates("LAST30", NOW)).toEqual({ from: "2026-09-15", to: "2026-10-14" });
    expect(periodDates("THIS_MONTH", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-14" });
    expect(periodDates("LAST_MONTH", NOW)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("crosses a year boundary correctly", () => {
    const jan = new Date(2027, 0, 5);
    expect(periodDates("LAST_MONTH", jan)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(periodDates("LAST7", jan)).toEqual({ from: "2026-12-30", to: "2027-01-05" });
  });

  it("falls back to the last 7 days for an unknown preset", () => {
    expect(periodDates("whatever", NOW)).toEqual(periodDates("LAST7", NOW));
  });

  it("formats dates without shifting the day", () => {
    expect(ymd(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(ymd(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
});

describe("rangeProblem", () => {
  it("accepts a sane range, including a single day and exactly the maximum", () => {
    expect(rangeProblem({ from: "2026-10-14", to: "2026-10-14" })).toBeNull();
    expect(rangeProblem({ from: "2026-07-14", to: "2026-10-14" })).toBeNull(); // 93 days
    expect(MAX_DAYS).toBe(93);
  });

  it("explains each way a custom range can be wrong", () => {
    expect(rangeProblem({ from: "", to: "2026-10-14" })).toMatch(/both/);
    expect(rangeProblem({ from: "2026-10-14", to: "" })).toMatch(/both/);
    expect(rangeProblem({ from: "2026-10-14", to: "2026-10-01" })).toMatch(/on or before/);
    expect(rangeProblem({ from: "2026-07-13", to: "2026-10-14" })).toMatch(/at most 93/); // 94 days
  });
});

describe("display helpers", () => {
  it("shows a dash, never 0%, when there is nothing to divide by", () => {
    expect(pctText(null)).toBe("—");
    expect(pctText(undefined)).toBe("—");
    expect(pctText(0)).toBe("0%");
    expect(pctText(67)).toBe("67%");
  });

  it("bands a percentage good / mid / poor", () => {
    expect(band(100)).toBe("good");
    expect(band(80)).toBe("good");
    expect(band(79)).toBe("mid");
    expect(band(50)).toBe("mid");
    expect(band(49)).toBe("poor");
    expect(band(0)).toBe("poor");
    expect(band(null)).toBe("none");
  });
});

describe("buildCsv", () => {
  const row = (o = {}) => ({
    repName: "Ravi", plannedVisits: 5, completedVisits: 3, missedVisits: 2, compliancePercent: 60, totalCheckIns: 7, unplannedVisits: 3,
    activeDays: 6, ordersCount: 4, ordersValue: 1800, avgOrderValue: 600, awaitingCount: 1, approvedCount: 1, convertedCount: 1,
    rejectedCount: 1, approvalPercent: 67, strikeRatePercent: 80, collectionsCount: 2, collectionsConfirmed: 2000, collectionsAwaiting: 500, ...o,
  });

  it("is empty without a report", () => {
    expect(buildCsv(null)).toBe("");
  });

  it("writes a title, a header, one line per rep and a totals line", () => {
    const csv = buildCsv({ from: "2026-10-05", to: "2026-10-14", rows: [row()], totals: row({ repName: "All reps" }) });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Rep performance 2026-10-05 to 2026-10-14");
    expect(lines[1].startsWith("Rep,Planned visits,Completed,Missed,Compliance %")).toBe(true);
    expect(lines[2].startsWith("Ravi,5,3,2,60,7,3,6,4,1800,600,1,1,1,1,67,80,2,2000,500")).toBe(true);
    expect(lines[3].startsWith("All reps,")).toBe(true);
  });

  it("leaves a percentage blank when it is not defined", () => {
    const csv = buildCsv({ from: "a", to: "b", rows: [row({ compliancePercent: null, approvalPercent: null, strikeRatePercent: null })], totals: null });
    expect(csv.split("\r\n")[2]).toBe("Ravi,5,3,2,,7,3,6,4,1800,600,1,1,1,1,,,2,2000,500,,,,,");
  });

  it("quotes commas and quotes, and defuses spreadsheet formulas in typed names", () => {
    const csv = buildCsv({
      from: "a", to: "b", totals: null,
      rows: [row({ repName: 'Ravi, "the" rep' }), row({ repName: "=HYPERLINK(\"http://x\")" }), row({ repName: "-5 Star" })],
    });
    const lines = csv.split("\r\n");
    expect(lines[2].startsWith('"Ravi, ""the"" rep",')).toBe(true);
    expect(lines[3].startsWith("\"'=HYPERLINK(\"\"http://x\"\")\",")).toBe(true); // prefixed with ' so Excel shows it as text
    expect(lines[4].startsWith("'-5 Star,")).toBe(true);
  });

  it("adds the day-by-day section when a single rep was asked for", () => {
    const csv = buildCsv({
      from: "2026-10-12", to: "2026-10-12", rows: [row()], totals: null,
      days: [{ date: "2026-10-12", planned: 1, visited: 0, missed: ["City Chemist", "Metro"], unplanned: 1, orders: 1, ordersValue: 300, collected: 500, firstCheckIn: "2026-10-12T09:00:00", lastCheckIn: null }],
    });
    expect(csv).toContain("Day by day");
    expect(csv).toContain("2026-10-12,1,0,City Chemist; Metro,1,1,300,500,2026-10-12 09:00:00,");
  });

  it("does not add a day section when there are no days", () => {
    expect(buildCsv({ from: "a", to: "b", rows: [row()], totals: null, days: null })).not.toContain("Day by day");
  });
});
