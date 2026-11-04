import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Sales from "./Sales";
import CollectBalanceModal from "./CollectBalanceModal";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const WALK_IN = { id: 11, uKey: "s11", invoiceNumber: "INV00011", billedTo: "Ravi", netAmount: 118, amountPaid: 50, remainingAmount: 68, createdAt: "2026-10-31" };
const RETAILER = { id: 12, uKey: "s12", invoiceNumber: "INV00012", billedTo: "Shop Five", retailerId: 5, retailerName: "Shop Five", netAmount: 500, amountPaid: 100, remainingAmount: 400, createdAt: "2026-10-31" };
const PAID = { id: 13, uKey: "s13", invoiceNumber: "INV00013", billedTo: "Walk-in", netAmount: 118, amountPaid: 118, remainingAmount: 0, createdAt: "2026-10-31" };
const CANCELLED = { ...WALK_IN, id: 14, uKey: "s14", invoiceNumber: "INV00014", cancelled: true, netAmount: 0 };

const collectCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/CollectPayment"));
const query = () => new URL(collectCall()[0]).searchParams;

function mockGrid(actions, collect = { status: 200, message: "Rs 68.00 collected by UPI. The bill is fully paid." }) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Access/GetUserModuleAccess/5/")) return ok({ status: 200, data: actions });
    if (url.includes("/api/Sales/GetAllSales")) return ok({ status: 200, data: { content: [WALK_IN, RETAILER, PAID, CANCELLED], totalElements: 4, totalPages: 1 } });
    if (url.includes("/api/Sales/CollectPayment")) return ok(collect);
    return ok({ status: 200, data: null });
  });
}

const rowOf = async (invoice) => (await screen.findByText(invoice)).closest("tr");

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("Sales list — Collect balance", () => {
  it("shows on every bill with money due, walk-in or retailer, and on no paid or cancelled bill", async () => {
    mockGrid(["View", "Edit", "Cancel Bill"]);
    render(<Sales />);
    const walkIn = await rowOf("INV00011");
    await waitFor(() => expect(within(walkIn).getByRole("button", { name: "Collect balance" })).toBeInTheDocument());
    expect(within(await rowOf("INV00012")).getByRole("button", { name: "Collect balance" })).toBeInTheDocument();
    expect(within(await rowOf("INV00013")).queryByRole("button", { name: "Collect balance" })).toBeNull();
    expect(within(screen.getByText("INV00014 · Cancelled").closest("tr")).queryByRole("button", { name: "Collect balance" })).toBeNull();
  });

  it("comes before Cancel bill, which stays the last action", async () => {
    mockGrid(["View", "Edit", "Cancel Bill"]);
    render(<Sales />);
    const walkIn = await rowOf("INV00011");
    await waitFor(() => expect(within(walkIn).getByRole("button", { name: "Cancel bill" })).toBeInTheDocument());
    const titles = within(walkIn).getAllByRole("button").map((b) => b.getAttribute("title"));
    expect(titles.slice(-2)).toEqual(["Collect balance", "Cancel bill"]);
  });

  it("needs the Sales Edit permission", async () => {
    mockGrid(["View"]);
    render(<Sales />);
    const walkIn = await rowOf("INV00011");
    await waitFor(() => expect(within(walkIn).getByTitle("View")).toBeInTheDocument());
    expect(within(walkIn).queryByRole("button", { name: "Collect balance" })).toBeNull();
  });

  it("a walk-in's balance by UPI with a reference: sent, confirmed and the list refreshed", async () => {
    mockGrid(["View", "Edit"]);
    const refreshed = jest.fn();
    window.addEventListener("document-grid-refresh", refreshed);
    render(<Sales />);
    fireEvent.click(await within(await rowOf("INV00011")).findByRole("button", { name: "Collect balance" }));

    const dialog = screen.getByRole("dialog", { name: "Collect balance" });
    expect(within(dialog).getByTestId("collect-summary")).toHaveTextContent("Bill ₹118.00Paid ₹50.00Due ₹68.00");
    expect(within(dialog).getByTestId("collect-where")).toHaveTextContent("Recorded on the bill as a payment received today");
    expect(within(dialog).getByLabelText(/Amount received/)).toHaveValue(68);
    expect(within(dialog).queryByLabelText(/Ref \/ txn no/)).toBeNull(); // cash needs none
    fireEvent.change(within(dialog).getByLabelText("Mode"), { target: { value: "UPI" } });
    fireEvent.change(within(dialog).getByLabelText(/Ref \/ txn no/), { target: { value: " UPI-42 " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Collect ₹68.00" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Rs 68.00 collected by UPI. The bill is fully paid."));
    expect(collectCall()[1]).toEqual({ method: "POST" });
    expect(Object.fromEntries(query())).toEqual({ salesId: "11", paymentAmount: "68.00", paymentMode: "UPI", reference: "UPI-42" });
    expect(refreshed).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Collect balance" })).toBeNull();
    window.removeEventListener("document-grid-refresh", refreshed);
  });

  it("a retailer's part payment says it goes into their ledger", async () => {
    mockGrid(["View", "Edit"], { status: 200, message: "Rs 150.00 collected by Cash. Rs 250.00 is still due." });
    render(<Sales />);
    fireEvent.click(await within(await rowOf("INV00012")).findByRole("button", { name: "Collect balance" }));
    const dialog = screen.getByRole("dialog", { name: "Collect balance" });
    expect(within(dialog).getByTestId("collect-where")).toHaveTextContent("Goes into Shop Five's ledger: their outstanding comes down");
    fireEvent.change(within(dialog).getByLabelText(/Amount received/), { target: { value: "150" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Collect ₹150.00" }));
    await waitFor(() => expect(collectCall()).toBeTruthy());
    expect(Object.fromEntries(query())).toEqual({ salesId: "12", paymentAmount: "150.00", paymentMode: "CASH" });
  });
});

describe("CollectBalanceModal — checks before sending", () => {
  const show = () => render(<CollectBalanceModal bill={WALK_IN} onClose={jest.fn()} />);

  it("refuses more than is due, or nothing", async () => {
    show();
    fireEvent.change(screen.getByLabelText(/Amount received/), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Collect ₹70.00" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Only ₹68.00 is due on this bill.");
    fireEvent.change(screen.getByLabelText(/Amount received/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Collect ₹0.00" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter the amount received.");
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("shows the server's reason and stays open", async () => {
    apiClient.mockImplementation(() => ok({ status: 403, message: "You can't collect payments on bills. Ask someone whose role can edit Sales." }));
    const onClose = jest.fn();
    render(<CollectBalanceModal bill={WALK_IN} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Collect ₹68.00" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ask someone whose role can edit Sales.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
