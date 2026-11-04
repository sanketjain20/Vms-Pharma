import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };

function mockApi() {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 100, currentQuantity: 500 } });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: null });
    if (url.includes("/api/SalesOrder/AddSalesOrder")) return ok({ status: 200, message: "Sales order added successfully" });
    return ok({ status: 200, data: null });
  });
}

const orderCall = () => apiClient.mock.calls.find(([u]) => u.includes("/api/SalesOrder/AddSalesOrder"));

/* Sales orders are created on SalesAdd in documentMode (SalesOrderComponent/SalesOrder.js). This replaces the old
   OperationsGrid form test, which drove a generic order form that no longer exists. */
describe("SalesAdd — sales order mode", () => {
  beforeEach(() => jest.clearAllMocks());

  it("says it is a sales order, not a sale", async () => {
    mockApi();
    render(<SalesAdd documentMode onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(await screen.findByText("Add Sales Order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Sales Order" })).toBeInTheDocument();
  });

  it("submits the order to AddSalesOrder with the retailer, line price, GST and no walk-in details", async () => {
    mockApi();
    const onSubmit = jest.fn();
    render(<SalesAdd documentMode onClose={jest.fn()} onSubmit={onSubmit} />);
    await screen.findByText("Add Sales Order");

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    const scan = screen.getByPlaceholderText(/Scan or type barcode/i);
    fireEvent.change(scan, { target: { value: PRODUCT.barcode } });
    fireEvent.submit(scan); // bubbles to the scan form
    await screen.findByDisplayValue("Paracetamol");
    await waitFor(() => expect(screen.getByRole("button", { name: "+ Add Item" })).not.toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));

    fireEvent.click(screen.getByRole("button", { name: "Billing" }));
    fireEvent.click(screen.getByPlaceholderText("Search retailer…"));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));
    // a new retailer re-checks schemes; saving waits for that on purpose
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Scheme/Applicable") && u.includes("retailerId=5"))).toBe(true));
    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByRole("button", { name: "Save Sales Order" }));

    await waitFor(() => expect(orderCall()).toBeTruthy());
    const body = JSON.parse(orderCall()[1].body);
    expect(body).toMatchObject({
      retailerId: 5, paymentType: "PAID", autoApplySchemes: true,
      items: [{ productId: 1, quantity: 2, unitPrice: 100, gstRate: 18, schemeId: null, batchId: null }],
    });
    expect(body).not.toHaveProperty("customerName");
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/AddSales"))).toBe(false);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
