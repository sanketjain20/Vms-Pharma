import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Accounting from "./Accounting";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import { csvCells, parseBankDate, parseBankAmount, parseStatementCsv, presetRange } from "../../utils/accounting";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body, headers = { "Content-Type": "application/json" }) => Promise.resolve({ ok: (body?.status || 200) === 200, status: body?.status || 200,
  headers: { get: (k) => headers[k] }, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(["x"])), text: () => Promise.resolve(JSON.stringify(body)) });
const calls = (part) => apiClient.mock.calls.filter(([u]) => u.endsWith(`/api/Accounting/${part}`));
const body = (part, i = -1) => JSON.parse(calls(part).slice(i)[0][1].body);

function mockApi(actions = ["View"], routes = {}) {
  apiClient.mockImplementation((url, opts) => {
    if (url.includes("/api/Access/GetUserModuleAccess/42/")) return json({ status: 200, data: actions });
    const handler = routes[url.split("/api/Accounting/")[1]];
    if (handler) { const r = typeof handler === "function" ? handler(opts) : handler; return r && r.then ? r : json(r); }
    if (url.includes("/api/Accounting/TrialBalance")) return json({ status: 200, data: { balanced: true, totalDebit: 0, totalCredit: 0, rows: [] } });
    return json({ status: 200, data: null });
  });
}
const openTab = (name) => { render(<Accounting />); fireEvent.click(screen.getByRole("tab", { name })); };

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); window.confirm = jest.fn(() => true); global.URL.createObjectURL = jest.fn(() => "blob:x"); global.URL.revokeObjectURL = jest.fn(); });

describe("reading a bank statement file", () => {
  it("splits CSV cells with quotes and reads Indian dates and amounts", () => {
    expect(csvCells('31/10/2026,"NEFT, SHOP ONE","say ""hi""",1,234.50')).toEqual(["31/10/2026", "NEFT, SHOP ONE", 'say "hi"', "1", "234.50"]);
    expect(parseBankDate("31/10/2026")).toBe("2026-10-31");
    expect(parseBankDate("01-11-26")).toBe("2026-11-01");
    expect(parseBankDate("2026-10-31")).toBe("2026-10-31");
    expect(parseBankDate("31-Oct-2026")).toBe("2026-10-31");
    expect(parseBankDate("5 Sept 2026")).toBe("2026-09-05");
    expect(parseBankDate("31/02/2026")).toBeNull();
    expect(parseBankDate("Opening balance")).toBeNull();
    expect(parseBankAmount("1,23,456.78")).toBe(123456.78);
    expect(parseBankAmount("₹500")).toBe(500);
    expect(parseBankAmount("(120.00)")).toBe(-120);
    expect(parseBankAmount("")).toBe(0);
  });

  it("finds the header under the bank's title rows and reads withdrawals and deposits", () => {
    const csv = [
      "HDFC BANK Ltd.,,,,,,",
      "Statement of account,,,,,,",
      "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
      '01/10/26,"NEFT-SHOP ONE",UTR123,01/10/26,,"25,000.00","1,25,000.00"',
      "02/10/26,BANK CHARGES,,02/10/26,118.00,,124882.00",
      ",,,,,,",
      "Opening Balance,,,,,,100000",
    ].join("\n");
    const r = parseStatementCsv(csv);
    expect(r.lines).toEqual([
      { transactionDate: "2026-10-01", transactionType: "CREDIT", amount: 25000, referenceNumber: "UTR123", narration: "NEFT-SHOP ONE" },
      { transactionDate: "2026-10-02", transactionType: "DEBIT", amount: 118, referenceNumber: null, narration: "BANK CHARGES" },
    ]);
    expect(r.problems).toEqual(["Row 7: no date (skipped)"]);
  });

  it("reads one Amount column with a Dr / Cr column, and says when there is no header", () => {
    const r = parseStatementCsv("Txn Date;Description;Amount;Dr/Cr\n05-11-2026;UPI RAVI;500.00;CR\n06-11-2026;RENT;12000;DR");
    expect(r.lines.map((l) => `${l.transactionDate} ${l.transactionType} ${l.amount}`)).toEqual(["2026-11-05 CREDIT 500", "2026-11-06 DEBIT 12000"]);
    expect(parseStatementCsv("hello,world\n1,2").problems[0]).toMatch(/No header row/);
  });
});

describe("Excel / PDF export", () => {
  it("downloads the open report for the period, and is hidden without Download", async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mockApi(["View", "Download"], { Export: () => json({ status: 200 }, { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=accounting-trial-2026-11-04.xlsx" }) });
    render(<Accounting />);
    fireEvent.click(await screen.findByRole("button", { name: "⇩ Excel" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Excel file downloaded."));
    expect(body("Export")).toEqual({ ...presetRange("fy"), report: "trial", format: "XLSX" });
    expect(click).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Profit & Loss" }));
    fireEvent.click(screen.getByRole("button", { name: "⇩ PDF" }));
    await waitFor(() => expect(body("Export")).toMatchObject({ report: "pnl", format: "PDF" }));
    click.mockRestore();
  });

  it("shows why an export was refused", async () => {
    mockApi(["View", "Download"], { Export: { status: 403, message: "Access denied. Missing permission ID: 150" } });
    render(<Accounting />);
    fireEvent.click(await screen.findByRole("button", { name: "⇩ PDF" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Exporting needs the Accounting “Download” permission."));
  });

  it("isn't offered without Download, nor on tabs with nothing to export", async () => {
    mockApi(["View"]);
    render(<Accounting />);
    await screen.findByTestId("tb-status");
    expect(screen.queryByRole("button", { name: "⇩ Excel" })).toBeNull();
  });
});

const RECON = { status: 200, data: { bankBookBalance: 0, statementBalance: 0, unreconciledDifference: 0, rows: [
  { statementUKey: "s1", date: "2026-11-01", narration: "NEFT", referenceNumber: "U1", amount: 500, type: "CREDIT", status: "UNMATCHED", suggestions: [] }] } };

describe("Bank reconciliation — import and auto-match", () => {
  it("imports a CSV statement after showing what was read", async () => {
    mockApi(["View", "Add"], { BankReconciliation: RECON, "BankStatement/Import": { status: 200, data: { added: 2, duplicates: 1, rejected: [] } } });
    openTab("Bank reconciliation");
    fireEvent.click(await screen.findByRole("button", { name: "⇧ Import statement (CSV)" }));
    const file = new File(["Date,Narration,Ref,Debit,Credit\n01/11/2026,NEFT A,U1,,500\n02/11/2026,CHARGES,,59,\n03/11/2026,NEFT B,U2,,700"], "nov.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Statement file"), { target: { files: [file] } });
    expect(await screen.findByTestId("import-summary")).toHaveTextContent("nov.csv: 3 lines · money in ₹1,200.00 · money out ₹59.00");
    fireEvent.click(screen.getByRole("button", { name: "Import 3 lines" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("2 lines added, 1 already there."));
    expect(body("BankStatement/Import").lines[1]).toEqual({ transactionDate: "2026-11-02", transactionType: "DEBIT", amount: 59, referenceNumber: null, narration: "CHARGES" });
  });

  it("auto-matches with Edit and says how many were matched", async () => {
    mockApi(["View", "Edit"], { BankReconciliation: RECON, "BankReconciliation/AutoMatch": { status: 200, data: { matched: 1, checked: 1, matchedLines: ["x"] } } });
    openTab("Bank reconciliation");
    fireEvent.click(await screen.findByRole("button", { name: "Auto-match" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 of 1 line matched."));
    expect(body("BankReconciliation/AutoMatch")).toEqual(presetRange("fy"));
    expect(screen.queryByRole("button", { name: "⇧ Import statement (CSV)" })).toBeNull(); // importing needs Add
  });
});

describe("Vouchers — cancel and backdate permissions", () => {
  const V = { status: 200, data: [{ uKey: "v1", voucherType: "PAYMENT", voucherNumber: "PAY000001", voucherDate: "2026-11-01", amount: 10, lines: [{ ledger: "Rent", debit: 10, credit: 0 }, { ledger: "Bank", debit: 0, credit: 10 }], cancelled: false }] };
  const LEDGERS = { status: 200, data: [{ name: "Cash in Hand", group: "Asset", kind: "SYSTEM", usable: true }, { name: "Rent", group: "Expense", kind: "HEAD", usable: true }] };

  it("Edit alone no longer cancels; a voucher before today needs Backdate Vouchers", async () => {
    mockApi(["View", "Add", "Edit"], { Vouchers: V, Ledgers: LEDGERS, GstPosition: { status: 200, data: { outputGst: 0, inputGst: 0, setOff: 0, payableAfterSetOff: 0, gstPayable: 0, inputCarriedForward: 0 } } });
    openTab("Vouchers");
    const table = await screen.findByTestId("voucher-table");
    expect(within(table).queryByRole("button", { name: "Cancel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expense paid" }));
    const form = screen.getByTestId("voucher-form");
    expect(within(form).getByText("An earlier date needs “Backdate Vouchers”")).toBeInTheDocument();
    await waitFor(() => expect(within(form).getByRole("option", { name: "Rent" })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText("Voucher date"), { target: { value: "2020-01-01" } });
    fireEvent.change(within(form).getByLabelText("Paid for"), { target: { value: "Rent" } });
    fireEvent.change(within(form).getByLabelText("Voucher amount"), { target: { value: "10" } });
    fireEvent.click(within(form).getByRole("button", { name: "Post payment" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("needs the Accounting “Backdate Vouchers” permission");
    expect(calls("Voucher")).toHaveLength(0);
  });

  it("with Cancel Vouchers the cancel button is there", async () => {
    mockApi(["View", "Cancel Vouchers"], { Vouchers: V, Ledgers: LEDGERS });
    openTab("Vouchers");
    const table = await screen.findByTestId("voucher-table");
    expect(within(table).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});

const OPENING = { status: 200, data: { asOf: null, lines: [], totalDebit: 0, totalCredit: 0, toOpeningEquity: 0,
  ledgers: ["Cash in Hand", "Bank", "Inventory", "Owner's Capital", "Business Loans"],
  suggestions: [{ partyType: "RETAILER", partyId: 9, partyName: "Shop One", amount: 2000 }, { partyType: "SUPPLIER", partyId: 50, partyName: "Pharma Co", amount: 1500 }] } };

describe("Opening balances", () => {
  it("takes ledger amounts and the parties' MARG balances, shows the difference, and saves", async () => {
    mockApi(["View", "Add"], { OpeningBalances: (opts) => (opts?.method === "POST" ? { status: 200, data: { ...OPENING.data, asOf: "2026-04-01", lines: [] } } : OPENING) });
    openTab("Opening balances");
    expect(await screen.findByTestId("ob-asof")).toHaveTextContent("Not set");
    fireEvent.change(screen.getByLabelText("Books start on"), { target: { value: "2026-04-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Cash in hand" }));
    fireEvent.change(screen.getByLabelText("Opening line 1 debit"), { target: { value: "10000" } });
    fireEvent.click(within(screen.getByTestId("ob-offered")).getByRole("button", { name: "Add all 2" }));
    expect(screen.getByTestId("ob-debit")).toHaveTextContent("₹12,000.00");
    expect(screen.getByTestId("ob-credit")).toHaveTextContent("₹1,500.00");
    expect(screen.getByTestId("ob-equity")).toHaveTextContent("₹10,500.00");
    fireEvent.click(screen.getByRole("button", { name: "Save opening balances" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Opening balances saved."));
    expect(body("OpeningBalances")).toEqual({ asOf: "2026-04-01", lines: [
      { ledger: "Cash in Hand", debit: 10000, credit: 0 },
      { partyType: "RETAILER", partyId: 9, debit: 2000, credit: 0 },
      { partyType: "SUPPLIER", partyId: 50, debit: 0, credit: 1500 }] });
  });

  it("is read-only without Add", async () => {
    mockApi(["View"], { OpeningBalances: OPENING });
    openTab("Opening balances");
    expect(await screen.findByText("Entering opening balances needs the Accounting “Add” permission.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save opening balances" })).toBeNull();
  });
});

describe("Audit trail", () => {
  it("lists who did what, and filters by action", async () => {
    mockApi(["View"], { Audit: { status: 200, data: [
      { at: "2026-11-04T10:15:00", byName: "Asha", action: "VOUCHER_CANCELLED", reference: "PAY000003", details: "₹500.00 · Typed twice" },
      { at: "2026-11-04T09:00:00", byName: "Asha", action: "VOUCHER_POSTED", reference: "PAY000003", details: "Payment ₹500.00" },
      { at: "2026-11-03T18:00:00", byName: "Ravi", action: "BOOKS_CLOSED", reference: null, details: "Closed up to 31 Oct 2026" }] } });
    openTab("Audit trail");
    const table = await screen.findByTestId("au-table");
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("04 Nov 2026 10:15AshaVoucher cancelledPAY000003₹500.00 · Typed twice");
    expect(screen.getByTestId("au-cancelled")).toHaveTextContent("1");
    expect(screen.getByTestId("au-closing")).toHaveTextContent("1");
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "BOOKS_CLOSED" } });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(table).toHaveTextContent("Ravi");
  });
});
