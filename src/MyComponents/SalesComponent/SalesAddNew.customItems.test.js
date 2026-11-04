import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10, sellingPrice: 100, stock: 500 };

function mockApi({ allowCustomItems }) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems, canChange: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));
const saleBody = () => JSON.parse(call("/api/Sales/AddSales")[1].body);

async function fillCustom({ name, quantity, price, gstRate }) {
  const dialog = await screen.findByTestId("custom-item-form");
  fireEvent.change(within(dialog).getByLabelText(/Item name/), { target: { value: name } });
  fireEvent.change(within(dialog).getByLabelText(/^Quantity/), { target: { value: quantity } });
  fireEvent.change(within(dialog).getByLabelText(/Price per unit/), { target: { value: price } });
  fireEvent.change(within(dialog).getByLabelText(/GST %/), { target: { value: gstRate } });
  fireEvent.click(within(dialog).getByRole("button", { name: /Add to bill|Update item/ }));
}

describe("SalesAddNew (Quick Sale) — custom (run-time) items", () => {
  beforeEach(() => jest.clearAllMocks());

  it("has no custom item button while the feature is switched off", async () => {
    mockApi({ allowCustomItems: false });
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    await screen.findByRole("button", { name: /Add to cart/i });
    await waitFor(() => expect(call("/api/Sales/CustomItemSetting")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "+ Custom item" })).not.toBeInTheDocument();
  });

  it("a cart of only a custom item can be checked out and is sent without a product", async () => {
    mockApi({ allowCustomItems: true });
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Custom item" }));
    await fillCustom({ name: "Blue kurta", quantity: "1", price: "800", gstRate: "12" });

    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    const line = await screen.findByTestId("sale-line");
    expect(within(line).getByText("Blue kurta")).toBeInTheDocument();
    expect(within(line).getByTestId("line-custom")).toHaveTextContent("Custom item");
    expect(within(line).getByTestId("line-rate")).toHaveTextContent("12%"); // its own rate, not the common 18%

    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(saleBody().items).toEqual([{
      productId: null, itemName: "Blue kurta", hsnCode: null, gstRate: 12, costPrice: null, quantity: 1, sellingPrice: 800, taxAmount: 96,
    }]);
    expect(call("/api/Scheme/Applicable")).toBeUndefined();
  });

  it("mixes with a product, and its edit button opens the custom form instead of the batch sheet", async () => {
    mockApi({ allowCustomItems: true });
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    fireEvent.click(await screen.findByRole("button", { name: "+ Custom item" })); // also offered at checkout
    await fillCustom({ name: "Alteration", quantity: "1", price: "150", gstRate: "5" });

    const lines = screen.getAllByTestId("sale-line");
    expect(lines).toHaveLength(2);
    fireEvent.click(within(lines[1]).getByTitle("Edit batch / GST"));
    const dialog = await screen.findByTestId("custom-item-form");
    expect(within(dialog).getByLabelText(/Item name/)).toHaveValue("Alteration");
    expect(call("/api/Sales/GetAvailableBatches/null")).toBeUndefined();
    await fillCustom({ name: "Alteration (rush)", quantity: "2", price: "150", gstRate: "5" });

    expect(screen.getByText("Alteration (rush)")).toBeInTheDocument();
    await waitFor(() => expect(call("/api/Scheme/Applicable")).toBeTruthy()); // the product's scheme check only
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(saleBody().items.map((i) => i.productId ?? i.itemName)).toEqual([1, "Alteration (rush)"]);
  });
});
