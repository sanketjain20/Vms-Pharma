import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const variant = (id, size, color, extra = {}) => ({
  id, name: `Cotton Kurta - ${size} / ${color}`, productTypeId: 4, styleId: 7, styleName: "Cotton Kurta",
  variantSize: size, variantColor: color, sellingPrice: 899, stock: 3, ...extra,
});

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Apparel" }] } });
    if (url.includes("/api/Product/GetAllProduct")) {
      return ok({ data: [
        { id: 50, name: "Leather Belt", productTypeId: 4, sellingPrice: 400, stock: 9 },
        variant(101, "S", "Blue"), variant(102, "M", "Blue", { sellingPrice: 949 }), variant(103, "S", "Black", { stock: 0 }),
      ] });
    }
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

describe("Quick Sale — a style's sizes and colours on one card (Phase 5)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("shows one card for the style beside the ordinary products", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    const card = await screen.findByTestId("style-card");
    expect(screen.getAllByTestId("style-card")).toHaveLength(1);
    expect(within(card).getByText("Cotton Kurta")).toBeInTheDocument();
    expect(within(card).getByText("2 sizes · 2 colours")).toBeInTheDocument();
    expect(within(card).getByText("₹899 – ₹949")).toBeInTheDocument();
    expect(within(card).getByText("6 left")).toBeInTheDocument();
    expect(screen.getByText("Leather Belt")).toBeInTheDocument();
    expect(screen.queryByText("Cotton Kurta - S / Blue")).not.toBeInTheDocument();
  });

  it("picks sizes/colours into the cart and bills each as its own product", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(within(await screen.findByTestId("style-card")).getByRole("button", { name: "Choose size" }));
    const picker = await screen.findByTestId("variant-picker");
    expect(within(picker).getByLabelText("Add S / Black")).toBeDisabled(); // out of stock

    fireEvent.click(within(picker).getByLabelText("Add M / Blue"));
    fireEvent.click(within(picker).getByLabelText("One more M / Blue"));
    fireEvent.click(within(picker).getByLabelText("Add S / Blue"));
    expect(within(picker).getByText("3 in cart")).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole("button", { name: "Done" }));
    expect(within(screen.getByTestId("style-card")).getByRole("button", { name: "3 in cart · change" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    const place = await screen.findByRole("button", { name: /Place order/i });
    // the scheme look-ups for the lines finish first (the screen asks to wait while they run)
    await waitFor(() => { fireEvent.click(place); expect(call("/api/Sales/AddSales")).toBeTruthy(); });
    const items = JSON.parse(call("/api/Sales/AddSales")[1].body).items;
    expect(items.map((i) => [i.productId, i.quantity, i.sellingPrice])).toEqual([[102, 2, 949], [101, 1, 899]]);
  });
});
