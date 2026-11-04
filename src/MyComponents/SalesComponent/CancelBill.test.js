import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Sales, { SALES_COLUMNS } from "./Sales";
import CancelBillModal from "./CancelBillModal";
import SalesView from "./SalesView";
import { withCancelledSnapshot, cancelledWhen } from "./cancelledBill";
import { cardStatus } from "../CommonComponent/DynamicGrid";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../Config/api.config", () => ({ __esModule: true, default: "http://api" }));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body, status = 200) => Promise.resolve({ ok: status === 200, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const BILL = { id: 9, uKey: "s9", invoiceNumber: "INV00009", billedTo: "Walk-in", netAmount: 1180, remainingAmount: 0, statusId: 1, createdAt: "2026-10-30" };
const CANCELLED = { ...BILL, id: 8, uKey: "s8", invoiceNumber: "INV00008", netAmount: 0, cancelled: true };

function mockGrid(actions) {
  apiClient.mockImplementation((url, opts) => {
    if (url.includes("/api/Access/GetUserModuleAccess/5/")) return ok({ status: 200, data: actions });
    if (url.includes("/api/Sales/GetAllSales")) return ok({ status: 200, data: { content: [BILL, CANCELLED], totalElements: 2, totalPages: 1 } });
    if (url.includes("/api/Sales/CancelSale/")) return ok({ status: 200, message: "Bill INV00009 cancelled. Stock is back.", data: {} });
    return ok({ status: 200, data: null });
  });
}

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

describe("Sales list — cancelling a bill", () => {
  it("offers Cancel bill on a live bill for a role with the permission; a cancelled bill is marked and only viewable", async () => {
    mockGrid(["View", "Edit", "Download", "Cancel Bill"]);
    render(<Sales />);
    const live = (await screen.findByText("INV00009")).closest("tr");
    await waitFor(() => expect(within(live).getByRole("button", { name: "Cancel bill" })).toBeInTheDocument());
    const dead = screen.getByText("INV00008 · Cancelled").closest("tr");
    expect(within(dead).queryByRole("button", { name: "Cancel bill" })).toBeNull();
    expect(within(dead).queryByTitle("Edit")).toBeNull();
    expect(within(dead).queryByTitle("Download")).toBeNull();
    expect(within(dead).getByTitle("View")).toBeInTheDocument();
  });

  it("without the permission there is no Cancel bill", async () => {
    mockGrid(["View", "Edit"]);
    render(<Sales />);
    const live = (await screen.findByText("INV00009")).closest("tr");
    await waitFor(() => expect(within(live).getByTitle("Edit")).toBeInTheDocument());
    expect(within(live).queryByRole("button", { name: "Cancel bill" })).toBeNull();
  });

  it("asks for a reason, sends it, and refreshes the list", async () => {
    mockGrid(["View", "Cancel Bill"]);
    const refreshed = jest.fn();
    window.addEventListener("document-grid-refresh", refreshed);
    render(<Sales />);
    const live = (await screen.findByText("INV00009")).closest("tr");
    fireEvent.click(await within(live).findByRole("button", { name: "Cancel bill" }));

    const dialog = screen.getByRole("dialog", { name: "Cancel bill" });
    expect(within(dialog).getByTestId("cancel-effects")).toHaveTextContent("keeps its number and becomes ₹0");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel bill" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Give a reason");
    expect(apiClient.mock.calls.some(([u]) => u.includes("CancelSale"))).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: " Billed twice " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel bill" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Bill INV00009 cancelled. Stock is back."));
    const [url, opts] = apiClient.mock.calls.find(([u]) => u.includes("CancelSale"));
    expect(url).toBe("http://api/api/Sales/CancelSale/s9");
    expect(JSON.parse(opts.body)).toEqual({ reason: "Billed twice" });
    expect(refreshed).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Cancel bill" })).toBeNull();
    window.removeEventListener("document-grid-refresh", refreshed);
  });

  it("shows the server's reason when it refuses (e.g. older than 24 hours) and stays open", async () => {
    apiClient.mockImplementation(() => ok({ status: 400, message: "A bill can be cancelled only within 24 hours." }, 400));
    const onClose = jest.fn();
    render(<CancelBillModal bill={BILL} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel bill" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("only within 24 hours");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("the list column and the card say Cancelled", () => {
    const inv = SALES_COLUMNS.find((c) => c.field === "invoiceNumber");
    expect(inv.format("INV1", { cancelled: true })).toBe("INV1 · Cancelled");
    expect(inv.format("INV1", {})).toBe("INV1");
    expect(cardStatus({ cancelled: true, statusId: 1 }, "Sales")).toEqual({ label: "Cancelled", color: "red" });
  });
});

describe("Sales View — a cancelled bill", () => {
  const snapshot = { invoiceNumber: "INV00009", netAmount: 1180, totalAmount: 1000, totalTax: 180, remainingAmount: 0,
    items: [{ id: 1, product: "Shirt", quantity: 4, sellingPrice: 250, taxAmount: 180 }] };
  const sale = { uKey: "s9", invoiceNumber: "INV00009", netAmount: 0, items: [], cancelled: true,
    cancelledAt: "2026-10-30T14:05:00", cancelledByName: "Asha", cancelReason: "Billed twice", cancelledSnapshot: JSON.stringify(snapshot) };

  it("shows what the bill held, from the snapshot", () => {
    const shown = withCancelledSnapshot(sale);
    expect(shown.netAmount).toBe(1180);
    expect(shown.items).toHaveLength(1);
    expect(shown.cancelled).toBe(true);
    expect(shown.cancelReason).toBe("Billed twice");
    expect(withCancelledSnapshot({ ...sale, cancelledSnapshot: "{bad" }).netAmount).toBe(0);
    expect(withCancelledSnapshot(BILL)).toBe(BILL);
    expect(cancelledWhen("2026-10-30T14:05:00")).toBe("30-10-2026 14:05");
  });

  it("is marked Cancelled with who, when and why, and offers no print, e-invoice or message buttons", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ status: 200, data: sale });
      return ok({ status: 200, data: null });
    });
    render(<SalesView uKey="s9" onClose={jest.fn()} />);
    expect(await screen.findByTestId("bill-cancelled")).toHaveTextContent("Cancelled on 30-10-2026 14:05 by Asha — Billed twice.");
    expect(screen.getByText("Shirt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Print Invoice/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /WhatsApp/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Generate/ })).toBeNull();
  });
});
