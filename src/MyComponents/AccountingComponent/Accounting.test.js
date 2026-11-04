import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Accounting from "./Accounting";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import { presetRange } from "../../utils/accounting";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body, headers = { "Content-Type": "application/json" }, ok = true) =>
  Promise.resolve({ ok, status: body?.status || 200, headers: { get: (k) => headers[k] }, json: () => Promise.resolve(body), text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)) });

const TRIAL = { status: 200, data: { balanced: true, totalDebit: 1180, totalCredit: 1180, rows: [
  { ledger: "Accounts Receivable", group: "Asset", debit: 1180, credit: 0 },
  { ledger: "Output GST", group: "Liability", debit: 0, credit: 180 },
  { ledger: "Sales", group: "Income", debit: 0, credit: 1000 },
] } };
const OFF = { status: 200, data: { balanced: false, totalDebit: 1180, totalCredit: 1000, rows: TRIAL.data.rows } };
const SHEET = { status: 200, data: { asAt: "2026-10-31", assets: [{ ledger: "Bank", amount: 600 }, { ledger: "Cash in Hand", amount: 400 }, { ledger: "Inventory", amount: 300 }],
  liabilities: [{ ledger: "Output GST", amount: 180 }], equity: [{ ledger: "Opening Stock", amount: 300 }, { ledger: "Profit & Loss (current year)", amount: 820 }],
  totalAssets: 1300, totalLiabilities: 180, totalEquity: 1120, balanced: true } };
const PNL = { status: 200, data: { grossSales: 1000, salesReturns: 100, netSales: 900, costOfGoodsSold: 600, grossProfit: 300, grossMarginPercent: 33.33,
  otherLines: [{ ledger: "Round Off", amount: 0.4 }, { ledger: "Stock Written Off", amount: -50 }], netProfit: 250.4 } };
const STOCK = { status: 200, data: { asOf: "2026-10-31", totalUnits: 8, totalValue: 390, ledgerBalance: 300, difference: 90, rows: [
  { product: "Shirt", godown: "Main", batches: 2, nearestExpiry: "2026-12-31", quantity: 2, unitCost: 45, value: 90 },
  { product: "Trousers", godown: "Main", batches: 1, nearestExpiry: null, quantity: 6, unitCost: 50, value: 300 },
] } };
const CASH = { status: 200, data: { book: "Cash Book", openingBalance: 0, closingBalance: 60, entries: [
  { date: "2026-10-30", reference: "rc-1", narration: "Customer receipt", mode: "Receipt", receipts: 100, payments: 0, balance: 100 },
  { date: "2026-10-31", reference: "sp-1", narration: "Supplier payment SP-1", mode: "Payment", receipts: 0, payments: 40, balance: 60 },
] } };
const RECON = { status: 200, data: { bankBookBalance: 500, statementBalance: 500, unreconciledDifference: 0, rows: [
  { statementUKey: "st-1", date: "2026-10-30", narration: "NEFT SHOP ONE", referenceNumber: "UTR1", amount: 500, type: "CREDIT", status: "UNMATCHED",
    suggestions: [{ paymentUKey: "pc-1", date: "2026-10-29", kind: "Customer receipt", party: "Shop One", mode: "UPI", reference: "UTR1", amount: 500 }] },
  { statementUKey: "st-2", date: "2026-10-28", narration: "CHQ 22", referenceNumber: null, amount: 200, type: "DEBIT", status: "RECONCILED", suggestions: [] },
] } };

const call = (part) => apiClient.mock.calls.filter(([u]) => u.includes(`/api/Accounting/${part}`));
const lastBody = (part) => JSON.parse(call(part).slice(-1)[0][1].body);

function mockApi({ actions = ["View"], replies = {} } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess/42/")) return json({ status: 200, data: actions });
    for (const [part, reply] of Object.entries(replies)) if (url.includes(`/api/Accounting/${part}`)) return typeof reply === "function" ? reply() : json(reply);
    if (url.includes("/api/Accounting/TrialBalance")) return json(TRIAL);
    return json({ status: 200, data: null });
  });
}

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("Accounting — the screen", () => {
  it("opens on the trial balance for this financial year, grouped, with whether it agrees", async () => {
    mockApi();
    render(<Accounting />);
    expect(screen.getByRole("heading", { name: "Accounting" })).toBeInTheDocument();
    expect(await screen.findByTestId("tb-status")).toHaveTextContent("Agrees");
    expect(screen.getByTestId("tb-debit")).toHaveTextContent("₹1,180.00");
    expect(lastBody("TrialBalance")).toEqual(presetRange("fy"));
    const table = screen.getByTestId("tb-table");
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Ledger", "Debit", "Credit"]);
    expect(within(table).getByText("Assets")).toBeInTheDocument();
    expect(within(table).getByText("Liabilities")).toBeInTheDocument();
    expect(within(table).getByText("Income")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This financial year" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says by how much a trial balance is off", async () => {
    mockApi({ replies: { TrialBalance: OFF } });
    render(<Accounting />);
    const status = await screen.findByTestId("tb-status");
    expect(status).toHaveTextContent("Does not agree");
    expect(status).toHaveTextContent("Off by ₹180.00");
  });

  it("a quick period or picked dates ask again for that period", async () => {
    mockApi();
    render(<Accounting />);
    await screen.findByTestId("tb-status");
    fireEvent.click(screen.getByRole("button", { name: "Last month" }));
    await waitFor(() => expect(lastBody("TrialBalance")).toEqual(presetRange("lastMonth")));
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-06-01" } });
    await waitFor(() => expect(lastBody("TrialBalance").fromDate).toBe("2026-06-01"));
    expect(screen.getByRole("button", { name: "Last month" })).toHaveAttribute("aria-pressed", "false");
  });

  it("a From date after the To date is refused without asking the server", async () => {
    mockApi();
    render(<Accounting />);
    await screen.findByTestId("tb-status");
    const before = call("TrialBalance").length;
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2099-01-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("The “From” date is after the “To” date.");
    expect(call("TrialBalance").length).toBe(before);
  });

  it("shows the balance sheet side by side, as at the period's last day, with stock and equity", async () => {
    mockApi({ replies: { BalanceSheet: SHEET } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Balance sheet" }));
    const assets = await screen.findByTestId("bs-side-assets");
    expect(assets).toHaveTextContent("Bank₹600.00");
    expect(assets).toHaveTextContent("Inventory₹300.00");
    expect(assets).toHaveTextContent("Total₹1,300.00");
    const right = screen.getByTestId("bs-side-liabilities");
    expect(right).toHaveTextContent("Liabilities");
    expect(right).toHaveTextContent("Equity");
    expect(right).toHaveTextContent("Opening Stock₹300.00");
    expect(right).toHaveTextContent("Profit & Loss (current year)₹820.00");
    expect(right).toHaveTextContent("Total₹1,300.00"); // liabilities + equity
    expect(screen.getByTestId("bs-liabilities")).toHaveTextContent("₹1,300.00");
    expect(screen.getByTestId("bs-diff")).toHaveTextContent("Both sides match");
    expect(screen.getByTestId("bs-assets")).toHaveTextContent("As at 31 Oct 2026");
    expect(screen.getByTestId("acx-lead")).toHaveTextContent(/as at/);
  });

  it("the profit and loss goes from sales through the cost of goods sold to the net profit", async () => {
    mockApi({ replies: { ProfitAndLoss: PNL } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Profit & Loss" }));
    const statement = await screen.findByTestId("pl-statement");
    expect(lastBody("ProfitAndLoss")).toEqual(presetRange("fy"));
    expect(screen.getByTestId("pl-sales")).toHaveTextContent("₹900.00");
    expect(screen.getByTestId("pl-cogs")).toHaveTextContent("₹600.00");
    expect(screen.getByTestId("pl-gross")).toHaveTextContent("Margin 33.33%");
    expect(screen.getByTestId("pl-net")).toHaveTextContent("Net profit₹250.40");
    expect(statement).toHaveTextContent("Less: sales returns−₹100.00");
    expect(statement).toHaveTextContent("Less: cost of goods sold−₹600.00");
    expect(statement).toHaveTextContent("Stock Written Off−₹50.00");
    expect(screen.getByTestId("pl-net-line")).toHaveTextContent("Net profit₹250.40");
  });

  it("a loss is called a loss", async () => {
    mockApi({ replies: { ProfitAndLoss: { status: 200, data: { ...PNL.data, netProfit: -75 } } } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Profit & Loss" }));
    expect(await screen.findByTestId("pl-net")).toHaveTextContent("Net loss−₹75.00");
    expect(screen.getByTestId("pl-net")).toHaveClass("acx-kpi--bad");
  });

  it("a period with nothing to show says so", async () => {
    mockApi({ replies: { ProfitAndLoss: { status: 200, data: { grossSales: 0, salesReturns: 0, netSales: 0, costOfGoodsSold: 0, grossProfit: 0, grossMarginPercent: null, otherLines: [], netProfit: 0 } } } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Profit & Loss" }));
    expect(await screen.findByTestId("acx-nothing")).toHaveTextContent("No sales, cost, income or expenses");
    expect(screen.getByTestId("pl-gross")).toHaveTextContent("Margin —");
  });

  it("the stock valuation lists the stock on hand at cost against the Inventory ledger, and can be searched", async () => {
    mockApi({ replies: { StockValuation: STOCK } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Stock valuation" }));
    const table = await screen.findByTestId("sv-table");
    expect(screen.getByTestId("sv-value")).toHaveTextContent("₹390.00");
    expect(screen.getByTestId("sv-value")).toHaveTextContent("8 units · 2 products");
    expect(screen.getByTestId("sv-ledger")).toHaveTextContent("₹300.00");
    expect(screen.getByTestId("sv-diff")).toHaveTextContent("₹90.00");
    expect(screen.getByTestId("sv-diff")).toHaveClass("acx-kpi--bad");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("ShirtMain231 Dec 20262₹45.00₹90.00");
    expect(rows[2]).toHaveTextContent("TrousersMain1—6₹50.00₹300.00");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search stock" }), { target: { value: "trou" } });
    expect(within(table).getAllByRole("row")).toHaveLength(3); // head, Trousers, total
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByTestId("acx-lead")).toHaveTextContent("as of today");
  });

  it("stock that matches the books shows it", async () => {
    mockApi({ replies: { StockValuation: { status: 200, data: { ...STOCK.data, ledgerBalance: 390, difference: 0 } } } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Stock valuation" }));
    expect(await screen.findByTestId("sv-diff")).toHaveTextContent("The books match the stock");
  });

  it("the trial balance shows opening stock under Equity", async () => {
    mockApi({ replies: { TrialBalance: { status: 200, data: { balanced: true, totalDebit: 500, totalCredit: 500, rows: [
      { ledger: "Inventory", group: "Asset", debit: 500, credit: 0 }, { ledger: "Opening Stock", group: "Equity", debit: 0, credit: 500 }] } } } });
    render(<Accounting />);
    const table = await screen.findByTestId("tb-table");
    expect(within(table).getByText("Equity")).toHaveClass("acx-pill--equity");
  });

  it("the cash book shows money in, out and the running balance, and can be searched", async () => {
    mockApi({ replies: { CashBook: CASH } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Cash book" }));
    expect(await screen.findByTestId("book-in")).toHaveTextContent("₹100.00");
    expect(screen.getByTestId("book-out")).toHaveTextContent("₹40.00");
    expect(screen.getByTestId("book-closing")).toHaveTextContent("₹60.00");
    const rows = within(screen.getByTestId("book-table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("30 Oct 2026Receiptrc-1Customer receipt₹100.00₹100.00");
    fireEvent.change(screen.getByLabelText("Search entries"), { target: { value: "supplier" } });
    expect(within(screen.getByTestId("book-table")).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("an empty period says so", async () => {
    mockApi({ replies: { BankBook: { status: 200, data: { book: "Bank Book", openingBalance: 0, closingBalance: 0, entries: [] } } } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Bank book" }));
    expect(await screen.findByTestId("acx-nothing")).toHaveTextContent("No bank receipts or payments in this period.");
  });

  it("without the permission it says to ask for it in Roles, and can try again", async () => {
    mockApi({ replies: { TrialBalance: { status: 403, message: "Access denied. Missing permission ID: 147" } } });
    render(<Accounting />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Ask an admin to grant it in Roles.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(call("TrialBalance").length).toBe(2));
  });
});

describe("Accounting — Tally export", () => {
  it("is hidden without the Download permission", async () => {
    mockApi({ actions: ["View"] });
    render(<Accounting />);
    await screen.findByTestId("tb-status");
    expect(screen.queryByRole("button", { name: /Export Tally XML/ })).toBeNull();
  });

  it("downloads the XML for the period", async () => {
    const created = jest.fn(() => "blob:x");
    global.URL.createObjectURL = created;
    global.URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockApi({ actions: ["View", "Download"], replies: { TallyExport: () => json("<ENVELOPE/>", { "Content-Type": "application/xml" }) } });
    render(<Accounting />);
    fireEvent.click(await screen.findByRole("button", { name: /Export Tally XML/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tally XML downloaded."));
    expect(lastBody("TallyExport")).toEqual(presetRange("fy"));
    expect(created).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("a refused export shows why instead of saving an error as XML", async () => {
    mockApi({ actions: ["View", "Download"], replies: { TallyExport: () => json({ status: 403, message: "Access denied. Missing permission ID: 150" }, { "Content-Type": "application/json" }, false) } });
    render(<Accounting />);
    fireEvent.click(await screen.findByRole("button", { name: /Export Tally XML/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Exporting needs the Accounting “Download” permission."));
  });
});

describe("Accounting — bank reconciliation", () => {
  const openRecon = async (actions) => {
    mockApi({ actions, replies: { BankReconciliation: RECON, BankStatement: { status: 200, data: {} }, "st-1/Match": { status: 200, data: {} } } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Bank reconciliation" }));
    return screen.findByTestId("recon-table");
  };

  it("shows the balances, what is left to match and each line's status", async () => {
    const table = await openRecon(["View"]);
    expect(screen.getByTestId("recon-diff")).toHaveTextContent("Book and statement agree");
    expect(screen.getByTestId("recon-unmatched")).toHaveTextContent("1");
    const [, open, done] = within(table).getAllByRole("row");
    expect(open).toHaveTextContent("NEFT SHOP ONE");
    expect(open).toHaveTextContent("To match");
    expect(done).toHaveTextContent("Matched");
    expect(screen.queryByRole("button", { name: "+ Add statement line" })).toBeNull(); // no Add permission
  });

  it("adds a statement line", async () => {
    await openRecon(["View", "Add"]);
    fireEvent.click(screen.getByRole("button", { name: "+ Add statement line" }));
    const form = screen.getByRole("form", { name: "Add statement line" });
    fireEvent.click(within(form).getByRole("button", { name: "Add line" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Enter the amount on the statement.");
    fireEvent.change(within(form).getByLabelText("Money in or out"), { target: { value: "DEBIT" } });
    fireEvent.change(within(form).getByLabelText("Statement amount"), { target: { value: "250.5" } });
    fireEvent.change(within(form).getByLabelText("Statement reference"), { target: { value: " CHQ 41 " } });
    fireEvent.click(within(form).getByRole("button", { name: "Add line" }));
    await waitFor(() => expect(call("BankStatement")).toHaveLength(1));
    expect(lastBody("BankStatement")).toMatchObject({ transactionType: "DEBIT", amount: 250.5, referenceNumber: "CHQ 41", narration: null });
    await waitFor(() => expect(call("BankReconciliation").length).toBeGreaterThan(1)); // reloaded
  });

  it("finds the matching payment and matches it", async () => {
    await openRecon(["View", "Edit"]);
    fireEvent.click(screen.getByRole("button", { name: "Find match (1)" }));
    const list = screen.getByTestId("recon-suggestions");
    expect(list).toHaveTextContent("Shop One");
    expect(list).toHaveTextContent("Customer receipt · 29 Oct 2026 · UPI · UTR1");
    fireEvent.click(within(list).getByRole("button", { name: "Match to Shop One 29 Oct 2026" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Matched — the line is reconciled."));
    expect(call("BankReconciliation/st-1/Match")[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ paymentUKey: "pc-1" }) });
  });

  it("without Edit the matches are shown but cannot be applied", async () => {
    await openRecon(["View"]);
    fireEvent.click(screen.getByRole("button", { name: "Find match (1)" }));
    expect(within(screen.getByTestId("recon-suggestions")).queryByRole("button", { name: /Match to/ })).toBeNull();
    expect(screen.getByText("Matching needs the Accounting “Edit” permission.")).toBeInTheDocument();
  });
});

describe("Accounting — bill payments and returns in the books", () => {
  it("shows bill payments, refunds and credit notes with their own voucher colours", async () => {
    const BOOK = { status: 200, data: { book: "Cash Book", openingBalance: 0, closingBalance: 59, entries: [
      { date: "2026-10-31", reference: "INV-4", narration: "Paid at billing · Cash", mode: "Receipt", receipts: 118, payments: 0, balance: 118 },
      { date: "2026-10-31", reference: "RET-1", narration: "Refund for sales return · Cash", mode: "Payment", receipts: 0, payments: 59, balance: 59 },
    ] } };
    mockApi({ replies: { CashBook: BOOK } });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Cash book" }));
    const rows = within(await screen.findByTestId("book-table")).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Paid at billing · Cash");
    expect(within(rows[0]).getByText("Receipt")).toHaveClass("acx-pill--in");
    expect(within(rows[1]).getByText("Payment")).toHaveClass("acx-pill--out");
  });
});
