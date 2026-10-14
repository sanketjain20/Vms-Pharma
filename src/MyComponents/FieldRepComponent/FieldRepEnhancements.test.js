import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import FieldRep from "./FieldRep";
import apiClient from "../../Config/apiClient";

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
  collectionsConfirmed: 2000, collectionsAwaiting: 500, flexibleRetailers: 0, flexibleVisited: 0,
  targetOrdersValue: null, targetCollections: null, targetCheckIns: null, ...o,
});

const REPORT = (o = {}) => ({
  from: "2026-10-01", to: "2026-10-03",
  totals: rowOf({ repUKey: null, repName: "All reps" }),
  rows: [rowOf()],
  daysForRepUKey: null, days: null, previousFrom: null, previousTo: null, previousTotals: null, previousRows: null, targetMonth: null, ...o,
});

function mockApi({ report = REPORT(), targets = [], dormant = [], saveResult = { status: 200, message: "Targets saved." }, dormantResult } = {}) {
  apiClient.mockImplementation((url, options = {}) => {
    const method = options.method || "GET";
    if (url.includes("/api/FieldRep/GetAll")) return json({ status: 200, data: REPS });
    if (url.includes("/api/FieldRep/Report")) return json({ status: 200, data: report });
    if (url.includes("/api/FieldRep/Targets") && method === "GET") return json({ status: 200, data: targets });
    if (url.includes("/api/FieldRep/Targets") && method === "PUT") return json(saveResult, saveResult.status === 200);
    if (url.includes("/api/FieldRep/Dormant")) return dormantResult || json({ status: 200, data: dormant });
    return json({ status: 404, message: "unmocked " + url }, false);
  });
}

const callsTo = (fragment, method) =>
  apiClient.mock.calls.filter(([url, o]) => url.includes(fragment) && (!method || (o?.method || "GET") === method));

const tile = (label) => screen.getByText(label, { selector: ".fr-kpi-label" }).closest(".fr-kpi");

async function openPerformance() {
  render(<FieldRep />);
  fireEvent.click(await screen.findByRole("tab", { name: "Performance" }));
  await screen.findByText("Beat compliance", { selector: ".fr-kpi-label" });
}

beforeEach(() => jest.clearAllMocks());

describe("Performance — comparison with the previous period", () => {
  const prev = (o = {}) => rowOf({ repUKey: null, repName: "All reps", compliancePercent: 40, ordersValue: 1200, collectionsConfirmed: 2500, totalCheckIns: 7, ...o });

  it("shows nothing extra when there is no previous period", async () => {
    mockApi();
    await openPerformance();
    expect(screen.queryByText(/vs previous period/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("prev-note")).not.toBeInTheDocument();
  });

  it("puts the change on each tile, coloured good or bad, and says which period it is compared with", async () => {
    mockApi({ report: REPORT({ previousFrom: "2026-09-28", previousTo: "2026-09-30", previousTotals: prev(), previousRows: [prev({ repUKey: "rep-1", repName: "Ravi Rep", ordersValue: 3600 })] }) });
    await openPerformance();

    expect(within(tile("Beat compliance")).getByText("▲ 20 pts")).toHaveClass("fr-delta--good");
    expect(within(tile("Orders")).getByText("▲ 50%")).toHaveClass("fr-delta--good"); // 1200 -> 1800
    expect(within(tile("Collected")).getByText("▼ 20%")).toHaveClass("fr-delta--bad"); // 2500 -> 2000
    expect(within(tile("Check-ins")).getByText("No change")).toBeInTheDocument();
    expect(screen.getByTestId("prev-note")).toHaveTextContent("2026-09-28 → 2026-09-30");
  });

  it("shows each rep's own change in the table", async () => {
    mockApi({ report: REPORT({ previousFrom: "a", previousTo: "b", previousTotals: prev(), previousRows: [prev({ repUKey: "rep-1", ordersValue: 3600 })] }) });
    await openPerformance();
    const row = screen.getByText("Ravi Rep", { selector: "td" }).closest("tr");
    expect(within(row).getByText("▼ 50%")).toHaveClass("fr-delta--bad"); // 3600 -> 1800
  });
});

describe("Performance — targets and any-day retailers", () => {
  it("has no targets column when no month is being viewed", async () => {
    mockApi();
    await openPerformance();
    expect(screen.queryByText(/Targets ·/)).not.toBeInTheDocument();
  });

  it("shows target progress per rep for a month view, only for the targets that were set", async () => {
    mockApi({ report: REPORT({ targetMonth: "2026-10", rows: [rowOf({ targetOrdersValue: 3600, targetCheckIns: 7 })] }) });
    await openPerformance();
    expect(screen.getByText("Targets · October 2026")).toBeInTheDocument();
    const row = screen.getByText("Ravi Rep", { selector: "td" }).closest("tr");
    expect(within(row).getByText("50%")).toBeInTheDocument(); // 1800 of 3600
    expect(within(row).getByText("100%")).toBeInTheDocument(); // 7 of 7
    expect(within(row).queryByText(/Collections/)).not.toBeInTheDocument();
  });

  it("shows how many any-day retailers the rep visited, instead of counting them as missed", async () => {
    mockApi({ report: REPORT({ rows: [rowOf({ flexibleRetailers: 4, flexibleVisited: 3 })] }) });
    await openPerformance();
    expect(screen.getByText("+ 3/4 any-day retailers visited")).toBeInTheDocument();
  });

  it("the help text no longer claims the beat history isn't kept", async () => {
    mockApi();
    await openPerformance();
    fireEvent.click(screen.getByText("How these numbers are worked out"));
    expect(screen.getByText(/The beat is judged as it was on each day/)).toBeInTheDocument();
    expect(screen.queryByText(/Based on each rep's/)).not.toBeInTheDocument();
  });
});

describe("Performance — Set targets panel", () => {
  const TARGETS = [
    { repUKey: "rep-1", repName: "Ravi Rep", month: "2026-10", ordersValue: 50000, collections: null, checkIns: 20 },
    { repUKey: "rep-2", repName: "Sita Rep", month: "2026-10", ordersValue: null, collections: null, checkIns: null },
  ];

  async function openPanel(extra = {}) {
    mockApi({ targets: TARGETS, ...extra });
    await openPerformance();
    fireEvent.click(screen.getByRole("button", { name: "Set targets" }));
    return screen.findByLabelText("Orders target for Ravi Rep");
  }

  it("loads the existing targets for the month, blank where none was set", async () => {
    await openPanel();
    expect(screen.getByLabelText("Orders target for Ravi Rep")).toHaveValue("50000");
    expect(screen.getByLabelText("Collections target for Ravi Rep")).toHaveValue("");
    expect(screen.getByLabelText("Check-ins target for Ravi Rep")).toHaveValue("20");
    expect(screen.getByLabelText("Orders target for Sita Rep")).toHaveValue("");
    expect(callsTo("/api/FieldRep/Targets", "GET")[0][0]).toMatch(/month=\d{4}-\d{2}/);
  });

  it("saves every rep's row at once, with blanks as null", async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText("Collections target for Sita Rep"), { target: { value: "15000.50" } });
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    await waitFor(() => expect(callsTo("/api/FieldRep/Targets", "PUT")).toHaveLength(1));
    const body = JSON.parse(callsTo("/api/FieldRep/Targets", "PUT")[0][1].body);
    expect(body.rows).toEqual([
      { repUKey: "rep-1", ordersValue: 50000, collections: null, checkIns: 20 },
      { repUKey: "rep-2", ordersValue: null, collections: 15000.5, checkIns: null },
    ]);
    expect(await screen.findByText(/Targets for .* saved\./)).toBeInTheDocument();
  });

  it("refuses a bad number before calling the server, naming the rep", async () => {
    await openPanel();
    fireEvent.change(screen.getByLabelText("Check-ins target for Sita Rep"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    expect(await screen.findByText("Sita Rep: Check-ins target must be a whole number.")).toBeInTheDocument();
    expect(callsTo("/api/FieldRep/Targets", "PUT")).toHaveLength(0);
  });

  it("shows the server's message when saving fails", async () => {
    await openPanel({ saveResult: { status: 400, message: "Pick a month within the last two years or the next twelve months." } });
    fireEvent.click(screen.getByRole("button", { name: "Save targets" }));
    expect(await screen.findByText(/Pick a month within/)).toBeInTheDocument();
  });

  it("changing the month loads that month's targets", async () => {
    await openPanel();
    const before = callsTo("/api/FieldRep/Targets", "GET").length;
    const select = screen.getByLabelText("Target month");
    fireEvent.change(select, { target: { value: select.options[select.options.length - 1].value } });
    await waitFor(() => expect(callsTo("/api/FieldRep/Targets", "GET").length).toBe(before + 1));
  });

  it("hides again", async () => {
    await openPanel();
    fireEvent.click(screen.getByRole("button", { name: "Hide targets" }));
    expect(screen.queryByLabelText("Orders target for Ravi Rep")).not.toBeInTheDocument();
  });
});

describe("Not visited tab", () => {
  const D = (o = {}) => ({
    retailerId: 1, retailerCode: "R1", retailerName: "City Chemist", phone: "99999", repNames: ["Ravi Rep", "Sita Rep"],
    lastVisitAt: "2026-09-10T10:00:00", since: "2026-09-10", daysSince: 23, neverVisited: false, outstanding: 4500, ...o,
  });

  async function openDormant(opts) {
    mockApi(opts);
    render(<FieldRep />);
    fireEvent.click(await screen.findByRole("tab", { name: "Not visited" }));
    return screen.findByText("Retailers not visited lately");
  }

  it("asks for 14 days first, and lists the longest neglected with their reps and what they owe", async () => {
    await openDormant({ dormant: [D(), D({ retailerId: 2, retailerName: "Fresh Pharma", retailerCode: null, repNames: ["Sita Rep"], daysSince: 20, outstanding: 0, phone: null })] });
    expect(callsTo("/api/FieldRep/Dormant")[0][0]).toContain("days=14");
    const row = (await screen.findByText("City Chemist")).closest("tr");
    expect(within(row).getByText("Ravi Rep, Sita Rep")).toBeInTheDocument();
    expect(within(row).getByText("23 days")).toBeInTheDocument();
    expect(within(row).getByText("₹4,500.00")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "99999" })).toHaveAttribute("href", "tel:99999");
    expect(screen.getByText("2 retailers")).toBeInTheDocument();
  });

  it("calls out retailers that were never visited, measured from when they joined the beat", async () => {
    await openDormant({ dormant: [D({ neverVisited: true, lastVisitAt: null, daysSince: 31 })] });
    const row = (await screen.findByText("City Chemist")).closest("tr");
    expect(within(row).getByText("Never")).toBeInTheDocument();
    expect(within(row).getByText(/Never visited/)).toBeInTheDocument();
    expect(within(row).getByText("(on beat 31 days)")).toBeInTheDocument();
    expect(screen.getByText("1 never visited.")).toBeInTheDocument();
  });

  it("re-asks the server when the window changes", async () => {
    await openDormant({ dormant: [D()] });
    fireEvent.click(screen.getByRole("button", { name: "30 days" }));
    await waitFor(() => expect(callsTo("/api/FieldRep/Dormant").some(([u]) => u.includes("days=30"))).toBe(true));
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says so when nobody is overdue", async () => {
    await openDormant({ dormant: [] });
    expect(await screen.findByText("Every retailer on a beat was visited in the last 14 days.")).toBeInTheDocument();
  });

  it("shows the server's message on failure", async () => {
    await openDormant({ dormantResult: json({ status: 400, message: "Days must be between 1 and 365." }, false) });
    expect(await screen.findByText("Days must be between 1 and 365.")).toBeInTheDocument();
  });
});
