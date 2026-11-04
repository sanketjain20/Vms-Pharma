import { render, screen, fireEvent, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Grocery" }] } });
    if (url.includes("/api/Product/GetAllProduct")) {
      return ok({ data: [
        { id: 1, name: "Atta 5 kg", productTypeId: 4, sellingPrice: 228, stock: 10, unit: "PCS", gstRate: 5, priceIncludesGst: false },
        { id: 2, name: "Toned milk 1 L", productTypeId: 4, sellingPrice: 38, stock: 10, unit: "LTR", gstRate: 0, priceIncludesGst: false },
      ] });
    }
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    return ok({ status: 200, data: null });
  });
}

const card = (name) => screen.getByText(name).closest(".san-pcard");

async function checkout() {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Atta 5 kg");
  fireEvent.click(within(card("Atta 5 kg")).getByRole("button", { name: /Add to cart/ }));
  fireEvent.click(within(card("Toned milk 1 L")).getByRole("button", { name: /Add to cart/ }));
  fireEvent.click(within(card("Toned milk 1 L")).getByLabelText("Increase quantity"));
  fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
  await screen.findByRole("button", { name: /Place order/i });
}

describe("Quick Sale checkout — billing layout (items table left, total and payment right)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("lists the items as a table with #, name, qty, unit, price, GST, discount and amount", async () => {
    await checkout();
    const table = screen.getByTestId("bill-table");
    const headers = within(table).getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["#", "Item name", "Qty", "Unit", "Price (₹)", "GST", "Disc (₹)", "Amount (₹)", ""]);

    const [atta, milk] = within(table).getAllByTestId("sale-line");
    expect(within(atta).getAllByRole("cell")[0]).toHaveTextContent("1");
    expect(within(atta).getByTestId("line-unit")).toHaveTextContent("PCS");
    expect(within(atta).getByTestId("line-price")).toHaveTextContent("228.00");
    expect(within(atta).getByTestId("line-rate")).toHaveTextContent("5%");
    expect(within(atta).getByTestId("line-disc")).toHaveTextContent("0.00");
    expect(within(atta).getByTestId("line-total")).toHaveTextContent(/^₹239\.40/);
    expect(within(milk).getByTestId("line-unit")).toHaveTextContent("LTR");
    expect(milk.querySelector(".san-bt-qty")).toHaveTextContent("−2+"); // qty stepper
    expect(within(milk).getByTestId("line-total")).toHaveTextContent(/^₹76\.00/);
  });

  it("puts the GST mode and the bill discount under the table, in the wide column", async () => {
    await checkout();
    const main = screen.getByTestId("bill-table").closest(".san-bill-main");
    expect(within(main).getByText("GST mode")).toBeInTheDocument();
    expect(within(main).getByLabelText("Bill discount")).toBeInTheDocument();
    expect(within(main).queryByText("Net amount")).toBeNull();
  });

  it("shows the total large on the right with the item and quantity count, then the breakdown and the payment", async () => {
    await checkout();
    const side = screen.getByTestId("bill-total").closest(".san-bill-side");
    // 315.40 rounded to the rupee (round-off is on by default)
    expect(within(screen.getByTestId("bill-total")).getByText("₹315.00")).toBeInTheDocument();
    expect(screen.getByTestId("round-off")).toHaveTextContent("- 0.40");
    expect(screen.getByTestId("bill-total")).toHaveTextContent("Items: 2 · Qty: 3");
    expect(within(side).getByText("Net amount")).toBeInTheDocument();
    expect(within(side).getAllByTestId("gst-split").map((r) => r.textContent)).toEqual(["GST @ 0%₹0.00", "GST @ 5%₹11.40"]);
    expect(within(side).getByText("Payment type")).toBeInTheDocument();
    expect(within(side).getByRole("button", { name: /Place order/i })).toBeInTheDocument();
  });

  it("the bill discount moves the total", async () => {
    await checkout();
    fireEvent.change(screen.getByLabelText("Bill discount"), { target: { value: "10" } }); // 10%
    // 304 goods - 30.40 = 273.60 taxable; GST 5% on the atta's share (228 - 22.80 = 205.20) = 10.26
    expect(within(screen.getByTestId("bill-total")).getByText("₹284.00")).toBeInTheDocument(); // 283.86 rounded
    expect(screen.getByTestId("round-off")).toHaveTextContent("+ 0.14");
    expect(screen.getByText("Discount").parentElement).toHaveTextContent("-₹30.40");
  });
});

describe("Quick Sale checkout — one scroll bar (the page's)", () => {
  const css = require("fs").readFileSync(require("path").join(__dirname, "../../Styles/Sales/SalesAddNew.css"), "utf8");
  const block = (sel) => { const i = css.indexOf(sel); return i < 0 ? "" : css.slice(i, css.indexOf("}", i) + 1); };

  it("the items panel and the right panel don't scroll inside themselves", () => {
    expect(block(".san-block-body.san-bill-main-body, .san-block-body.san-bill-side-body {")).toMatch(/max-height: none; overflow: visible;/);
  });

  it("the items table only scrolls sideways (narrow screens), never up and down", () => {
    const wrap = block(".san-bill-table-wrap {");
    expect(wrap).toMatch(/overflow-x: auto; overflow-y: hidden;/);
    expect(wrap).not.toMatch(/max-height/);
  });

  it("the right panel stays in view only on screens tall enough to hold it", () => {
    expect(css).toMatch(/\.san-bill-side \{ position: sticky; top: 12px; \}/);
    expect(css).toMatch(/@media \(max-height: 860px\) \{ \.san-bill-side \{ position: static; \} \}/);
  });
});
