import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const variant = (id, size, color, extra = {}) => ({
  id, name: `Cotton Kurta - ${size} / ${color}`, productTypeId: 4, styleId: 7, styleName: "Cotton Kurta",
  variantSize: size, variantColor: color, sellingPrice: 899, stock: 3, barcode: `B${id}`, ...extra,
});

const PRODUCTS = [
  { id: 50, name: "Leather Belt", productTypeId: 4, sellingPrice: 400, stock: 9, barcode: "B50" },
  variant(101, "S", "Blue"), variant(102, "M", "Blue"), variant(103, "S", "Black", { stock: 2 }),
];

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Apparel" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: PRODUCTS });
    if (url.includes("/api/Product/GetProdByProdId")) return ok({ data: PRODUCTS });
    if (url.includes("/api/ProductType/GetProdTypeByProductId")) return ok({ data: { productTypeId: 4 } });
    if (url.includes("/api/Inventory/GetInventoryByProdId")) {
      const id = Number(url.split("/").pop());
      return ok({ status: 200, data: { currentQuantity: PRODUCTS.find((p) => p.id === id)?.stock ?? 0, unitSellingPrice: 899 } });
    }
    return ok({ status: 200, data: [] });
  });
}

const inventoryCalls = () => apiClient.mock.calls.filter(([u]) => u.includes("/api/Inventory/GetInventoryByProdId")).map(([u]) => u.split("/").pop());

async function scan(code) {
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  const box = await screen.findByPlaceholderText("Scan or type barcode, then press Enter…");
  fireEvent.change(box, { target: { value: code } });
  fireEvent.submit(box.closest("form"));
}

describe("Sales Add — size and colour chips for a style (Phase 5)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("picking a variant shows its style's sizes and colours, and a chip switches the variant", async () => {
    render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Product/GetAllProduct"))).toBe(true));
    await scan("B101");

    const chips = await screen.findByTestId("variant-chips");
    expect(within(chips).getByRole("button", { name: "S" })).toHaveClass("is-on");
    expect(within(chips).getByRole("button", { name: /^Blue/ })).toHaveClass("is-on");

    fireEvent.click(within(chips).getByRole("button", { name: /^Black/ }));
    await waitFor(() => expect(inventoryCalls()).toContain("103"));
    expect(within(screen.getByTestId("variant-chips")).getByRole("button", { name: /^Black/ })).toHaveClass("is-on");

    fireEvent.click(within(screen.getByTestId("variant-chips")).getByRole("button", { name: "M" }));
    // M is not made in Black, so it moves to M / Blue
    await waitFor(() => expect(inventoryCalls()).toContain("102"));
    expect(within(screen.getByTestId("variant-chips")).getByRole("button", { name: /^Black/ })).toBeDisabled();
  });

  it("an ordinary product shows no chips", async () => {
    render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Product/GetAllProduct"))).toBe(true));
    await scan("B50");
    await waitFor(() => expect(inventoryCalls()).toContain("50"));
    expect(screen.queryByTestId("variant-chips")).not.toBeInTheDocument();
  });
});
