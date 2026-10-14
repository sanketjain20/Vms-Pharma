import { render, screen } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

const jsonResponse = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const baseSale = {
  id: 1, uKey: "sale-1", invoiceNumber: "INV00001", totalAmount: 1000, totalTax: 0, totalDiscount: 0, manualDiscount: 0,
  schemeDiscount: 0, netAmount: 1000, billingMode: "MEDICAL", createdAt: "2026-03-15", remainingAmount: 0, items: [],
};

const item = (o) => ({
  id: 1, product: "Paracetamol", quantity: 10, sellingPrice: 100, taxAmount: 0, subtotal: 1000, discountAmount: 0, freeItem: false,
  batchNumberSnapshot: "B1", ...o,
});

async function show(sale) {
  apiClient.mockImplementation((url) =>
    url.includes("/api/Sales/GetSalesByUkey/") ? jsonResponse({ status: 200, data: sale }) : jsonResponse({ status: 200, data: null }));
  render(<SalesView uKey="sale-1" onClose={() => {}} />);
  await screen.findByText(/Invoice · INV00001/i);
}

describe("SalesView — schemes and discounts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a sale with no discount looks as it always did: no Disc column, no scheme rows", async () => {
    await show({ ...baseSale, items: [item({})] });

    expect(screen.queryByText("Disc (₹)")).not.toBeInTheDocument();
    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(screen.queryByText(/Free units/)).not.toBeInTheDocument();
    expect(screen.queryByText("FREE")).not.toBeInTheDocument();
  });

  it("Buy 10 Get 1: the free row is tagged FREE, shows its scheme and batch, and the free units are counted", async () => {
    await show({
      ...baseSale,
      items: [
        item({ schemeId: 7, schemeNameSnapshot: "Buy 10 Get 1" }),
        item({ id: 2, quantity: 1, sellingPrice: 0, subtotal: 0, freeItem: true, schemeId: 7, schemeNameSnapshot: "Buy 10 Get 1", batchNumberSnapshot: "B2" }),
      ],
    });

    expect(screen.getByText("FREE")).toBeInTheDocument();
    expect(screen.getAllByText("Scheme: Buy 10 Get 1")).toHaveLength(2);
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(screen.getByText(/Free units/).nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Net Amount").nextSibling).toHaveTextContent("₹1000.00");
  });

  it("a discounted row gets a Disc column and its total is after the discount; the scheme discount is its own summary line", async () => {
    await show({
      ...baseSale, totalAmount: 1000, totalDiscount: 150, manualDiscount: 50, schemeDiscount: 100, netAmount: 850,
      items: [item({ quantity: 1, sellingPrice: 1000, subtotal: 1000, discountAmount: 150, schemeId: 8, schemeNameSnapshot: "10% off" })],
    });

    expect(screen.getByText("Disc (₹)")).toBeInTheDocument();
    expect(screen.getByText("150.00")).toBeInTheDocument();  // the row's discount
    expect(screen.getByText("850.00")).toBeInTheDocument();  // the row's total: 1,000 - 150
    expect(screen.getByText("Scheme discount").nextSibling).toHaveTextContent("−₹100.00");
    expect(screen.getByText("Discount").nextSibling).toHaveTextContent("−₹50"); // the invoice discount alone, not 150 again
  });

  it("a sale from before schemes with an invoice discount shows that discount, as before", async () => {
    await show({ ...baseSale, totalDiscount: 100, manualDiscount: 100, netAmount: 900, items: [item({})] });

    expect(screen.queryByText("Scheme discount")).not.toBeInTheDocument();
    expect(screen.getByText("Discount").nextSibling).toHaveTextContent("−₹100");
  });
});
