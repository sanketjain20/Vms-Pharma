import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
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
    if (url.includes("/api/Purchase/CreatePurchase")) return json({ status: 200, data: {} });
    return json({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

async function fill(container, status) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Fabric House"));
  fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "FH-30" } });
  fireEvent.change(screen.getByDisplayValue("Credit (Pay Later)"), { target: { value: status } });
  const [invoiceDate, dueDate] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(invoiceDate, { target: { value: "2026-11-01" } });
  if (dueDate) fireEvent.change(dueDate, { target: { value: "2026-11-30" } });
}

async function addItemAndSave(container) {
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Cotton kurta"));
  fireEvent.change(container.querySelector('.afx-item-card input[type="number"]'), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
  await waitFor(() => expect(call("/api/Purchase/CreatePurchase")).toBeTruthy());
  return JSON.parse(call("/api/Purchase/CreatePurchase")[1].body);
}

describe("Purchase — how a purchase paid when saved was paid", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); mockApis(); });

  it("asks 'Paid by' for a paid purchase and sends it, so the books take the money out of cash or bank", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    await fill(container, "PAID");
    const paidBy = screen.getByLabelText("Paid by");
    expect(paidBy).toHaveValue("BANK"); // the usual way a supplier is paid
    fireEvent.change(paidBy, { target: { value: "CASH" } });
    const body = await addItemAndSave(container);
    expect(body).toMatchObject({ paymentStatus: "PAID", paymentMode: "CASH" });
  });

  it("doesn't ask on a credit purchase (nothing is paid yet)", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(call("/api/BusinessSetting/Get")).toBeTruthy());
    await fill(container, "CREDIT");
    expect(screen.queryByLabelText("Paid by")).toBeNull();
  });
});
