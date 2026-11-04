import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import PurchaseView from "./PurchaseView";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

function mockApis(profile) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return json({ status: 200, data: [{ id: 7, shopName: "Fabric House", supplierCode: "SUP7" }] });
    if (url.includes("/api/Product/GetAllProduct")) return json({ status: 200, data: [{ id: 101, name: "Cotton kurta (M)", price: 450, costPrice: 450 }] });
    if (url.includes("/api/Purchase/CreatePurchase")) return json({ status: 200, data: {} });
    if (url.includes("/api/Purchase/GetPurchaseByUKey") || url.includes("/api/Purchase/")) {
      return json({ status: 200, data: { purchaseNumber: "PUR1", items: [{ productName: "Cotton kurta (M)", batchNumber: "BCH1", quantity: 5, costPrice: 450, mrp: 799, gstRate: 5 }] } });
    }
    return json({ status: 200, data: null });
  });
}

const CLOTHING = { businessType: "CLOTHING", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };

async function fillAndOpenItems(container) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Fabric House"));
  fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "FH-10" } });
  const [invoiceDate, dueDate] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(invoiceDate, { target: { value: "2026-10-01" } });
  fireEvent.change(dueDate, { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Cotton kurta (M)"));
}

const labels = (container) => [...container.querySelectorAll(".afx-item-field-label")].map((el) => el.textContent);
const createCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Purchase/CreatePurchase"));

describe("Purchase — a shop that does not track expiry (Phase 4)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("a cloth shop sees no batch / MFG / expiry and saves without them", async () => {
    mockApis(CLOTHING);
    const { container } = render(<PurchaseAdd onSubmit={() => {}} onClose={() => {}} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Get"))).toBe(true));
    await fillAndOpenItems(container);

    await waitFor(() => expect(labels(container)).not.toContain("MFG Date"));
    expect(labels(container)).not.toContain("Expiry Date*");
    expect(labels(container)).not.toContain("Batch No");
    expect(labels(container)).toContain("Qty*");

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(createCall()[1].body).items[0].expiryDate).toBeNull();
  });

  it("a pharmacy still has to give the expiry date", async () => {
    mockApis(PHARMA);
    const { container } = render(<PurchaseAdd onSubmit={() => {}} onClose={() => {}} />);
    await fillAndOpenItems(container);

    expect(labels(container)).toContain("Expiry Date*");
    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(createCall()).toBeUndefined();
  });

  it("the purchase view drops the MFG and expiry columns for a cloth shop", async () => {
    mockApis(CLOTHING);
    render(<PurchaseView uKey="p1" onClose={() => {}} onEdit={() => {}} />);
    expect(await screen.findByText("Cotton kurta (M)")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Expiry")).not.toBeInTheDocument());
    expect(screen.queryByText("MFG Date")).not.toBeInTheDocument();
  });
});
