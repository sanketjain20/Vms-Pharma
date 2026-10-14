import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import SalesAdd from "./SalesAdd";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });

const PRODUCT = { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10 };
const FREE_SCHEME = { schemeId: 7, name: "Buy 10 Get 1", description: "Buy 10 Get 1", schemeType: "FREE_QUANTITY", freeQuantity: 1, discountAmount: 0 };
const PCT_SCHEME = { schemeId: 8, name: "10% off", description: "10% off", schemeType: "PERCENT_DISCOUNT", freeQuantity: 0, discountAmount: 100 };

/** price: the product's selling price; applicable: what /api/Scheme/Applicable answers (null = no scheme) */
function mockApi({ price = 100, applicable = null } = {}) {
  apiClient.mockImplementation((url, options) => {
    if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [{ id: 5, uKey: "r5", shopName: "Shop Five", ownerName: "Owner" }] });
    if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [PRODUCT] });
    if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: price, currentQuantity: 500 } });
    if (url.includes("/api/Scheme/Applicable")) return ok({ status: 200, data: typeof applicable === "function" ? applicable(url) : applicable });
    if (url.includes("/api/Sales/AddSales")) return ok({ status: 200, message: "Sale added successfully" });
    return ok({ status: 200, data: null });
  });
}

const schemeCalls = () => apiClient.mock.calls.filter(([u]) => u.includes("/api/Scheme/Applicable")).map(([u]) => u);
const saleBody = () => JSON.parse(apiClient.mock.calls.find(([u]) => u.includes("/api/Sales/AddSales"))[1].body);

async function addLine(qty) {
  render(<SalesAdd onClose={jest.fn()} onSubmit={jest.fn()} />);
  await screen.findByText("Add Sales");
  fireEvent.click(screen.getByRole("button", { name: "Product" }));
  const scan = screen.getByPlaceholderText(/Scan or type barcode/i);
  fireEvent.change(scan, { target: { value: PRODUCT.barcode } });
  fireEvent.submit(scan.closest("form"));
  await screen.findByDisplayValue("Paracetamol");
  await waitFor(() => expect(screen.getByRole("button", { name: "+ Add Item" })).not.toBeDisabled()); // price loaded
  fireEvent.change(screen.getByPlaceholderText("Enter qty"), { target: { value: String(qty) } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add Item" }));
}

const openBilling = () => fireEvent.click(screen.getByRole("button", { name: "Billing" }));

describe("SalesAdd — schemes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("suggests the scheme for a new line: free units and the scheme name appear on it", async () => {
    mockApi({ applicable: FREE_SCHEME });
    await addLine(10);

    const scheme = await screen.findByTestId("line-scheme");
    expect(scheme).toHaveTextContent("Scheme: Buy 10 Get 1");
    expect(screen.getByText("Paracetamol").closest(".afx-line-row")).toHaveTextContent("+ 1 free");

    const url = schemeCalls()[0];
    expect(url).toContain("productId=1");
    expect(url).toContain("quantity=10");
    expect(url).toContain("unitPrice=100");
    expect(url).not.toContain("retailerId");
  });

  it("with no scheme the line looks and totals exactly as before", async () => {
    mockApi({ applicable: null });
    await addLine(10);
    await screen.findByText("Paracetamol");
    await waitFor(() => expect(schemeCalls()).toHaveLength(1));

    expect(screen.queryByTestId("line-scheme")).not.toBeInTheDocument();
    expect(screen.getByText("Paracetamol").closest(".afx-line-row")).not.toHaveTextContent("free");
    openBilling();
    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(screen.getByText("Payable Amount").nextSibling).toHaveTextContent("₹1180.00"); // 1,000 + 18% GST
  });

  it("free goods are not charged: Buy 10 Get 1 at 100 bills 1,000 (+GST), and the free unit is shown", async () => {
    mockApi({ applicable: FREE_SCHEME });
    await addLine(10);
    await screen.findByTestId("line-scheme");

    openBilling();
    expect(screen.getByText("Subtotal").nextSibling).toHaveTextContent("₹1000.00");
    expect(screen.getByText(/Free units/).nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Payable Amount").nextSibling).toHaveTextContent("₹1180.00");
  });

  it("a percentage scheme: 1,000 at 10% off is a 100 discount and 900 taxable", async () => {
    mockApi({ price: 1000, applicable: PCT_SCHEME });
    await addLine(1);
    await screen.findByTestId("line-scheme");

    openBilling();
    expect(screen.getByText("Scheme discount").nextSibling).toHaveTextContent("−₹100.00");
    expect(screen.getByText("Taxable Value").nextSibling).toHaveTextContent("₹900.00");
    expect(screen.getByText("Payable Amount").nextSibling).toHaveTextContent("₹1062.00"); // 900 + 18%
  });

  it("the clerk can remove the scheme; the totals go back and it can be applied again", async () => {
    mockApi({ price: 1000, applicable: PCT_SCHEME });
    await addLine(1);
    const scheme = await screen.findByTestId("line-scheme");

    fireEvent.click(within(scheme).getByRole("button", { name: "Remove" }));

    expect(screen.queryByTestId("line-scheme")).not.toBeInTheDocument();
    openBilling();
    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(screen.getByText("Payable Amount").nextSibling).toHaveTextContent("₹1180.00");

    fireEvent.click(screen.getByRole("button", { name: "Product" }));
    fireEvent.click(await screen.findByRole("button", { name: "Apply scheme" }));
    await screen.findByTestId("line-scheme");
  });

  it("sends the chosen scheme and the tax; the manual discount stays only what the clerk gave", async () => {
    mockApi({ price: 1000, applicable: PCT_SCHEME });
    await addLine(1);
    await screen.findByTestId("line-scheme");

    openBilling();
    fireEvent.click(screen.getByRole("button", { name: /Submit Sales/ }));

    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/AddSales"))).toBe(true));
    const body = saleBody();
    expect(body.totalDiscount).toBe(0); // the 100 scheme discount is the server's to add
    expect(body.amountPaid).toBe(1062);
    expect(body.items).toEqual([{ productId: 1, quantity: 1, sellingPrice: 1000, taxAmount: 180, batchId: null, schemeId: 8 }]);
  });

  it("a removed scheme is sent as none", async () => {
    mockApi({ price: 1000, applicable: PCT_SCHEME });
    await addLine(1);
    fireEvent.click(within(await screen.findByTestId("line-scheme")).getByRole("button", { name: "Remove" }));

    openBilling();
    fireEvent.click(screen.getByRole("button", { name: /Submit Sales/ }));

    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/AddSales"))).toBe(true));
    expect(saleBody().items[0].schemeId).toBeNull();
    expect(saleBody().amountPaid).toBe(1180);
  });

  it("a percent invoice discount is worked out on the value after the scheme and sent as an amount", async () => {
    mockApi({ price: 1000, applicable: PCT_SCHEME });
    await addLine(1);
    await screen.findByTestId("line-scheme");

    openBilling();
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "10" } }); // 10 %
    const discountRow = screen.getAllByText("Discount").find((el) => el.tagName === "SPAN"); // the label above the input is a <label>
    expect(discountRow.nextSibling).toHaveTextContent("−₹90.00");                            // 10% of 900, not of 1,000
    expect(screen.getByText("Payable Amount").nextSibling).toHaveTextContent("₹955.80"); // 810 + 18%

    fireEvent.click(screen.getByRole("button", { name: /Submit Sales/ }));
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/AddSales"))).toBe(true));
    expect(saleBody().totalDiscount).toBe(90);
    expect(saleBody().items[0].taxAmount).toBe(180);
  });

  it("refuses a discount bigger than the goods are worth, before calling the server", async () => {
    mockApi({ price: 100, applicable: null });
    await addLine(1);
    await screen.findByText("Paracetamol");

    openBilling();
    fireEvent.change(screen.getByPlaceholderText("0"), { target: { value: "150" } });
    fireEvent.change(screen.getByDisplayValue("%"), { target: { value: "FLAT" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit Sales/ }));

    expect(await screen.findByText(/Discount cannot be more than the value of the goods/)).toBeInTheDocument();
    expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Sales/AddSales"))).toBe(false);
  });

  it("looks again when the retailer changes, now sending the retailer", async () => {
    mockApi({ applicable: FREE_SCHEME });
    await addLine(10);
    await screen.findByTestId("line-scheme");
    expect(schemeCalls()).toHaveLength(1);

    openBilling();
    fireEvent.click(screen.getByPlaceholderText("Search retailer…"));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));

    await waitFor(() => expect(schemeCalls()).toHaveLength(2));
    expect(schemeCalls()[1]).toContain("retailerId=5");
  });

  it("does not look again for a line whose scheme the clerk removed", async () => {
    mockApi({ applicable: FREE_SCHEME });
    await addLine(10);
    fireEvent.click(within(await screen.findByTestId("line-scheme")).getByRole("button", { name: "Remove" }));

    openBilling();
    fireEvent.click(screen.getByPlaceholderText("Search retailer…"));
    fireEvent.mouseDown(await screen.findByText("Shop Five · Owner"));

    await new Promise((r) => setTimeout(r, 50));
    expect(schemeCalls()).toHaveLength(1);
  });

  it("a failed scheme lookup leaves the sale as a plain one (the server checks again anyway)", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Scheme/Applicable")) return Promise.reject(new Error("down"));
      if (url.includes("/api/Retailer/Dropdown")) return ok({ data: [] });
      if (url.includes("/api/ProductType/GetAllProductType")) return ok({ data: { productTypes: [] } });
      if (url.includes("/api/Product/GetAllProduct")) return ok({ data: [PRODUCT] });
      if (url.includes("/api/Product/GetProdByProdId/")) return ok({ data: [PRODUCT] });
      if (url.includes("/api/Inventory/GetInventoryByProdId/")) return ok({ status: 200, data: { unitSellingPrice: 100, currentQuantity: 500 } });
      return ok({ status: 200, data: null });
    });
    await addLine(10);

    await screen.findByText("Paracetamol");
    expect(screen.queryByTestId("line-scheme")).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
