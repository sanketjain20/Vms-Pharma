import { render, screen, within } from "@testing-library/react";
import PurchaseView from "./PurchaseView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const baseOrder = {
  uKey: "po-1",
  orderNumber: "PO000003",
  supplierId: 7,
  supplierName: "Sunrise Distributors",
  orderDate: "2026-10-01",
  status: "PARTIALLY_FULFILLED",
  supplierInvoiceNumber: "SINV-100",
  invoiceDate: "2026-10-01",
  paymentStatus: "CREDIT",
  dueDate: "2026-10-31",
  amountPaid: 0,
  totalAmount: 1000,
  totalTax: 180,
  netAmount: 1180,
  items: [
    { id: 1, productId: 101, productName: "Amoxicillin", quantity: 10, receivedQuantity: 4, pendingQuantity: 6, unitCost: 100, gstRate: 18, taxAmount: 180, lineTotal: 1180 },
  ],
};

describe("PurchaseView (purchase order) — purchases created from the order", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists every purchase number the order was received into", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/PurchaseOrder/GetPurchaseOrderByUKey/po-1")) {
        return jsonResponse({
          status: 200,
          data: { ...baseOrder, purchases: [{ documentId: 90, documentNumber: "PUR00021", createdAt: "2026-10-03T09:00:00" }] },
        });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<PurchaseView documentMode uKey="po-1" onClose={() => {}} />);

    const table = await screen.findByTestId("linked-purchases");
    expect(screen.getByText("Purchases From This Order (1)")).toBeInTheDocument();
    expect(within(table).getByText("PUR00021")).toBeInTheDocument();
  });

  it("says the order is not converted yet when it has no linked purchases", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/PurchaseOrder/GetPurchaseOrderByUKey/po-1")) {
        return jsonResponse({ status: 200, data: { ...baseOrder, status: "CONFIRMED", purchases: [] } });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<PurchaseView documentMode uKey="po-1" onClose={() => {}} />);

    expect(await screen.findByTestId("linked-purchases-empty")).toHaveTextContent("Not converted to a purchase yet.");
  });

  it("does not show the linked-purchases section on a plain purchase", async () => {
    apiClient.mockReturnValue(
      jsonResponse({ status: 200, data: { ...baseOrder, purchaseNumber: "PUR00021", items: [] } })
    );

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    await screen.findByText("Sunrise Distributors");
    expect(screen.queryByText(/Purchases From This Order/)).not.toBeInTheDocument();
  });
});
