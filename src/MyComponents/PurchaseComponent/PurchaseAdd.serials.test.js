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
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: { businessType: "ELECTRONICS", trackExpiry: false, isPharma: false } });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return json({ status: 200, data: [{ id: 7, shopName: "Gadget Hub", supplierCode: "SUP7" }] });
    if (url.includes("/api/Product/GetAllProduct")) return json({ status: 200, data: [{ id: 101, name: "Phone X", price: 12000, costPrice: 9000, trackSerial: true }] });
    if (url.includes("/api/Purchase/CreatePurchase")) return json({ status: 200, data: {} });
    if (url.includes("/api/Purchase/GetPurchaseByUKey")) {
      return json({ status: 200, data: { purchaseNumber: "PUR1", items: [{ productName: "Phone X", batchNumber: "BCH1", quantity: 2, costPrice: 9000, mrp: 12000, gstRate: 18, serials: ["IMEI1", "IMEI2"] }] } });
    }
    return json({ status: 200, data: null });
  });
}
const createCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Purchase/CreatePurchase"));

async function lineOf(qty, container) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Gadget Hub"));
  fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "GH-1" } });
  const [invoiceDate, dueDate] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(invoiceDate, { target: { value: "2026-10-01" } });
  fireEvent.change(dueDate, { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Phone X"));
  fireEvent.change(container.querySelector('.afx-item-card input[type="number"]'), { target: { value: qty } });
}

describe("Purchase — a product with serial numbers (Phase 6)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); mockApis(); });

  it("asks one serial per unit received (paid + free) and sends them", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Get"))).toBe(true));
    await lineOf("2", container);
    fireEvent.change(screen.getByLabelText("Free quantity"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Serial numbers"), { target: { value: "imei1\nimei2" } });
    expect(screen.getByTestId("serial-count")).toHaveTextContent("2 of 3 serial numbers entered");

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(screen.getAllByText("2 of 3 serial numbers entered").length).toBeGreaterThan(1)); // also the line's error
    expect(createCall()).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Serial numbers"), { target: { value: "imei1\nimei2\nimei3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(createCall()[1].body).items[0]).toMatchObject({ quantity: 2, freeQuantity: 1, serials: ["IMEI1", "IMEI2", "IMEI3"] });
  });

  it("the purchase view lists the serials received", async () => {
    render(<PurchaseView uKey="p1" onClose={jest.fn()} />);
    expect(await screen.findByTestId("serial-list")).toHaveTextContent("S/N: IMEI1, IMEI2");
  });
});
