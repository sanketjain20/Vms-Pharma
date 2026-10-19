import { render, screen, within } from "@testing-library/react";
import PurchaseView from "./PurchaseView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("PurchaseView (purchase order) — batch details saved on the order", () => {
  it("shows the batch number, MFG date, expiry and MRP entered on the order line", async () => {
    apiClient.mockReturnValue(jsonResponse({
      status: 200,
      data: {
        uKey: "po-1", orderNumber: "PO000003", supplierName: "Sunrise Distributors", orderDate: "2026-10-01",
        status: "CONFIRMED", paymentStatus: "CREDIT", amountPaid: 0, totalAmount: 80, totalTax: 9.6, netAmount: 89.6,
        purchases: [],
        items: [
          { id: 1, productId: 101, productName: "Amoxicillin", quantity: 10, receivedQuantity: 0, pendingQuantity: 10,
            unitCost: 8, gstRate: 12, taxAmount: 9.6, lineTotal: 89.6,
            batchNumber: "BN-77", manufacturingDate: "2026-09-01", expiryDate: "2028-08-31", mrp: 15 },
        ],
      },
    }));

    render(<PurchaseView documentMode uKey="po-1" onClose={() => {}} />);

    const row = (await screen.findByText("BN-77")).closest("tr");
    expect(within(row).getByText("2026-09-01")).toBeInTheDocument();
    expect(within(row).getByText("2028-08-31")).toBeInTheDocument();
    // MRP comes from the line, not the unit cost
    expect(within(row).getByText(/15/)).toBeInTheDocument();
  });
});
