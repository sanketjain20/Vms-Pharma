import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";
import { resetSupplierSchemeCache } from "../../utils/supplierSchemes";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

function mockApis() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: { businessType: "CLOTHING", trackExpiry: false, isPharma: false } });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return json({ status: 200, data: [{ id: 7, shopName: "Gadget Hub", supplierCode: "SUP7" }] });
    if (url.includes("/api/Product/GetAllProduct")) return json({ status: 200, data: [{ id: 101, name: "Cotton kurta", price: 120, costPrice: 90 }] });
    if (url.includes("/api/SupplierScheme/Applicable")) {
      const qty = Number(new URL(url, "http://x").searchParams.get("quantity"));
      return json({ status: 200, data: { label: "Buy 10 Get 1", buyQuantity: 10, freeQuantity: 1, freeForQuantity: Math.floor(qty / 10) } });
    }
    return json({ status: 200, data: null });
  });
}

async function lineOf(qty, container) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Gadget Hub"));
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
  fireEvent.click(screen.getByRole("button", { name: "+ Add First Item" }));
  fireEvent.click(screen.getByText("Select product"));
  fireEvent.mouseDown(await screen.findByText("Cotton kurta"));
  fireEvent.change(container.querySelector('.afx-item-card input[type="number"]'), { target: { value: qty } });
}

describe("Purchase — the supplier's free-goods scheme fills Free (Phase 7)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); resetSupplierSchemeCache(); mockApis(); });

  it("buying 25 under 'buy 10 get 1' fills 2 free and names the scheme; the cost prefill is the average cost", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await lineOf("25", container);
    await waitFor(() => expect(screen.getByLabelText("Free quantity")).toHaveValue(2));
    expect(screen.getByTestId("supplier-scheme")).toHaveTextContent("Supplier scheme Buy 10 Get 1");
    const asked = apiClient.mock.calls.map(([u]) => u).find((u) => u.includes("/api/SupplierScheme/Applicable"));
    expect(asked).toContain("supplierId=7");
    expect(asked).toContain("productId=101");
  });

  it("a Free typed by hand is kept", async () => {
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await lineOf("25", container);
    await waitFor(() => expect(screen.getByLabelText("Free quantity")).toHaveValue(2));
    fireEvent.change(screen.getByLabelText("Free quantity"), { target: { value: "5" } });
    fireEvent.change(container.querySelector('.afx-item-card input[type="number"]'), { target: { value: "40" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByLabelText("Free quantity")).toHaveValue(5);
    expect(screen.queryByTestId("supplier-scheme")).not.toBeInTheDocument();
  });
});
