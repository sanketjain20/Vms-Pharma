import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import PurchaseAdd from "./PurchaseAdd";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const variant = (id, size, color, price = 599) => ({
  id, name: `Cotton Kurta - ${size} / ${color}`, price, styleId: 7, styleName: "Cotton Kurta", variantSize: size, variantColor: color,
});

function mockApis(profile) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/BusinessSetting/Get")) return json({ status: 200, data: profile });
    if (url.includes("/api/Supplier/GetSupplierDropdown")) return json({ status: 200, data: [{ id: 7, shopName: "Fabric House", supplierCode: "SUP7" }] });
    if (url.includes("/api/Product/GetAllProduct")) {
      return json({ status: 200, data: { products: [
        { id: 50, name: "Leather Belt", price: 300 },
        variant(101, "S", "Blue"), variant(102, "M", "Blue", 649), variant(103, "S", "Black"),
      ] } });
    }
    if (url.includes("/api/Purchase/CreatePurchase")) return json({ status: 200, data: {} });
    return json({ status: 200, data: null });
  });
}

const CLOTHING = { businessType: "CLOTHING", trackExpiry: false, isPharma: false };
const PHARMA = { businessType: "PHARMA", trackExpiry: true, isPharma: true };
const createCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Purchase/CreatePurchase"));

async function fillDetails(container) {
  fireEvent.click(screen.getByText("Search supplier…"));
  fireEvent.mouseDown(await screen.findByText("Fabric House"));
  fireEvent.change(screen.getByPlaceholderText("e.g. INV-2024-001"), { target: { value: "FH-11" } });
  const [invoiceDate, dueDate] = container.querySelectorAll('input[type="date"]');
  fireEvent.change(invoiceDate, { target: { value: "2026-10-01" } });
  fireEvent.change(dueDate, { target: { value: "2026-11-01" } });
  fireEvent.click(screen.getByRole("button", { name: /items/i }));
}

describe("Purchase entry — buying a style by size and colour (Phase 5)", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("a pharmacy has no size & colour grid", async () => {
    mockApis(PHARMA);
    render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/BusinessSetting/Get"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /items/i }));
    expect(screen.queryByTestId("open-variant-grid")).not.toBeInTheDocument();
  });

  it("a cloth shop fills the grid and saves one purchase line per size/colour", async () => {
    mockApis(CLOTHING);
    const { container } = render(<PurchaseAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await fillDetails(container);

    fireEvent.click(await screen.findByTestId("open-variant-grid"));
    const grid = await screen.findByTestId("variant-qty-grid");
    expect(within(grid).getByLabelText("Style")).toHaveDisplayValue("Cotton Kurta (3)");
    fireEvent.change(within(grid).getByLabelText("Quantity of S / Blue"), { target: { value: "4" } });
    fireEvent.change(within(grid).getByLabelText("Quantity of M / Blue"), { target: { value: "2" } });
    fireEvent.change(within(grid).getByLabelText(/Cost per piece/), { target: { value: "300" } });
    fireEvent.click(within(grid).getByRole("button", { name: "Add 2 lines · 6 pcs" }));

    await waitFor(() => expect(screen.queryByTestId("variant-qty-grid")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Items (2)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Purchase" }));
    await waitFor(() => expect(createCall()).toBeDefined());
    const items = JSON.parse(createCall()[1].body).items;
    expect(items).toEqual([
      expect.objectContaining({ productId: 101, quantity: 4, costPrice: 300, mrp: 599, expiryDate: null }),
      expect.objectContaining({ productId: 102, quantity: 2, costPrice: 300, mrp: 649 }),
    ]);
  });
});
