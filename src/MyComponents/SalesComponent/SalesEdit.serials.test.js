import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const LAPTOP = { id: 7, name: "HP Laptop Battery", productTypeId: 10, trackSerial: true, gstRate: 18, priceIncludesGst: false };

/** A bill of 2 batteries, serials BAT-1 and BAT-2; BAT-3 is still in stock. */
const SALE = {
  id: 9, invoiceNumber: "INV00009", billingMode: "CASH", paymentType: "PAID", retailerId: null, dueDate: null, godownId: 3,
  totalDiscount: 0, manualDiscount: 0, schemeDiscount: 0, amountPaid: 2360, remainingAmount: 0,
  items: [{
    id: 1, product: "HP Laptop Battery", productId: 7, quantity: 2, sellingPrice: 1000, taxAmount: 360, discountAmount: 0,
    freeItem: false, batchId: 4, batchNumberSnapshot: "B4", gstRate: 18, gstSource: "PRODUCT", priceIncludesGst: false,
    serials: ["BAT-1", "BAT-2"],
  }],
};

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Spares" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [LAPTOP] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [LAPTOP] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return ok({ data: SALE });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 1000, currentQuantity: 1 } });
    if (url.includes("/api/Serial/InStock/7")) return ok({ status: 200, data: [{ serialNo: "BAT-3", batchNumber: "B4" }] });
    if (url.includes("/api/Sales/UpdateSales/")) return ok({ status: 200 });
    return ok({ status: 200, data: null });
  });
}

const updateBody = () => JSON.parse(apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/UpdateSales/"))[1].body);

async function open() {
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  await screen.findByText("Original Items", { selector: "button" });
}

async function save() {
  fireEvent.click(screen.getByRole("button", { name: "Update Sale" }));
  await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/UpdateSales/"))).toBe(true));
  return updateBody();
}

describe("SalesEdit — serial-number products", () => {
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("saving the bill unchanged sends the serial numbers it was sold with (no \"0 given\")", async () => {
    await open();
    const body = await save();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ productId: 7, quantity: 2, serials: ["BAT-1", "BAT-2"] });
  });

  it("the line shows its serial numbers", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    expect(within(screen.getByTestId("sale-line")).getByText(/BAT-1/)).toBeInTheDocument();
  });

  it("editing the line offers the bill's own units and those in stock; the quantity is the number picked", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    fireEvent.click(document.querySelector(".afx-line-row .afx-icon-btn"));

    const picker = await screen.findByTestId("edit-serial-picker");
    await waitFor(() => expect(within(picker).getByText("BAT-3")).toBeInTheDocument());
    expect(within(picker).getByText("BAT-1")).toBeInTheDocument();
    expect(within(picker).getByText("BAT-2")).toBeInTheDocument();
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Serial/InStock/7?godownId=3"))).toBe(true);

    fireEvent.click(within(picker).getByText("BAT-3"));
    await waitFor(() => expect(screen.getByPlaceholderText("Pick serial numbers")).toHaveValue(3));
    fireEvent.click(screen.getByRole("button", { name: "Update Item" }));

    const body = await save();
    expect(body.items[0].quantity).toBe(3);
    expect([...body.items[0].serials].sort()).toEqual(["BAT-1", "BAT-2", "BAT-3"]);
  });
});
