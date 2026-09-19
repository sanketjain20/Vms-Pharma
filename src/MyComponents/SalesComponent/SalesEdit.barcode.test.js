import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesEdit from "./SalesEdit";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const PRODUCT_TYPES = [{ id: 10, name: "Tablets" }];
const CATALOG_PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

const BASE_SALE = {
  id: 9,
  invoiceNumber: "INV00009",
  items: [],
  totalDiscount: 0,
  billingMode: "CASH",
  amountPaid: 0,
  remainingAmount: 0,
  retailerId: null,
  paymentType: "PAID",
  dueDate: null,
};

function mockApi({ inventoryByProduct = {}, barcodeLookup = {}, typeProducts = { "10": [CATALOG_PRODUCT] }, sale = BASE_SALE } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return jsonResponse({ data: { productTypes: PRODUCT_TYPES } });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ data: [CATALOG_PRODUCT] });
    if (url.includes("/api/Sales/GetSalesByUkey/")) return jsonResponse({ data: sale });
    if (url.includes("/api/Product/GetProductByBarcode/")) {
      const code = decodeURIComponent(url.split("/").pop());
      const hit = barcodeLookup[code];
      return jsonResponse(hit ? { status: 200, data: hit } : { status: 404, message: "No product found for this barcode." });
    }
    if (url.includes("/api/Product/GetProdByProdId/")) {
      const typeId = url.split("/").pop();
      return jsonResponse({ data: typeProducts[typeId] ?? [] });
    }
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) {
      const id = url.split("/").pop();
      const inv = inventoryByProduct[id];
      return jsonResponse(inv ? { status: 200, data: inv } : { status: 404, data: null });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

async function openProductTab() {
  render(<SalesEdit uKey="sale-9" onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText(/Edit Sale/i);
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  return screen.getByPlaceholderText(/Scan or type barcode/i);
}

function scan(input, code) {
  fireEvent.change(input, { target: { value: code } });
  fireEvent.submit(input.closest("form"));
}

describe("SalesEdit — barcode scan-to-select", () => {
  beforeEach(() => jest.clearAllMocks());

  it("selects the product type + product from a barcode already in the loaded catalog, without setting a quantity", async () => {
    mockApi({ inventoryByProduct: { "1": { unitSellingPrice: 50, currentQuantity: 20 } } });
    const input = await openProductTab();

    scan(input, "8901234567890");

    await screen.findByDisplayValue("Paracetamol");
    expect(screen.getByDisplayValue("Tablets")).toBeInTheDocument();
    await screen.findByText("₹50");
    expect(toast.success).toHaveBeenCalledWith("Paracetamol selected — enter quantity and Add Item");

    expect(screen.getByPlaceholderText("Enter qty")).toHaveValue(null);
  });

  it("falls back to the barcode API for a product not yet in the loaded catalog", async () => {
    mockApi({
      barcodeLookup: { "9998887776665": { id: 2, name: "Ibuprofen", barcode: "9998887776665", productTypeId: 10 } },
      inventoryByProduct: { "2": { unitSellingPrice: 80, currentQuantity: 5 } },
      typeProducts: { "10": [{ id: 2, name: "Ibuprofen", productTypeId: 10 }] },
    });
    const input = await openProductTab();

    scan(input, "9998887776665");

    await screen.findByDisplayValue("Ibuprofen");
    expect(screen.getByPlaceholderText("Enter qty")).toHaveValue(null);
  });

  it("adds a line item only after the user types a quantity and clicks + Add Item", async () => {
    mockApi({ inventoryByProduct: { "1": { unitSellingPrice: 50, currentQuantity: 20 } } });
    const input = await openProductTab();

    scan(input, "8901234567890");
    await screen.findByDisplayValue("Paracetamol");

    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));

    const row = await screen.findByText("Paracetamol");
    expect(row.closest("tr")).toHaveTextContent("3");
  });

  it("shows an error toast and selects nothing when the barcode matches no product", async () => {
    mockApi({});
    const input = await openProductTab();

    scan(input, "0000000000");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No product found for barcode "0000000000"');
    });
    expect(screen.queryByDisplayValue("Paracetamol")).not.toBeInTheDocument();
  });
});
