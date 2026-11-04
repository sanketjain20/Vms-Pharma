import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const PHONE = { id: 7, name: "Phone X", productTypeId: 4, trackSerial: true, sellingPrice: 10000, stock: 3 };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Mobiles" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PHONE] });
    if (url.includes("/api/Serial/InStock/7")) return ok({ status: 200, data: [{ serialNo: "IMEI1" }, { serialNo: "IMEI2" }, { serialNo: "IMEI3" }] });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

describe("Quick Sale — a product with serial numbers (Phase 6)", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("Add to cart opens the serial picker; the cart line holds the units picked", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
    const modal = await screen.findByTestId("serial-modal");
    fireEvent.click(await within(modal).findByRole("button", { name: /^IMEI2/ }));
    fireEvent.click(within(modal).getByRole("button", { name: /^IMEI3/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Add 2 to cart" }));
    expect(screen.queryByTestId("serial-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
    const line = await screen.findByTestId("sale-line");
    expect(within(line).getByTestId("serial-list")).toHaveTextContent("S/N: IMEI2, IMEI3");

    fireEvent.click(await screen.findByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(call("/api/Sales/AddSales")).toBeTruthy());
    expect(JSON.parse(call("/api/Sales/AddSales")[1].body).items).toEqual([
      expect.objectContaining({ productId: 7, quantity: 2, sellingPrice: 10000, serials: ["IMEI2", "IMEI3"] }),
    ]);
    expect(call("/api/Scheme/Applicable")).toBeUndefined();
  });

  it("changing the quantity goes back to the picker, and dropping every serial removes the line", async () => {
    render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Add to cart/i }));
    let modal = await screen.findByTestId("serial-modal");
    fireEvent.click(await within(modal).findByRole("button", { name: /^IMEI1/ }));
    fireEvent.click(within(modal).getByRole("button", { name: "Add 1 to cart" }));

    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    modal = await screen.findByTestId("serial-modal");
    const picked = await within(modal).findByRole("button", { name: /^IMEI1/ });
    expect(picked).toHaveAttribute("aria-pressed", "true"); // the cart's own unit, already picked
    fireEvent.click(picked);
    fireEvent.click(within(modal).getByRole("button", { name: "Remove from cart" }));
    expect(screen.getByRole("button", { name: /Proceed to checkout/i })).toBeDisabled();
  });
});
