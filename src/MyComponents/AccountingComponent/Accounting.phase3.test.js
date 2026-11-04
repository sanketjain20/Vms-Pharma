import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Accounting from "./Accounting";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import { lastYearEnd } from "./FinancialReports";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: (body?.status || 200) === 200, status: body?.status || 200, headers: { get: () => "application/json" }, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
const calls = (part) => apiClient.mock.calls.filter(([u]) => u.endsWith(`/api/Accounting/${part}`));
const body = (part, i = -1) => JSON.parse(calls(part).slice(i)[0][1].body);

function mockApi(actions = ["View"], routes = {}) {
  apiClient.mockImplementation((url, opts) => {
    if (url.includes("/api/Access/GetUserModuleAccess/42/")) return json({ status: 200, data: actions });
    const handler = routes[url.split("/api/Accounting/")[1]];
    if (handler) return json(typeof handler === "function" ? handler(opts) : handler);
    if (url.includes("/api/Accounting/TrialBalance")) return json({ status: 200, data: { balanced: true, totalDebit: 0, totalCredit: 0, rows: [] } });
    return json({ status: 200, data: null });
  });
}
const openTab = (name) => { render(<Accounting />); fireEvent.click(screen.getByRole("tab", { name })); };

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); window.confirm = jest.fn(() => true); });

describe("Profit & Loss — complete", () => {
  it("shows other income and expenses as sections with their totals, and the net margin", async () => {
    mockApi(["View"], { ProfitAndLoss: { status: 200, data: { grossSales: 1000, salesReturns: 0, netSales: 1000, costOfGoodsSold: 0, grossProfit: 1000, grossMarginPercent: 100,
      otherLines: [{ ledger: "Other Income", section: "Other income", amount: 500 }, { ledger: "Rent", section: "Expenses", amount: -2000 }, { ledger: "Electricity", section: "Expenses", amount: -300 }],
      otherIncome: 500, expenses: 2300, netProfit: -800, netMarginPercent: -80 } } });
    openTab("Profit & Loss");
    const statement = await screen.findByTestId("pl-statement");
    expect(within(statement).getByTestId("pl-section-income")).toHaveTextContent("Add: other income");
    expect(statement).toHaveTextContent("Other Income₹500.00Total other income₹500.00");
    expect(within(statement).getByTestId("pl-section-expenses")).toHaveTextContent("Less: expenses");
    expect(statement).toHaveTextContent("Rent−₹2,000.00Electricity−₹300.00Total expenses−₹2,300.00");
    expect(screen.getByTestId("pl-net")).toHaveTextContent("Net loss−₹800.00Net margin -80.00%");
  });
});

describe("Stock valuation — batch by batch", () => {
  it("opens a product's batches with their expiry status, and adds up what is expired or expiring", async () => {
    mockApi(["View"], { StockValuation: { status: 200, data: { totalUnits: 10, totalValue: 500, ledgerBalance: 500, difference: 0, expiredValue: 80, nearExpiryValue: 150, rows: [
      { product: "Syrup", godown: "Main", quantity: 10, unitCost: 50, value: 500, batches: 3, nearestExpiry: "2026-10-31", batchLines: [
        { batchNumber: "OLD", expiryDate: "2026-10-31", quantity: 2, unitCost: 40, value: 80, status: "EXPIRED" },
        { batchNumber: "SOON", expiryDate: "2026-12-01", quantity: 3, unitCost: 50, value: 150, status: "NEAR_EXPIRY" },
        { batchNumber: "NEW", expiryDate: "2027-11-01", quantity: 5, unitCost: 54, value: 270, status: "OK" }] }] } } });
    openTab("Stock valuation");
    await screen.findByTestId("sv-table");
    expect(screen.getByTestId("sv-expiry")).toHaveTextContent("₹230.00₹80.00 expired · ₹150.00 within 90 days");
    expect(screen.queryByTestId("sv-batches")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "3 batches of Syrup" }));
    const rows = within(screen.getByTestId("sv-batches")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("OLD31 Oct 20262₹40.00₹80.00Expired");
    expect(rows[2]).toHaveTextContent("Expires soon");
    expect(rows[3]).not.toHaveTextContent("Expire");
  });
});

describe("Cash flow", () => {
  it("shows opening, each activity with its lines and net, and the closing that agrees with the books", async () => {
    mockApi(["View"], { CashFlow: { status: 200, data: { openingBalance: 50000, netChange: 8090, closingBalance: 58090, booksClosing: 58090, agrees: true, sections: [
      { name: "Operating", total: -1410, lines: [{ label: "Received from customers", amount: 1180 }, { label: "Paid to suppliers", amount: -590 }, { label: "Expenses paid", amount: -2000 }] },
      { name: "Investing", total: -10000, lines: [{ label: "Fixed assets and deposits", amount: -10000 }] },
      { name: "Financing", total: 19500, lines: [{ label: "Drawings", amount: -500 }, { label: "Loans", amount: 20000 }] }] } } });
    openTab("Cash flow");
    const st = await screen.findByTestId("cf-statement");
    expect(lastBodyIsRange("CashFlow")).toBe(true);
    expect(st).toHaveTextContent("Operating activitiesReceived from customers₹1,180.00Paid to suppliers−₹590.00Expenses paid−₹2,000.00");
    expect(screen.getByTestId("cf-operating")).toHaveTextContent("Net cash from operating−₹1,410.00");
    expect(screen.getByTestId("cf-financing")).toHaveTextContent("₹19,500.00");
    expect(screen.getByTestId("cf-closing")).toHaveTextContent("₹58,090.00Agrees with the cash and bank books");
    expect(screen.getByTestId("cf-closing")).toHaveClass("acx-kpi--good");
  });
});
const lastBodyIsRange = (part) => { const b = body(part); return !!b.fromDate && !!b.toDate; };

describe("GST liability", () => {
  it("lists each month's output, input, net liability, set-off and payment, with what is still to pay", async () => {
    mockApi(["View"], { GstLiability: { status: 200, data: {
      months: [
        { month: "2025-10", outputOnSales: 180, outputOnReturns: 0, inputOnPurchases: 90, inputOnReturns: 0, netOutput: 180, netInput: 90, netLiability: 90, setOff: 0, paid: 0 },
        { month: "2025-11", outputOnSales: 0, outputOnReturns: 18, inputOnPurchases: 0, inputOnReturns: 9, netOutput: -18, netInput: -9, netLiability: -9, setOff: 162, paid: 81 }],
      total: { month: "Total", outputOnSales: 180, outputOnReturns: 18, inputOnPurchases: 90, inputOnReturns: 9, netOutput: 162, netInput: 81, netLiability: 81, setOff: 162, paid: 81 },
      position: { asAt: "2025-11-30", outputGst: 0, inputGst: 0, setOff: 0, payableAfterSetOff: 0, inputCarriedForward: 0, gstPayable: 0 } } } });
    openTab("GST liability");
    const table = await screen.findByTestId("gst-table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Oct 2025₹180.00₹0.00₹90.00₹0.00₹90.00₹0.00₹0.00");
    expect(rows[2]).toHaveTextContent("Nov 2025₹0.00−₹18.00₹0.00−₹9.00−₹9.00₹162.00₹81.00");
    expect(screen.getByTestId("gst-net")).toHaveTextContent("₹81.00");
    expect(screen.getByTestId("gst-due")).toHaveTextContent("₹0.00As at 30 Nov 2025 · set off ₹162.00, paid ₹81.00 in the period");
  });
});

const AGEING = { status: 200, data: { kind: "RECEIVABLE", asOf: "2026-11-02", upTo30: 600, days31to60: 300, days61to90: 0, over90: 200, total: 1100, overdue: 300, ledgerBalance: 1150, difference: -50, parties: [
  { party: "Shop One", upTo30: 500, days31to60: 300, days61to90: 0, over90: 200, total: 1000, overdue: 300, bills: [
    { reference: "INV3", date: "2026-07-25", dueDate: null, ageDays: 100, overdueDays: 0, amount: 200, outstanding: 200, bucket: "90+" },
    { reference: "INV2", date: "2026-09-18", dueDate: "2026-10-18", ageDays: 45, overdueDays: 15, amount: 300, outstanding: 300, bucket: "31-60" }] },
  { party: "Ravi", upTo30: 100, days31to60: 0, days61to90: 0, over90: 0, total: 100, overdue: 0, bills: [] }] } };

describe("Ageing", () => {
  it("buckets each party's unpaid bills, opens a party's bills, and says when the ledger differs", async () => {
    mockApi(["View"], { Ageing: (opts) => (JSON.parse(opts.body).group === "PAYABLE" ? { status: 200, data: { ...AGEING.data, kind: "PAYABLE", parties: [], total: 0, ledgerBalance: 0, difference: 0, overdue: 0, over90: 0 } } : AGEING) });
    openTab("Ageing");
    const table = await screen.findByTestId("ag-table");
    expect(body("Ageing")).toEqual({ group: "RECEIVABLE" });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Shop One₹500.00₹300.00₹200.00₹1,000.00₹300.00");
    expect(screen.getByTestId("ag-overdue")).toHaveTextContent("₹300.00");
    expect(screen.getByTestId("ag-ledger")).toHaveTextContent("Bills differ by −₹50.00");
    fireEvent.click(within(table).getByRole("button", { name: "Shop One" }));
    const bills = within(screen.getByTestId("ag-bills")).getAllByRole("row");
    expect(bills[2]).toHaveTextContent("INV218 Sept 202618 Oct 2026 15 days overdue45₹300.00₹300.00");
    fireEvent.click(screen.getByRole("button", { name: "Payables" }));
    await waitFor(() => expect(body("Ageing")).toEqual({ group: "PAYABLE" }));
    expect(await screen.findByText("Nothing is owed to suppliers.")).toBeInTheDocument();
  });
});

const STATUS = (until, history = []) => ({ status: 200, data: { closedUntil: until, history } });

describe("Closing the books", () => {
  it("knows the usual day to close up to: the last 31 March", () => {
    expect(lastYearEnd(new Date(2026, 10, 2))).toBe("2026-03-31");
    expect(lastYearEnd(new Date(2027, 1, 10))).toBe("2026-03-31");
  });

  it("without the Close Books permission it only shows where the books stand", async () => {
    mockApi(["View", "Add", "Edit"], { PeriodClose: STATUS("2026-03-31", [{ action: "CLOSE", closedUntil: "2026-03-31", reason: "Audited", byName: "Asha", at: "2026-05-01T10:00:00" }]) });
    openTab("Closing");
    expect(await screen.findByTestId("pc-until")).toHaveTextContent("31 Mar 2026");
    expect(screen.queryByRole("button", { name: "Close books" })).toBeNull();
    expect(screen.getByText(/needs the Accounting “Close Books” permission/)).toBeInTheDocument();
    expect(within(screen.getByTestId("pc-history")).getAllByRole("row")[1]).toHaveTextContent("Closed31 Mar 2026AshaAudited");
  });

  it("closes the books up to the day chosen, after asking", async () => {
    mockApi(["View", "Close Books"], { PeriodClose: (opts) => (opts?.method === "POST" ? STATUS("2026-03-31", [{ action: "CLOSE", closedUntil: "2026-03-31", byName: "Asha", at: "2026-11-02T10:00:00" }]) : STATUS(null)) });
    openTab("Closing");
    expect(await screen.findByTestId("pc-until")).toHaveTextContent("Open");
    expect(screen.getByLabelText("Close up to")).toHaveValue(lastYearEnd());
    fireEvent.change(screen.getByLabelText("Close up to"), { target: { value: "2026-03-31" } });
    fireEvent.change(screen.getByLabelText("Closing note"), { target: { value: "FY 2025-26 audited" } });
    fireEvent.click(screen.getByRole("button", { name: "Close books" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Books closed up to 31 Mar 2026."));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("No voucher can then be posted on or before that day."));
    expect(body("PeriodClose")).toEqual({ toDate: "2026-03-31", reason: "FY 2025-26 audited" });
    expect(screen.getByTestId("pc-until")).toHaveTextContent("31 Mar 2026");
  });

  it("reopening needs a reason", async () => {
    mockApi(["View", "Close Books"], { PeriodClose: STATUS("2026-09-30"), PeriodReopen: STATUS("2026-03-31") });
    openTab("Closing");
    const reopen = await screen.findByRole("button", { name: "Reopen" });
    expect(reopen).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Keep closed up to"), { target: { value: "2026-03-31" } });
    fireEvent.change(screen.getByLabelText("Reason for reopening"), { target: { value: "A September bill was missed" } });
    fireEvent.click(reopen);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Books reopened: now closed up to 31 Mar 2026."));
    expect(body("PeriodReopen")).toEqual({ toDate: "2026-03-31", reason: "A September bill was missed" });
  });
});
