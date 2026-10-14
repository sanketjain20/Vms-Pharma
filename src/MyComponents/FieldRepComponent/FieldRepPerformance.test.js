import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import FieldRep from "./FieldRep";
import apiClient from "../../Config/apiClient";
import { periodDates } from "./performanceHelpers";

jest.mock("../../Config/apiClient");

const json = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) });

const REPS = [
  { uKey: "rep-1", name: "Ravi Rep", email: "r@x.com", phone: null, disabled: false, retailerCount: 2 },
  { uKey: "rep-2", name: "Sita Rep", email: "s@x.com", phone: null, disabled: false, retailerCount: 1 },
];

const rowOf = (o = {}) => ({
  repUKey: "rep-1", repName: "Ravi Rep", disabled: false, plannedVisits: 5, completedVisits: 3, missedVisits: 2, compliancePercent: 60,
  unplannedVisits: 3, totalCheckIns: 7, activeDays: 6, ordersCount: 4, ordersValue: 1800, avgOrderValue: 600, awaitingCount: 1,
  approvedCount: 1, convertedCount: 1, rejectedCount: 1, approvalPercent: 67, strikeRatePercent: 80, collectionsCount: 2,
  collectionsConfirmed: 2000, collectionsAwaiting: 500, ...o,
});

const REPORT = (o = {}) => ({
  from: "2026-10-08", to: "2026-10-14",
  totals: rowOf({ repUKey: null, repName: "All reps" }),
  rows: [rowOf(), rowOf({ repUKey: "rep-2", repName: "Sita Rep", plannedVisits: 0, completedVisits: 0, missedVisits: 0, compliancePercent: null, unplannedVisits: 0, totalCheckIns: 0, ordersCount: 0, ordersValue: 0, approvalPercent: null, strikeRatePercent: null, collectionsConfirmed: 0, collectionsAwaiting: 0 })],
  daysForRepUKey: null, days: null, ...o,
});

const DAYS = [
  { date: "2026-10-12", planned: 1, visited: 0, missed: ["City Chemist"], unplanned: 1, orders: 1, ordersValue: 300, collected: 500, firstCheckIn: "2026-10-12T09:00:00", lastCheckIn: "2026-10-12T11:00:00" },
  { date: "2026-10-11", planned: 0, visited: 0, missed: [], unplanned: 0, orders: 0, ordersValue: 0, collected: 0, firstCheckIn: null, lastCheckIn: null },
];

function mockApi({ report = REPORT(), reportFor } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/FieldRep/GetAll")) return json({ status: 200, data: REPS });
    if (url.includes("/api/FieldRep/Report")) {
      const r = reportFor ? reportFor(url) : report;
      return r && r.__error ? json({ status: 400, message: r.__error }, false) : json({ status: 200, data: r });
    }
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const reportCalls = () => apiClient.mock.calls.map(([u]) => u).filter((u) => u.includes("/api/FieldRep/Report"));

async function openPerformance() {
  render(<FieldRep />);
  fireEvent.click(await screen.findByRole("tab", { name: "Performance" }));
  await screen.findByText("Beat compliance", { selector: ".fr-kpi-label" });
}

describe("FieldRep — Performance tab", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens on the last 7 days and asks the server for exactly that range", async () => {
    mockApi();
    await openPerformance();

    const { from, to } = periodDates("LAST7");
    expect(reportCalls()[0]).toContain(`from=${from}&to=${to}`);
    expect(reportCalls()[0]).not.toContain("repUKey");
    expect(screen.getByRole("button", { name: "Last 7 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("summarises the whole team in four tiles", async () => {
    mockApi();
    await openPerformance();

    const tile = (label) => screen.getByText(label, { selector: ".fr-kpi-label" }).closest(".fr-kpi");
    expect(within(tile("Beat compliance")).getByText("60%")).toBeInTheDocument();
    expect(within(tile("Beat compliance")).getByText("3 of 5 planned visits done")).toBeInTheDocument();
    expect(within(tile("Orders")).getByText("4")).toBeInTheDocument();
    expect(within(tile("Orders")).getByText(/₹1,800\.00 \(excl\. rejected\)/)).toBeInTheDocument();
    expect(within(tile("Collected")).getByText("₹2,000.00")).toBeInTheDocument();
    expect(within(tile("Collected")).getByText(/₹500\.00 awaiting your review/)).toBeInTheDocument();
    expect(within(tile("Check-ins")).getByText("7")).toBeInTheDocument();
    expect(within(tile("Check-ins")).getByText("3 unplanned stops")).toBeInTheDocument();
  });

  it("shows each rep's numbers, and a dash — not 0% — where there is nothing to measure", async () => {
    mockApi();
    await openPerformance();

    const ravi = screen.getByRole("cell", { name: "Ravi Rep" }).closest("tr");
    expect(within(ravi).getByText("60%")).toBeInTheDocument();
    expect(within(ravi).getByText("3/5")).toBeInTheDocument();
    expect(within(ravi).getByText("67%")).toBeInTheDocument();  // approved
    expect(within(ravi).getByText("80%")).toBeInTheDocument();  // strike rate
    expect(within(ravi).getByText("₹1,800.00")).toBeInTheDocument();
    expect(within(ravi).getByText(/\+ ₹500\.00 pending/)).toBeInTheDocument();

    const sita = screen.getByRole("cell", { name: "Sita Rep" }).closest("tr");
    expect(within(sita).getAllByText("—").length).toBeGreaterThanOrEqual(3);
    expect(within(sita).queryByText("0%")).not.toBeInTheDocument();
  });

  it("marks a switched-off rep who still had activity", async () => {
    mockApi({ report: REPORT({ rows: [rowOf({ disabled: true })] }) });
    await openPerformance();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("says so when no rep did anything in the period", async () => {
    mockApi({ report: REPORT({ rows: [] }) });
    await openPerformance();
    expect(screen.getByText("No rep activity in this period.")).toBeInTheDocument();
  });

  it("re-queries when the period changes", async () => {
    mockApi();
    await openPerformance();

    fireEvent.click(screen.getByRole("button", { name: "Last month" }));

    const { from, to } = periodDates("LAST_MONTH");
    await waitFor(() => expect(reportCalls().some((u) => u.includes(`from=${from}&to=${to}`))).toBe(true));
  });

  it("explains a bad custom range instead of calling the server", async () => {
    mockApi();
    await openPerformance();
    const before = reportCalls().length;

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByText("Pick both a start and an end date.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-14" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });
    expect(screen.getByText(/start date must be on or before/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });
    expect(screen.getByText(/at most 93 days/)).toBeInTheDocument();

    expect(reportCalls()).toHaveLength(before);
  });

  it("queries a valid custom range", async () => {
    mockApi();
    await openPerformance();

    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-09-30" } });

    await waitFor(() => expect(reportCalls().some((u) => u.includes("from=2026-09-01&to=2026-09-30"))).toBe(true));
  });

  it("shows the server's message when the report can't be built", async () => {
    mockApi({ report: { __error: "Pick a period of at most 93 days." } });
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Performance" }));

    expect(await screen.findByText("Pick a period of at most 93 days.")).toBeInTheDocument();
  });

  it("only shows the answer to the latest request when an older one arrives late", async () => {
    let releaseFirst;
    let n = 0;
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/FieldRep/GetAll")) return json({ status: 200, data: REPS });
      if (url.includes("/api/FieldRep/Report")) {
        n += 1;
        if (n === 1) return new Promise((resolve) => { releaseFirst = () => resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 200, data: REPORT({ totals: rowOf({ repName: "All reps", ordersCount: 111 }) }) }) }); });
        return json({ status: 200, data: REPORT({ totals: rowOf({ repName: "All reps", ordersCount: 222 }) }) });
      }
      return json({ status: 404 }, false);
    });
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Performance" }));
    await waitFor(() => expect(n).toBe(1));

    fireEvent.click(screen.getByRole("button", { name: "Today" })); // second, quicker request
    expect(await screen.findByText("222")).toBeInTheDocument();
    await act(async () => { releaseFirst(); });

    expect(screen.queryByText("111")).not.toBeInTheDocument(); // the stale answer must not overwrite it
    expect(screen.getByText("222")).toBeInTheDocument();
  });
});

describe("FieldRep — Performance: one rep, day by day", () => {
  beforeEach(() => jest.clearAllMocks());

  const withDays = (url) => (url.includes("repUKey=rep-1") ? REPORT({ rows: [rowOf()], daysForRepUKey: "rep-1", days: DAYS }) : REPORT());

  it("'Day by day' on a row narrows to that rep and shows the daily table", async () => {
    mockApi({ reportFor: withDays });
    await openPerformance();

    fireEvent.click(screen.getByRole("button", { name: "Day by day for Ravi Rep" }));

    await waitFor(() => expect(reportCalls().some((u) => u.includes("repUKey=rep-1"))).toBe(true));
    expect(await screen.findByText(/Day by day — Ravi Rep/)).toBeInTheDocument();
  });

  it("names the retailer that was skipped, highlights that day, and shows first–last check-in", async () => {
    mockApi({ reportFor: withDays });
    await openPerformance();
    fireEvent.click(screen.getByRole("button", { name: "Day by day for Ravi Rep" }));
    await screen.findByText(/Day by day — Ravi Rep/);

    const missedDay = screen.getByText("City Chemist").closest("tr");
    expect(missedDay).toHaveClass("fr-conflict-row");
    expect(within(missedDay).getByText("₹500.00")).toBeInTheDocument();
    const quietDay = screen.getByText("No check-ins").closest("tr");
    expect(quietDay).not.toHaveClass("fr-conflict-row");
  });

  it("can also be reached from the rep filter, and 'Back to all reps' returns", async () => {
    mockApi({ reportFor: withDays });
    await openPerformance();

    fireEvent.change(screen.getByLabelText("Filter by rep"), { target: { value: "rep-1" } });
    await screen.findByText(/Day by day — Ravi Rep/);

    fireEvent.click(screen.getByRole("button", { name: "Back to all reps" }));
    await waitFor(() => expect(screen.queryByText(/Day by day — Ravi Rep/)).not.toBeInTheDocument());
    expect(screen.getByLabelText("Filter by rep")).toHaveValue("");
  });
});

describe("FieldRep — Performance: export and help", () => {
  beforeEach(() => jest.clearAllMocks());

  it("downloads the table as CSV named for the period", async () => {
    mockApi();
    const blobs = [];
    const RealBlob = global.Blob;
    global.Blob = function (parts, opts) { blobs.push({ parts, opts }); return new RealBlob(parts, opts); };
    const created = jest.fn(() => "blob:fake");
    const revoked = jest.fn();
    global.URL.createObjectURL = created;
    global.URL.revokeObjectURL = revoked;
    const clicked = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { clicked.push(this.download); };

    try {
      await openPerformance();
      fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

      expect(clicked).toEqual(["rep-performance-2026-10-08_to_2026-10-14.csv"]);
      expect(blobs[0].opts.type).toMatch(/text\/csv/);
      expect(blobs[0].parts[0]).toContain("Ravi Rep");
      expect(blobs[0].parts[0]).toContain("Rep performance 2026-10-08 to 2026-10-14");
      expect(revoked).toHaveBeenCalledWith("blob:fake");
    } finally {
      global.Blob = RealBlob;
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("has the download disabled until there is a report", async () => {
    apiClient.mockImplementation((url) => (url.includes("GetAll") ? json({ status: 200, data: REPS }) : new Promise(() => {})));
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Performance" }));
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  });

  it("explains how each number is worked out", async () => {
    mockApi();
    await openPerformance();
    expect(screen.getByText("How these numbers are worked out")).toBeInTheDocument();
    expect(screen.getByText(/never counted as missed/)).toBeInTheDocument();
  });
});

describe("FieldRep — Performance tab: clearer metrics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls the metric Order Conversion, with a tooltip saying what it is, and never 'Strike rate'", async () => {
    mockApi();
    await openPerformance();

    const header = screen.getByRole("columnheader", { name: "Order Conversion" });
    expect(header).toHaveAttribute("title", "Orders created ÷ retailers visited");
    expect(screen.queryByText(/strike rate/i)).not.toBeInTheDocument();
    const ravi = screen.getByRole("cell", { name: "Ravi Rep" }).closest("tr");
    expect(within(ravi).getByText("80%").closest("td")).toHaveAttribute("title", "Orders created ÷ retailers visited");
  });

  it("explains Order Conversion in the help text", async () => {
    mockApi();
    await openPerformance();
    expect(screen.getByText(/orders created ÷ retailers visited: of the retailer-days/i)).toBeInTheDocument();
  });

  it("a rep with no planned visits shows — and '0 of 0 planned visits done', not 0%", async () => {
    mockApi();
    await openPerformance();

    const sita = screen.getByRole("cell", { name: "Sita Rep" }).closest("tr");
    expect(within(sita).getByText("0 of 0 planned visits done")).toBeInTheDocument();
    expect(within(sita).queryByText("0%")).not.toBeInTheDocument();
    expect(within(sita).queryByText("0/0")).not.toBeInTheDocument();
  });

  it("shows — even if the server sends 0 for compliance when nothing was planned", async () => {
    mockApi({ report: REPORT({ rows: [rowOf({ plannedVisits: 0, completedVisits: 0, missedVisits: 0, compliancePercent: 0 })] }) });
    await openPerformance();
    const row = screen.getByRole("cell", { name: "Ravi Rep" }).closest("tr");
    expect(within(row).queryByText("0%")).not.toBeInTheDocument();
    expect(within(row).getByText("0 of 0 planned visits done")).toBeInTheDocument();
  });

  it("the team tile shows — plus the explanation when nobody had planned visits", async () => {
    mockApi({ report: REPORT({ totals: rowOf({ repUKey: null, repName: "All reps", plannedVisits: 0, completedVisits: 0, missedVisits: 0, compliancePercent: null }) }) });
    await openPerformance();
    const tile = screen.getByText("Beat compliance", { selector: ".fr-kpi-label" }).closest(".fr-kpi");
    expect(within(tile).getByText("—")).toBeInTheDocument();
    expect(within(tile).getByText("0 of 0 planned visits done")).toBeInTheDocument();
    expect(within(tile).getByText(/no planned visits, so compliance does not apply/)).toBeInTheDocument();
  });

  it("a rep who did plan visits still shows a real percentage, even 0%", async () => {
    mockApi({ report: REPORT({ rows: [rowOf({ plannedVisits: 4, completedVisits: 0, missedVisits: 4, compliancePercent: 0 })] }) });
    await openPerformance();
    const row = screen.getByRole("cell", { name: "Ravi Rep" }).closest("tr");
    expect(within(row).getByText("0%")).toBeInTheDocument();
    expect(within(row).getByText("0/4")).toBeInTheDocument();
  });

  it("the CSV header says Order conversion %, matching the screen", () => {
    const { buildCsv } = require("./performanceHelpers");
    const csv = buildCsv({ from: "a", to: "b", rows: [rowOf()], totals: null });
    expect(csv).toContain("Order conversion %");
    expect(csv).not.toContain("Strike rate");
  });
});

describe("FieldRep — Performance tab: search and pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  const many = Array.from({ length: 23 }, (_, i) => rowOf({ repUKey: "r" + i, repName: "Rep " + String(i).padStart(2, "0") }));

  it("pages the rep table and finds a rep by name", async () => {
    mockApi({ report: REPORT({ rows: many }) });
    await openPerformance();
    expect(screen.getByRole("cell", { name: "Rep 00" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Rep 10" })).not.toBeInTheDocument();
    expect(screen.getByText("23 reps")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Page 3" }));
    expect(screen.getByRole("cell", { name: "Rep 20" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search reps"), { target: { value: "rep 07" } });
    expect(screen.getByRole("cell", { name: "Rep 07" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "Rep 20" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search reps"), { target: { value: "nobody" } });
    expect(screen.getByText("No reps match your search.")).toBeInTheDocument();
  });
});

describe("FieldRep — Not visited tab: search and pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  const dormant = (i) => ({ retailerId: i, retailerCode: "R" + i, retailerName: "Shop " + String(i).padStart(2, "0"), phone: null, repNames: ["Ravi Rep"], lastVisitAt: "2026-09-01T10:00:00", since: "2026-09-01", daysSince: 30, neverVisited: false, outstanding: 0 });

  it("pages the list and searches it", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/FieldRep/GetAll")) return json({ status: 200, data: REPS });
      if (url.includes("/api/FieldRep/Dormant")) return json({ status: 200, data: Array.from({ length: 14 }, (_, i) => dormant(i)) });
      return json({ status: 404 }, false);
    });
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Not visited" }));
    await screen.findByText(/Shop 00/);
    expect(screen.queryByText(/Shop 12/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(await screen.findByText(/Shop 12/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search retailers not visited"), { target: { value: "shop 03" } });
    expect(await screen.findByText(/Shop 03/)).toBeInTheDocument();
    expect(screen.queryByText(/Shop 12/)).not.toBeInTheDocument();
  });
});
