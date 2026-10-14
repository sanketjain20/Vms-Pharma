import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

const supplierDropdown = [{ id: 7, shopName: "Sunrise Distributors", supplierCode: "SUP0007" }];
const productList = [{ id: 101, name: "Paracetamol 500mg", price: 12.5 }];

function mockApis() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return jsonResponse({ status: 200, data: supplierDropdown });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
    if (url.includes("/api/Purchase/CreatePurchase")) return jsonResponse({ status: 200, data: {} });
    return jsonResponse({ status: 200, data: null });
  });
}

/**
 * Regression coverage for the item-row UI rebuild: each line item used to be
 * a bare 9-column grid with a single header row above it — values had no
 * label of their own, so a narrow modal squeezed the columns until values
 * lined up with the wrong header (or wrapped unreadably). Each field now
 * carries its own label, and Batch No (previously tracked in state but with
 * no input to fill it) is wired up so it's actually capturable and submitted.
 */
describe("PurchaseAdd — item row layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("labels every line-item field so values can't be read against the wrong header", async () => {
    mockApis();
    const { container } = render(<PurchaseAdd onSubmit={() => {}} onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: /items/i }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));

    const labelTexts = [...container.querySelectorAll(".afx-item-field-label")].map(el => el.textContent);
    for (const label of ["Batch No", "MFG Date", "Expiry Date*", "Qty*", "Cost (₹)*", "MRP (₹)*", "GST %"]) {
      expect(labelTexts).toContain(label);
    }
  });

  it("submits the entered batch number with the rest of the item", async () => {
    mockApis();
    const { container } = render(<PurchaseAdd onSubmit={() => {}} onClose={() => {}} />);

    // ── Details tab ──
    fireEvent.click(screen.getByText("Search supplier…"));
    fireEvent.mouseDown(await screen.findByText("Sunrise Distributors"));
    fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "SINV-200" } });
    const [invoiceDateInput, dueDateInput] = container.querySelectorAll('input[type="date"]');
    fireEvent.change(invoiceDateInput, { target: { value: "2026-09-01" } });
    fireEvent.change(dueDateInput, { target: { value: "2026-10-01" } }); // default status is CREDIT

    // ── Items tab ──
    fireEvent.click(screen.getByRole("button", { name: /items/i }));
    fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));

    fireEvent.click(screen.getByText("Select product"));
    fireEvent.mouseDown(await screen.findByText("Paracetamol 500mg")); // auto-fills cost/mrp

    const expiryField = [...container.querySelectorAll(".afx-item-field")]
      .find(el => el.querySelector(".afx-item-field-label").textContent.startsWith("Expiry Date"));
    fireEvent.change(expiryField.querySelector("input"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByPlaceholderText("Optional"), { target: { value: "BCH-0099" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));

    await waitFor(() => {
      const createCall = apiClient.mock.calls.find(([url]) => url.includes("/api/Purchase/CreatePurchase"));
      expect(createCall).toBeDefined();
      const body = JSON.parse(createCall[1].body);
      expect(body.items[0].batchNumber).toBe("BCH-0099");
      expect(body.items[0].costPrice).toBe(12.5); // sanity: real submit went through, not a validation dead-end
    });
  });
});
