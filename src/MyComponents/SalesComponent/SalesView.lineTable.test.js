import { render, screen, within } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const sale = {
  id: 1,
  uKey: "sale-1",
  invoiceNumber: "INV000010",
  billingMode: "CASH",
  paymentType: "PAID",
  createdAt: "2026-10-01",
  retailerName: "City Medicals",
  totalAmount: 1500,
  totalTax: 168,
  totalDiscount: 100,
  netAmount: 1568,
  remainingAmount: 0,
  items: [
    // 10 x 100 = 1000, 100 off -> 900 taxable, 12% = 108
    { product: "Paracetamol", quantity: 10, sellingPrice: 100, discountAmount: 100, taxAmount: 108, subtotal: 1108,
      batchNumberSnapshot: "B1", expiryDateSnapshot: "2028-01-31", hsnCodeSnapshot: "3004" },
    // 5 x 100 = 500, 12% = 60
    { product: "Amoxicillin", quantity: 5, sellingPrice: 100, discountAmount: 0, taxAmount: 60, subtotal: 560,
      batchNumberSnapshot: "B2", expiryDateSnapshot: "2027-06-30", hsnCodeSnapshot: "3004" },
  ],
};

const order = {
  uKey: "so-1",
  orderNumber: "SO000007",
  retailerName: "City Medicals",
  orderDate: "2026-10-01",
  billingMode: "CASH",
  paymentType: "CREDIT",
  totalAmount: 140,
  totalTax: 16.8,
  totalDiscount: 0,
  netAmount: 156.8,
  sales: [],
  items: [
    { id: 1, productId: 101, productName: "Paracetamol", quantity: 10, unitPrice: 14, gstRate: 12, taxAmount: 16.8,
      lineTotal: 156.8, batchId: 900, batchNumber: "BCH900", expiryDate: "2028-03-31", hsnCode: "3004" },
  ],
};

function mockGet(url, data) {
  apiClient.mockImplementation((u) => (u.includes(url) ? jsonResponse({ status: 200, data }) : jsonResponse({ status: 200, data: null })));
}

describe("SalesView — line items table", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows amount before GST, the GST and the line total per product, with column totals at the bottom", async () => {
    mockGet("/api/Sales/GetSalesByUkey/sale-1", sale);

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText("Paracetamol");
    expect(screen.getByText("Amount excl. GST (₹)")).toBeInTheDocument();
    expect(screen.getByText("Rate excl. GST (₹)")).toBeInTheDocument();

    expect(screen.getAllByTestId("line-amount").map((c) => c.textContent)).toEqual(["900.00", "500.00"]);
    expect(screen.getAllByTestId("line-tax").map((c) => c.textContent)).toEqual(["108.00", "60.00"]);
    expect(screen.getAllByTestId("line-rate").map((c) => c.textContent)).toEqual(["12%", "12%"]);
    expect(screen.getAllByTestId("line-total").map((c) => c.textContent)).toEqual(["1008.00", "560.00"]);

    expect(screen.getByTestId("sum-amount")).toHaveTextContent("1400.00");
    expect(screen.getByTestId("sum-tax")).toHaveTextContent("168.00");
    expect(screen.getByTestId("sum-total")).toHaveTextContent("1568.00");
  });

  it("shows the order line's batch, expiry and HSN on a sales order", async () => {
    mockGet("/api/SalesOrder/GetSalesOrderByUKey/so-1", order);

    render(<SalesView documentMode uKey="so-1" onClose={() => {}} />);

    const row = (await screen.findByText("BCH900")).closest("tr");
    expect(within(row).getByText("2028-03-31")).toBeInTheDocument();
    expect(within(row).getByText("3004")).toBeInTheDocument();
    expect(within(row).getByTestId("line-amount")).toHaveTextContent("140.00");
    expect(within(row).getByTestId("line-tax")).toHaveTextContent("16.80");
    expect(within(row).getByTestId("line-rate")).toHaveTextContent("12%");
    expect(within(row).getByTestId("line-total")).toHaveTextContent("156.80");
  });
});
