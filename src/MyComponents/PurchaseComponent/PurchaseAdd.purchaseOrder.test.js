import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const jsonResponse = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

function mockApis() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return jsonResponse({ status: 200, data: [{ id: 7, shopName: "Sunrise Distributors", supplierCode: "SUP0007" }] });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: [{ id: 101, name: "Paracetamol 500mg", price: 12.5, costPrice: 12.5 }] });
    if (url.includes("/api/PurchaseOrder/AddPurchaseOrder")) return jsonResponse({ status: 200, data: {} });
    return jsonResponse({ status: 200, data: null });
  });
}

const tabButton = (name) => screen.getByRole("button", { name: new RegExp(name, "i") });

/* Purchase orders are created on PurchaseAdd in documentMode (PurchaseOrderComponent/PurchaseOrder.js). These replace the
   old OperationsGrid form tests, which drove a generic order form that no longer exists. */
describe("PurchaseAdd — purchase order mode", () => {
  beforeEach(() => jest.clearAllMocks());

  it("says it is a purchase order, not a purchase entry", async () => {
    mockApis();
    render(<PurchaseAdd documentMode onSubmit={() => {}} onClose={() => {}} />);
    expect(await screen.findByText("Create Purchase Order")).toBeInTheDocument();
    expect(screen.queryByText("Create Purchase Entry")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Purchase Order" })).toBeInTheDocument();
  });

  it("submits the order to AddPurchaseOrder with the supplier, item cost, tax and batch details", async () => {
    mockApis();
    const onSubmit = jest.fn();
    const { container } = render(<PurchaseAdd documentMode onSubmit={onSubmit} onClose={() => {}} />);

    fireEvent.click(screen.getByText("Search supplier…"));
    fireEvent.mouseDown(await screen.findByText("Sunrise Distributors"));
    fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "SINV-200" } });
    const [invoiceDateInput, dueDateInput] = container.querySelectorAll('input[type="date"]'); // eslint-disable-line testing-library/no-node-access, testing-library/no-container
    fireEvent.change(invoiceDateInput, { target: { value: "2026-09-01" } });
    fireEvent.change(dueDateInput, { target: { value: "2026-10-01" } }); // default status is CREDIT

    fireEvent.click(tabButton("items"));
    fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
    fireEvent.click(screen.getByText("Select product"));
    fireEvent.mouseDown(await screen.findByText("Paracetamol 500mg")); // auto-fills cost/mrp
    const expiry = [...container.querySelectorAll(".afx-item-field")] // eslint-disable-line testing-library/no-node-access, testing-library/no-container
      .find(el => el.querySelector(".afx-item-field-label").textContent.startsWith("Expiry Date")); // eslint-disable-line testing-library/no-node-access
    fireEvent.change(expiry.querySelector("input"), { target: { value: "2027-01-01" } }); // eslint-disable-line testing-library/no-node-access
    fireEvent.change(screen.getByPlaceholderText("Blank = automatic"), { target: { value: "BCH-7" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase Order" }));

    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/PurchaseOrder/AddPurchaseOrder"))).toBe(true));
    const body = JSON.parse(apiClient.mock.calls.find(([u]) => u.includes("/api/PurchaseOrder/AddPurchaseOrder"))[1].body);
    expect(body).toMatchObject({
      supplierId: 7, supplierInvoiceNumber: "SINV-200", invoiceDate: "2026-09-01", paymentStatus: "CREDIT", dueDate: "2026-10-01",
      items: [{ productId: 101, quantity: 1, unitCost: 12.5, gstRate: 0, batchNumber: "BCH-7", expiryDate: "2027-01-01" }],
    });
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Purchase/CreatePurchase"))).toBe(false);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("a first Save with details missing jumps to the Details tab straight away", async () => {
    // regression: the tab choice read the previous render's (empty) errors, so the first failed Save stayed on Items
    mockApis();
    render(<PurchaseAdd documentMode onSubmit={() => {}} onClose={() => {}} />);
    await screen.findByText("Create Purchase Order");

    fireEvent.click(tabButton("items"));
    expect(tabButton("items")).toHaveClass("is-active");

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase Order" }));

    await waitFor(() => expect(tabButton("details")).toHaveClass("is-active"));
    expect(screen.getByText("Supplier is required")).toBeInTheDocument();
  });
});
