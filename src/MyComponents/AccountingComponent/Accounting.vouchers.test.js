import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Accounting from "./Accounting";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";
import { simpleLines, voucherTotals, drCr, cashCountResult } from "../../utils/accounting";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: (body?.status || 200) === 200, status: body?.status || 200, headers: { get: () => "application/json" }, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const LEDGERS = [
  { name: "Cash in Hand", group: "Asset", kind: "SYSTEM", usable: true, disabled: false },
  { name: "Bank", group: "Asset", kind: "SYSTEM", usable: true, disabled: false },
  { name: "Sales", group: "Income", kind: "SYSTEM", usable: false, disabled: false },
  { name: "GST Payable", group: "Liability", kind: "SYSTEM", usable: true, disabled: false },
  { name: "Rent", group: "Expense", kind: "HEAD", usable: true, disabled: false },
  { name: "Owner's Capital", group: "Equity", kind: "HEAD", usable: true, disabled: false },
  { name: "Cash Short / Excess", group: "Expense", kind: "HEAD", usable: true, disabled: false },
  { name: "Old Head", group: "Expense", kind: "HEAD", usable: false, disabled: true },
];
const VOUCHERS = [
  { uKey: "v2", voucherType: "PAYMENT", voucherNumber: "PAY000002", voucherDate: "2026-10-31", source: "MANUAL", narration: "October rent", reference: "R-10", amount: 5000,
    lines: [{ ledger: "Rent", debit: 5000, credit: 0 }, { ledger: "Bank", debit: 0, credit: 5000 }], cancelled: false },
  { uKey: "v1", voucherType: "RECEIPT", voucherNumber: "REC000001", voucherDate: "2026-10-30", source: "MANUAL", narration: "Capital introduced", amount: 20000,
    lines: [{ ledger: "Cash in Hand", debit: 20000, credit: 0 }, { ledger: "Owner's Capital", debit: 0, credit: 20000 }], cancelled: true, cancelReason: "Entered twice", cancelledByName: "Asha" },
];
const GST = { asAt: "2026-11-01", outputGst: 1000, inputGst: 300, setOff: 300, payableAfterSetOff: 700, inputCarriedForward: 0, gstPayable: 250 };

let routes;
const calls = (part) => apiClient.mock.calls.filter(([u]) => u.endsWith(`/api/Accounting/${part}`));
const body = (part, i = -1) => JSON.parse(calls(part).slice(i)[0][1].body);

function mockApi(actions = ["View", "Add", "Edit", "Cancel Vouchers", "Backdate Vouchers"], extra = {}) {
  routes = {
    Ledgers: () => ({ status: 200, data: LEDGERS }),
    Vouchers: () => ({ status: 200, data: VOUCHERS }),
    GstPosition: () => ({ status: 200, data: GST }),
    TrialBalance: () => ({ status: 200, data: { balanced: true, totalDebit: 0, totalCredit: 0, rows: [] } }),
    ...extra,
  };
  apiClient.mockImplementation((url, opts) => {
    if (url.includes("/api/Access/GetUserModuleAccess/42/")) return json({ status: 200, data: actions });
    const part = url.split("/api/Accounting/")[1];
    const handler = routes[part];
    return json(handler ? handler(opts) : { status: 200, data: null });
  });
}

const openVouchers = async () => {
  render(<Accounting />);
  fireEvent.click(screen.getByRole("tab", { name: "Vouchers" }));
  return screen.findByTestId("voucher-table");
};

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); window.confirm = jest.fn(() => true); });

describe("voucher helpers", () => {
  it("builds receipt, payment and contra lines", () => {
    expect(simpleLines({ type: "RECEIPT", money: "Bank", account: "Owner's Capital", amount: "1000" })).toEqual([
      { ledger: "Bank", debit: 1000, credit: 0 }, { ledger: "Owner's Capital", debit: 0, credit: 1000 }]);
    expect(simpleLines({ type: "PAYMENT", money: "Cash in Hand", account: "Rent", amount: "99.999" })).toEqual([
      { ledger: "Rent", debit: 100, credit: 0 }, { ledger: "Cash in Hand", debit: 0, credit: 100 }]);
    expect(simpleLines({ type: "CONTRA", direction: "toBank", amount: 500 })).toEqual([
      { ledger: "Bank", debit: 500, credit: 0 }, { ledger: "Cash in Hand", debit: 0, credit: 500 }]);
    expect(simpleLines({ type: "CONTRA", direction: "toCash", amount: 500 })[0].ledger).toBe("Cash in Hand");
  });

  it("checks a journal balances, prints Dr / Cr balances and reads a cash count", () => {
    expect(voucherTotals([{ debit: "100.10", credit: "" }, { debit: "", credit: "100.1" }])).toEqual({ debit: 100.1, credit: 100.1, balanced: true });
    expect(voucherTotals([{ debit: "100", credit: "" }, { debit: "", credit: "99" }]).balanced).toBe(false);
    expect(voucherTotals([]).balanced).toBe(false);
    expect(drCr(1200)).toBe("₹1,200.00 Dr");
    expect(drCr(-300)).toBe("₹300.00 Cr");
    expect(drCr(0)).toBe("₹0.00");
    expect(cashCountResult("950", 1000)).toEqual({ diff: -50, kind: "short" });
    expect(cashCountResult("1000.5", 1000)).toEqual({ diff: 0.5, kind: "excess" });
    expect(cashCountResult("1000", 1000).kind).toBe("match");
    expect(cashCountResult("", 1000)).toBeNull();
  });
});

describe("Accounting — vouchers", () => {
  it("lists the period's vouchers with their numbers, ledgers and status", async () => {
    mockApi();
    const table = await openVouchers();
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("PAY000002");
    expect(rows[1]).toHaveTextContent("October rent · R-10");
    expect(rows[1]).toHaveTextContent("Dr Rent · Cr Bank");
    expect(rows[1]).toHaveTextContent("Posted");
    expect(within(rows[2]).getByText("Cancelled")).toHaveAttribute("title", "Entered twice — Asha");
    expect(within(rows[2]).queryByRole("button", { name: "Cancel" })).toBeNull(); // already cancelled
    expect(screen.getByTestId("vch-count")).toHaveTextContent("1");
    expect(screen.getByTestId("vch-payments")).toHaveTextContent("₹5,000.00");
    expect(screen.getByTestId("vch-receipts")).toHaveTextContent("₹0.00"); // the cancelled receipt doesn't count
  });

  it("posts an expense paid in cash from the template", async () => {
    mockApi(undefined, { Voucher: () => ({ status: 200, data: { voucherNumber: "PAY000003" } }) });
    await openVouchers();
    fireEvent.click(screen.getByRole("button", { name: "Expense paid" }));
    const form = screen.getByTestId("voucher-form");
    await waitFor(() => expect(within(form).getByRole("option", { name: "Rent" })).toBeInTheDocument());
    expect(within(form).queryByRole("option", { name: "Sales" })).toBeNull(); // posted from bills only
    expect(within(form).queryByRole("option", { name: "Old Head" })).toBeNull(); // switched off
    fireEvent.change(within(form).getByLabelText("Paid for"), { target: { value: "Rent" } });
    fireEvent.change(within(form).getByLabelText("Voucher amount"), { target: { value: "500" } });
    fireEvent.change(within(form).getByLabelText("Voucher narration"), { target: { value: "Shop rent" } });
    fireEvent.click(within(form).getByRole("button", { name: "Post payment" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("PAY000003 posted."));
    expect(body("Voucher")).toMatchObject({ voucherType: "PAYMENT", narration: "Shop rent",
      lines: [{ ledger: "Rent", debit: 500, credit: 0 }, { ledger: "Cash in Hand", debit: 0, credit: 500 }] });
    await waitFor(() => expect(screen.queryByTestId("voucher-form")).toBeNull());
    expect(calls("Vouchers").length).toBeGreaterThan(1); // the list is loaded again
  });

  it("asks before cash in hand goes below zero, and posts only when confirmed", async () => {
    let n = 0;
    mockApi(undefined, { Voucher: () => (++n === 1 ? { status: 409, message: "Cash in hand on 01 Nov 2026 is ₹300.00; this voucher takes it to -₹200.00." } : { status: 200, data: { voucherNumber: "PAY000004" } }) });
    await openVouchers();
    fireEvent.click(screen.getByRole("button", { name: "Expense paid" }));
    const form = screen.getByTestId("voucher-form");
    await waitFor(() => expect(within(form).getByRole("option", { name: "Rent" })).toBeInTheDocument());
    fireEvent.change(within(form).getByLabelText("Paid for"), { target: { value: "Rent" } });
    fireEvent.change(within(form).getByLabelText("Voucher amount"), { target: { value: "500" } });
    fireEvent.click(within(form).getByRole("button", { name: "Post payment" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("PAY000004 posted."));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("takes it to -₹200.00. Post it anyway?"));
    expect(body("Voucher").allowNegativeCash).toBe(true);
  });

  it("a deposit is a contra from cash to bank", async () => {
    mockApi(undefined, { Voucher: () => ({ status: 200, data: { voucherNumber: "CON000001" } }) });
    await openVouchers();
    fireEvent.click(screen.getByRole("button", { name: "Cash deposited in bank" }));
    const form = screen.getByTestId("voucher-form");
    fireEvent.change(within(form).getByLabelText("Voucher amount"), { target: { value: "20000" } });
    fireEvent.click(within(form).getByRole("button", { name: "Post contra" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("CON000001 posted."));
    expect(body("Voucher")).toMatchObject({ voucherType: "CONTRA", narration: "Cash deposited in bank",
      lines: [{ ledger: "Bank", debit: 20000, credit: 0 }, { ledger: "Cash in Hand", debit: 0, credit: 20000 }] });
  });

  it("a journal must balance before it is posted", async () => {
    mockApi(undefined, { Voucher: () => ({ status: 200, data: { voucherNumber: "JRN000001" } }) });
    await openVouchers();
    fireEvent.click(screen.getByRole("button", { name: "+ New voucher" }));
    const form = screen.getByTestId("voucher-form");
    fireEvent.click(within(form).getByRole("button", { name: "Journal" }));
    await waitFor(() => expect(within(form).getAllByRole("option", { name: "Rent" }).length).toBe(2));
    expect(within(form).queryByRole("option", { name: "Cash in Hand" })).toBeNull(); // money goes on receipt / payment / contra
    fireEvent.change(within(form).getByLabelText("Line 1 ledger"), { target: { value: "Rent" } });
    fireEvent.change(within(form).getByLabelText("Line 1 debit"), { target: { value: "1000" } });
    fireEvent.change(within(form).getByLabelText("Line 2 ledger"), { target: { value: "Owner's Capital" } });
    fireEvent.change(within(form).getByLabelText("Line 2 credit"), { target: { value: "900" } });
    expect(screen.getByTestId("journal-status")).toHaveTextContent("Not balanced");
    fireEvent.click(within(form).getByRole("button", { name: "Post journal" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("Debits (₹1,000.00) and credits (₹900.00) must be equal.");
    expect(calls("Voucher")).toHaveLength(0);
    fireEvent.change(within(form).getByLabelText("Line 2 credit"), { target: { value: "1000" } });
    expect(screen.getByTestId("journal-status")).toHaveTextContent("Balanced");
    fireEvent.click(within(form).getByRole("button", { name: "Post journal" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("JRN000001 posted."));
    expect(body("Voucher").lines).toEqual([{ ledger: "Rent", debit: 1000, credit: 0 }, { ledger: "Owner's Capital", debit: 0, credit: 1000 }]);
  });

  it("cancelling needs a reason and posts the reversal", async () => {
    mockApi(undefined, { "Voucher/v2/Cancel": () => ({ status: 200, data: {} }) });
    const table = await openVouchers();
    fireEvent.click(within(table).getByRole("button", { name: "Cancel" }));
    const go = screen.getByRole("button", { name: "Cancel PAY000002" });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason for cancelling"), { target: { value: "Paid twice" } });
    fireEvent.click(go);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("PAY000002 cancelled: its reversal is posted today."));
    expect(body("Voucher/v2/Cancel")).toEqual({ reason: "Paid twice" });
  });

  it("View alone can't post, cancel or post a set-off", async () => {
    mockApi(["View"]);
    const table = await openVouchers();
    expect(screen.queryByRole("button", { name: "+ New voucher" })).toBeNull();
    expect(within(table).queryByRole("button", { name: "Cancel" })).toBeNull();
    await screen.findByTestId("gst-panel");
    expect(screen.queryByRole("button", { name: "Post GST set-off" })).toBeNull();
  });

  it("the GST panel shows the position, posts the set-off and prefills the GST payment", async () => {
    mockApi(undefined, { GstSetOff: () => ({ status: 200, data: { voucherNumber: "JRN000002" } }) });
    await openVouchers();
    const panel = await screen.findByTestId("gst-panel");
    expect(within(panel).getByTestId("gst-output")).toHaveTextContent("₹1,000.00");
    expect(within(panel).getByTestId("gst-input")).toHaveTextContent("₹300.00");
    expect(within(panel).getByTestId("gst-payable")).toHaveTextContent("₹950.00"); // 700 after this set-off + 250 set off earlier
    fireEvent.click(within(panel).getByRole("button", { name: "Post GST set-off" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("JRN000002: GST set off."));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("₹700.00 moves to GST Payable"));
    fireEvent.click(screen.getByRole("button", { name: "Pay ₹250.00 GST" }));
    const form = screen.getByTestId("voucher-form");
    expect(within(form).getByLabelText("Voucher amount")).toHaveValue(250);
    expect(within(form).getByLabelText("Paid from")).toHaveValue("Bank");
    await waitFor(() => expect(within(form).getByLabelText("Paid for")).toHaveValue("GST Payable"));
  });

  it("adds an account head and switches one off", async () => {
    mockApi(undefined, { LedgerHead: () => ({ status: 200, data: { name: "Shop Insurance" } }), "LedgerHead/Disable": () => ({ status: 200, data: {} }) });
    await openVouchers();
    fireEvent.click(screen.getByRole("button", { name: /Account heads/ }));
    const heads = screen.getByTestId("heads");
    await waitFor(() => expect(heads).toHaveTextContent("Rent"));
    fireEvent.change(within(heads).getByLabelText("Head name"), { target: { value: "Shop Insurance" } });
    fireEvent.change(within(heads).getByLabelText("Head group"), { target: { value: "Expense" } });
    fireEvent.click(within(heads).getByRole("button", { name: "Add head" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Shop Insurance added."));
    expect(body("LedgerHead")).toEqual({ name: "Shop Insurance", group: "Expense" });
    fireEvent.click(within(heads).getAllByRole("button", { name: "Switch off" })[0]);
    await waitFor(() => expect(calls("LedgerHead/Disable")).toHaveLength(1));
    expect(within(heads).getByRole("button", { name: "Switch on" })).toBeInTheDocument(); // Old Head
  });
});

describe("Accounting — general ledger and day book", () => {
  it("shows a ledger's opening, entries with a running balance, and closing; another ledger can be chosen", async () => {
    mockApi(undefined, {
      GeneralLedger: (opts) => {
        const { ledger } = JSON.parse(opts.body);
        return { status: 200, data: { ledger, group: ledger === "Rent" ? "Expense" : "Asset", fromDate: "2026-04-01", toDate: "2026-11-01", openingBalance: 20000, totalDebit: 0, totalCredit: 5000, closingBalance: 15000,
          entries: [{ date: "2026-10-31", voucherType: "Contra", reference: "CON000001", narration: "Cash deposited in bank", debit: 0, credit: 5000, balance: 15000 }] } };
      },
    });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "General ledger" }));
    const table = await screen.findByTestId("gl-table");
    expect(body("GeneralLedger")).toMatchObject({ ledger: "Cash in Hand" });
    expect(screen.getByTestId("gl-opening")).toHaveTextContent("₹20,000.00 Dr");
    expect(screen.getByTestId("gl-closing")).toHaveTextContent("₹15,000.00 Dr");
    expect(within(table).getAllByRole("row")[2]).toHaveTextContent("CON000001Cash deposited in bank₹5,000.00₹15,000.00 Dr");
    await waitFor(() => expect(screen.getByRole("option", { name: "Rent" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Ledger"), { target: { value: "Rent" } });
    await waitFor(() => expect(body("GeneralLedger")).toMatchObject({ ledger: "Rent" }));
    expect(await screen.findByText("From the start of the financial year")).toBeInTheDocument();
  });

  it("the day book shows each voucher with its debit and credit lines", async () => {
    mockApi(undefined, { DayBook: () => ({ status: 200, data: { totalDebit: 1180, totalCredit: 1180, entries: [
      { voucherType: "Sales", reference: "INV1", date: "2026-11-01", narration: "Sales invoice · Walk-in customer",
        lines: [{ ledger: "Accounts Receivable", debit: 1180, credit: 0 }, { ledger: "Sales", debit: 0, credit: 1000 }, { ledger: "Output GST", debit: 0, credit: 180 }, { ledger: "Round Off", debit: 0, credit: 0 }] }] } }) });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Day book" }));
    const table = await screen.findByTestId("db-table");
    expect(screen.getByTestId("db-count")).toHaveTextContent("1");
    expect(table).toHaveTextContent("INV1");
    expect(table).toHaveTextContent("To Sales₹1,000.00");
    expect(table).not.toHaveTextContent("Round Off"); // a line of nothing is left out
  });
});

describe("Accounting — cash count", () => {
  it("counts the drawer against the cash book and posts a shortage with its reason", async () => {
    mockApi(undefined, {
      CashBook: () => ({ status: 200, data: { book: "Cash Book", openingBalance: 0, closingBalance: 1000, entries: [] } }),
      Voucher: () => ({ status: 200, data: { voucherNumber: "PAY000009" } }),
    });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Cash book" }));
    const count = await screen.findByTestId("cash-count");
    fireEvent.change(within(count).getByLabelText("Cash counted"), { target: { value: "950" } });
    expect(screen.getByTestId("cash-diff")).toHaveTextContent("Short ₹50.00");
    fireEvent.change(within(count).getByLabelText("Reason for the difference"), { target: { value: "Change given wrong" } });
    fireEvent.click(within(count).getByRole("button", { name: "Post shortage" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("PAY000009: cash shortage posted."));
    expect(body("Voucher")).toMatchObject({ voucherType: "PAYMENT", allowNegativeCash: true, narration: "Cash short on count · Change given wrong",
      lines: [{ ledger: "Cash Short / Excess", debit: 50, credit: 0 }, { ledger: "Cash in Hand", debit: 0, credit: 50 }] });
    fireEvent.change(within(count).getByLabelText("Cash counted"), { target: { value: "1000" } });
    expect(screen.getByTestId("cash-diff")).toHaveTextContent("Matches the book");
  });

  it("isn't offered without the Add permission", async () => {
    mockApi(["View"], { CashBook: () => ({ status: 200, data: { book: "Cash Book", openingBalance: 0, closingBalance: 1000, entries: [] } }) });
    render(<Accounting />);
    fireEvent.click(screen.getByRole("tab", { name: "Cash book" }));
    await screen.findByTestId("book-closing");
    expect(screen.queryByTestId("cash-count")).toBeNull();
  });
});
