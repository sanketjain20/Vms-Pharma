import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("./SalesView", () => () => null);

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

function mockApi({ roundBillTotal = true } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems: false, roundBillTotal } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 4, name: "Grocery" }] } });
    if (url.includes("/api/Product/GetAllProduct")) {
      return ok({ data: [
        { id: 1, name: "Atta 5 kg", productTypeId: 4, sellingPrice: 228, stock: 10, unit: "PCS", gstRate: 5, priceIncludesGst: false },
        { id: 2, name: "Toned milk 1 L", productTypeId: 4, sellingPrice: 38, stock: 10, unit: "LTR", gstRate: 0, priceIncludesGst: false },
      ] });
    }
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully", data: { uKey: "s1" } });
    return ok({ status: 200, data: null });
  });
}

const card = (name) => screen.getByText(name).closest(".san-pcard");
const saleCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"));

/** Atta 228 + 5% (239.40) and 2 x milk 38 (76.00) = 315.40. */
async function checkout() {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Atta 5 kg");
  fireEvent.click(within(card("Atta 5 kg")).getByRole("button", { name: /Add to cart/ }));
  fireEvent.click(within(card("Toned milk 1 L")).getByRole("button", { name: /Add to cart/ }));
  fireEvent.click(within(card("Toned milk 1 L")).getByLabelText("Increase quantity"));
  fireEvent.click(screen.getByRole("button", { name: /Proceed to checkout/i }));
  await screen.findByRole("button", { name: /Place order/i });
}

describe("Quick Sale — split payment and round-off", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it("Rs 200 cash + the rest by UPI is sent as two payments, SPLIT, on the rounded total", async () => {
    mockApi();
    await checkout();
    expect(screen.getByLabelText("Payment 1 amount")).toHaveValue(315);

    fireEvent.click(screen.getByRole("button", { name: "+ Split payment" }));
    fireEvent.change(screen.getByLabelText("Payment 1 amount"), { target: { value: "200" } });
    expect(screen.getByLabelText("Payment 2 amount")).toHaveValue(115);
    fireEvent.change(screen.getByLabelText("Payment 2 reference"), { target: { value: "UPI123" } });
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));

    await waitFor(() => expect(saleCall()).toBeTruthy());
    const body = JSON.parse(saleCall()[1].body);
    expect(body.billingMode).toBe("SPLIT");
    expect(body.paymentType).toBe("PAID");
    expect(body.amountPaid).toBe(315);
    expect(body.payments).toEqual([
      { mode: "CASH", amount: 200, reference: null },
      { mode: "UPI", amount: 115, reference: "UPI123" },
    ]);
  });

  it("one mode sends that mode", async () => {
    mockApi();
    await checkout();
    fireEvent.change(screen.getByLabelText("Payment 1 mode"), { target: { value: "CARD" } });
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    await waitFor(() => expect(saleCall()).toBeTruthy());
    const body = JSON.parse(saleCall()[1].body);
    expect(body.billingMode).toBe("CARD");
    expect(body.payments).toEqual([{ mode: "CARD", amount: 315, reference: null }]);
  });

  it("a part payment that covers the whole bill is refused before anything is sent", async () => {
    mockApi();
    await checkout();
    fireEvent.click(screen.getByRole("button", { name: /Partial/ }));
    fireEvent.change(screen.getByLabelText("Payment 1 amount"), { target: { value: "315" } });
    fireEvent.click(screen.getByRole("button", { name: /Place order/i }));
    expect(await screen.findByText("A part payment must be less than the bill")).toBeInTheDocument();
    expect(saleCall()).toBeUndefined();
  });

  it("a shop that doesn't round bills keeps the paise and shows no round-off", async () => {
    mockApi({ roundBillTotal: false });
    await checkout();
    await waitFor(() => expect(within(screen.getByTestId("bill-total")).getByText("₹315.40")).toBeInTheDocument());
    expect(screen.queryByTestId("round-off")).toBeNull();
    expect(screen.getByLabelText("Payment 1 amount")).toHaveValue(315.4);
  });
});
