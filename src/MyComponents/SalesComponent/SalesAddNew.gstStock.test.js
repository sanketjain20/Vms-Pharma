import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const variant = (id, size, color, extra = {}) => ({
  id, name: `Kurta - ${size} / ${color}`, productTypeId: 4, styleId: 7, styleName: "Kurta",
  variantSize: size, variantColor: color, sellingPrice: 500, stock: 2, gstRate: 5, priceIncludesGst: true, ...extra,
});

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Apparel" }] } });
    if (url.includes("/api/Product/GetAllProduct")) {
      return ok({ data: [
        { id: 1, name: "Shirt", productTypeId: 4, sellingPrice: 100, stock: 2, unit: "PCS", gstRate: 18, priceIncludesGst: true },
        { id: 2, name: "Jeans", productTypeId: 4, sellingPrice: 1000, stock: 5, unit: "PCS", gstRate: 5, priceIncludesGst: false },
        { id: 3, name: "Cap", productTypeId: 4, sellingPrice: 200, stock: 4 },
        { id: 4, name: "Never Bought", productTypeId: 4, sellingPrice: 300 }, // no stock row in this godown
        variant(101, "S", "Blue"), variant(102, "M", "Blue", { stock: undefined }),
      ] });
    }
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const card = (name) => screen.getByText(name).closest(".san-pcard");
const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

describe("Quick Sale — GST on the price, stock limits and clear lines", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("each card says how its price stands with GST, and shows the unit", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Shirt");
    expect(within(card("Shirt")).getByTestId("card-gst")).toHaveTextContent("incl. 18% GST");
    expect(within(card("Jeans")).getByTestId("card-gst")).toHaveTextContent("+ 5% GST");
    expect(within(card("Cap")).getByTestId("card-gst")).toHaveTextContent("GST not set");
    expect(within(card("Shirt")).getByTestId("card-meta")).toHaveTextContent("PCS");
  });

  it("a product with no stock in this godown cannot be added", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Never Bought");
    expect(within(card("Never Bought")).getByText("Out of stock")).toBeInTheDocument();
    expect(within(card("Never Bought")).queryByRole("button", { name: /Add to cart/ })).toBeNull();
  });

  it("once every unit in stock is in the cart, + is locked and the card says so", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Shirt");
    fireEvent.click(within(card("Shirt")).getByRole("button", { name: /Add to cart/ }));
    expect(within(card("Shirt")).getByLabelText("Increase quantity")).not.toBeDisabled();
    fireEvent.click(within(card("Shirt")).getByLabelText("Increase quantity"));
    expect(within(card("Shirt")).getByLabelText("Increase quantity")).toBeDisabled();
    expect(within(card("Shirt")).getByTestId("card-max")).toHaveTextContent("All 2 in cart");
    // less is still allowed
    fireEvent.click(within(card("Shirt")).getByLabelText("Decrease quantity"));
    expect(within(card("Shirt")).queryByTestId("card-max")).toBeNull();
  });

  it("a size never bought is blocked in the picker, and a size whose stock is all in the cart says so", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(within(await screen.findByTestId("style-card")).getByRole("button", { name: "Choose size" }));
    const picker = await screen.findByTestId("variant-picker");
    expect(within(picker).getByLabelText("Add M / Blue")).toBeDisabled();
    fireEvent.click(within(picker).getByLabelText("Add S / Blue"));
    fireEvent.click(within(picker).getByLabelText("One more S / Blue"));
    expect(within(picker).getByLabelText("One more S / Blue")).toBeDisabled();
    expect(within(picker).getByTestId("variant-max")).toHaveTextContent("All in cart");
  });

  it("the cart shows each line as the customer pays it, and the GST split by rate", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Shirt");
    fireEvent.click(within(card("Shirt")).getByRole("button", { name: /Add to cart/ }));
    fireEvent.click(within(card("Jeans")).getByRole("button", { name: /Add to cart/ }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    await screen.findByRole("button", { name: /Place order/i });

    const [shirt, jeans] = screen.getAllByTestId("sale-line");
    // ₹100 including 18%: the line is ₹100, not the ₹84.75 before GST
    expect(within(shirt).getByTestId("line-total")).toHaveTextContent(/^₹100\.00/);
    expect(within(shirt).getByTestId("line-excl")).toHaveTextContent("₹84.75 + ₹15.25 GST");
    expect(within(shirt).getByText(/price incl\. GST/)).toBeInTheDocument();
    expect(within(jeans).getByTestId("line-total")).toHaveTextContent(/^₹1050\.00/);

    const split = screen.getAllByTestId("gst-split").map((r) => r.textContent);
    expect(split).toEqual(["GST @ 5%₹50.00", "GST @ 18%₹15.25"]);
    expect(screen.getByText("Net amount").parentElement).toHaveTextContent("₹1150.00");
    expect(screen.getByTestId("common-gst-hint")).toBeInTheDocument();
  });

  it("in the cart, + stops at the stock too", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Shirt");
    fireEvent.click(within(card("Shirt")).getByRole("button", { name: /Add to cart/ }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    await screen.findByRole("button", { name: /Place order/i });
    const line = screen.getByTestId("sale-line");
    fireEvent.click(within(line).getByLabelText("Increase quantity"));
    expect(within(line).getByLabelText("Increase quantity")).toBeDisabled();
  });

  it("sends an inclusive line as its tag price with priceIncludesGst, so the server backs the GST out", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByText("Shirt");
    fireEvent.click(within(card("Shirt")).getByRole("button", { name: /Add to cart/ }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    const place = await screen.findByRole("button", { name: /Place order/i });
    await waitFor(() => { fireEvent.click(place); expect(call("/api/Sales/AddSales")).toBeTruthy(); });
    const [item] = JSON.parse(call("/api/Sales/AddSales")[1].body).items;
    expect(item).toMatchObject({ productId: 1, sellingPrice: 100, priceIncludesGst: true, gstRate: null });
  });
});
