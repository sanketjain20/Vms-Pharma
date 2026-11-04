import { render, screen } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient", () => jest.fn());

const base = { id: 1, invoiceNumber: "INV-1", remainingAmount: 0, totalAmount: 90, totalTax: 16.2, totalDiscount: 0, netAmount: 106.2, items: [] };

function show(sale) {
  apiClient.mockImplementation((url) => {
    const body = url.includes("GetSalesByUkey") ? { status: 200, data: { ...base, ...sale } } : { status: 404 };
    return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
  });
  render(<SalesView uKey="sale-1" onClose={() => {}} />);
}

const ITEM = { id: 7, product: "Cotton shirt", productId: 1, quantity: 1, sellingPrice: 90, taxAmount: 16.2, discountAmount: 0, freeItem: false };

describe("SalesView — changed prices and the credit limit", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a line sold at another price shows from what and why", async () => {
    show({ items: [{ ...ITEM, listPrice: 100, priceOverrideReason: "Bargained", priceBelowCost: false }] });
    expect(await screen.findByTestId("line-price-changed")).toHaveTextContent("from ₹100.00 · Bargained");
  });

  it("a line sold below cost says so", async () => {
    show({ items: [{ ...ITEM, sellingPrice: 55, listPrice: 100, priceOverrideReason: "Clearance", priceBelowCost: true }] });
    expect(await screen.findByTestId("line-price-changed")).toHaveTextContent("Clearance · below cost");
  });

  it("a bill allowed over the credit limit shows the reason", async () => {
    show({ retailerName: "Shop Five", creditLimitReason: "Festival order", items: [ITEM] });
    expect(await screen.findByTestId("credit-limit-reason")).toHaveTextContent("Over credit limitFestival order");
  });

  it("an ordinary bill shows neither", async () => {
    show({ items: [ITEM] });
    await screen.findByTestId("sale-customer");
    expect(screen.queryByTestId("line-price-changed")).toBeNull();
    expect(screen.queryByTestId("credit-limit-reason")).toBeNull();
  });
});
