import { render, screen, within } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const baseOrder = {
  uKey: "so-1",
  orderNumber: "SO000007",
  retailerId: 4,
  retailerName: "City Medicals",
  orderDate: "2026-10-01",
  status: "PARTIALLY_FULFILLED",
  billingMode: "SIMPLE",
  paymentType: "CREDIT",
  dueDate: "2026-10-31",
  amountPaid: 0,
  totalAmount: 1000,
  totalTax: 120,
  totalDiscount: 0,
  netAmount: 1120,
  items: [
    { id: 1, productId: 101, productName: "Paracetamol 500mg", quantity: 10, fulfilledQuantity: 5, pendingQuantity: 5, unitPrice: 100, gstRate: 12, taxAmount: 120, lineTotal: 1120 },
  ],
};

describe("SalesView (sales order) — sales invoices created from the order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists every sales invoice number the order was converted into", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/SalesOrder/GetSalesOrderByUKey/so-1")) {
        return jsonResponse({
          status: 200,
          data: {
            ...baseOrder,
            sales: [
              { documentId: 500, documentNumber: "INV000010", createdAt: "2026-10-02T10:00:00" },
              { documentId: 501, documentNumber: "INV000014", createdAt: "2026-10-05T10:00:00" },
            ],
          },
        });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<SalesView documentMode uKey="so-1" onClose={() => {}} />);

    const table = await screen.findByTestId("linked-sales");
    expect(screen.getByText("Sales Invoices From This Order (2)")).toBeInTheDocument();
    expect(within(table).getByText("INV000010")).toBeInTheDocument();
    expect(within(table).getByText("INV000014")).toBeInTheDocument();
    expect(screen.queryByTestId("linked-sales-empty")).not.toBeInTheDocument();
  });

  it("says the order is not converted yet when it has no linked sales", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/SalesOrder/GetSalesOrderByUKey/so-1")) {
        return jsonResponse({ status: 200, data: { ...baseOrder, status: "CONFIRMED", sales: [] } });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<SalesView documentMode uKey="so-1" onClose={() => {}} />);

    expect(await screen.findByTestId("linked-sales-empty")).toHaveTextContent("Not converted to a sale yet.");
    expect(screen.queryByTestId("linked-sales")).not.toBeInTheDocument();
  });
});
