import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import PurchaseView from "./PurchaseView";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

function mockApis() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: { businessType: "CLOTHING", trackExpiry: false, isPharma: false } });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return json({ status: 200, data: [{ id: 7, shopName: "Fabric House", supplierCode: "SUP7" }] });
    if (url.includes("/api/Product/GetAllProduct")) return json({ status: 200, data: [{ id: 101, name: "Cotton kurta", price: 120, costPrice: 90 }] });
    if (url.includes("/api/Purchase/CreatePurchase") || url.includes("/api/PurchaseOrder/AddPurchaseOrder")) return json({ status: 200, data: {} });
    if (url.includes("/api/Purchase/GetPurchaseByUKey")) {
      return json({ status: 200, data: { purchaseNumber: "PUR1", items: [
        { productName: "Cotton kurta", batchNumber: "BCH1", quantity: 100, freeQuantity: 10, costPrice: 90, effectiveCost: 81.82, mrp: 120, gstRate: 0 },
        { productName: "Belt", batchNumber: "BCH2", quantity: 5, freeQuantity: 0, costPrice: 200, effectiveCost: 200, mrp: 300, gstRate: 0 },
      ] } });
    }
    return json({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

async function fillTo100(container) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Fabric House"));
  fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "FH-21" } });
  const [invoiceDate, dueDate] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(invoiceDate, { target: { value: "2026-10-01" } });
  fireEvent.change(dueDate, { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Cotton kurta"));
  const qty = container.querySelector('.afx-item-card input[type="number"]');
  fireEvent.change(qty, { target: { value: "100" } });
}

describe("Purchase — free goods from the supplier", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); mockApis(); });

  it("takes a free quantity, shows the real unit cost, and bills only the paid quantity", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    await fillTo100(container);

    fireEvent.change(screen.getByLabelText("Free quantity"), { target: { value: "10" } });
    expect(screen.getByTestId("free-note")).toHaveTextContent("+ 10 free · 110 into stock at ₹81.82 each");
    expect(screen.getAllByText("₹9000.00").length).toBeGreaterThan(0); // the line total stays 100 × 90

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(call("/api/Purchase/CreatePurchase")).toBeTruthy());
    expect(JSON.parse(call("/api/Purchase/CreatePurchase")[1].body).items[0]).toMatchObject({ quantity: 100, freeQuantity: 10, costPrice: 90 });
  });

  it("refuses a negative free quantity", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillTo100(container);
    fireEvent.change(screen.getByLabelText("Free quantity"), { target: { value: "-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    expect(await screen.findByText("Can't be negative")).toBeInTheDocument();
    expect(call("/api/Purchase/CreatePurchase")).toBeUndefined();
  });

  it("sends no free quantity when left empty", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillTo100(container);
    expect(screen.queryByTestId("free-note")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(call("/api/Purchase/CreatePurchase")).toBeTruthy());
    expect(JSON.parse(call("/api/Purchase/CreatePurchase")[1].body).items[0].freeQuantity).toBe(0);
  });

  it("a purchase order has no free column (orders don't carry free goods yet)", async () => {
    render(<PurchaseAdd documentMode onSubmit={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /items/i }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
    expect(screen.queryByLabelText("Free quantity")).not.toBeInTheDocument();
  });

  it("the purchase view shows the free goods and the real unit cost", async () => {
    render(<PurchaseView uKey="p1" onClose={jest.fn()} />);
    expect(await screen.findByTestId("free-qty")).toHaveTextContent("+ 10 free");
    expect(screen.getByText(/81\.82/)).toHaveTextContent("₹81.82 / unit in stock");
    expect(screen.getAllByTestId("free-qty")).toHaveLength(1); // the belt had none
  });
});
