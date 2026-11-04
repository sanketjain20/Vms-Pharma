import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const CUSTOM_ROW = {
  id: 2, custom: true, product: "Alteration charge", itemName: "Alteration charge", productId: null, quantity: 1,
  sellingPrice: 150, taxAmount: 7.5, discountAmount: 0, freeItem: false, gstRate: 5, hsnCodeSnapshot: "998821", costPrice: null,
};

const sale = (items) => ({
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 157.5, remainingAmount: 0, items,
});

function mockApi(saleData, allowCustomItems) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/CustomItemSetting")) return ok({ status: 200, data: { allowCustomItems, canChange: true } });
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: saleData });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const call = (path) => apiClient.mock.calls.find(([u]) => u.includes(path));

async function open(saleData, allowCustomItems) {
  mockApi(saleData, allowCustomItems);
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await waitFor(() => expect(call("/api/Sales/CustomItemSetting")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
}

describe("SalesEdit — custom (run-time) items", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a saved custom line comes back as typed and is saved again unchanged", async () => {
    await open(sale([CUSTOM_ROW]), false);
    const line = await screen.findByTestId("sale-line");
    expect(within(line).getByTestId("line-custom")).toHaveTextContent("Custom item · HSN 998821");

    fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
    await waitFor(() => expect(call("/api/Sales/UpdateSales/")).toBeTruthy());
    expect(JSON.parse(call("/api/Sales/UpdateSales/")[1].body).items).toEqual([{
      productId: null, itemName: "Alteration charge", hsnCode: "998821", gstRate: 5, costPrice: null, quantity: 1, sellingPrice: 150, taxAmount: 7.5,
    }]);
  });

  it("a bill that already has custom lines can still get one while the switch is off", async () => {
    await open(sale([CUSTOM_ROW]), false);
    expect(await screen.findByRole("button", { name: "+ Custom item" })).toBeInTheDocument();
  });

  it("a bill without custom lines gets none while the switch is off", async () => {
    await open(sale([{ id: 1, product: "Paracetamol", productId: 1, quantity: 1, sellingPrice: 100, taxAmount: 18, discountAmount: 0, freeItem: false }]), false);
    await screen.findByTestId("sale-line");
    expect(screen.queryByRole("button", { name: "+ Custom item" })).not.toBeInTheDocument();
  });
});
