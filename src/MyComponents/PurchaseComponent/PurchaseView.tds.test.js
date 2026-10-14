import { render, screen } from "@testing-library/react";
import PurchaseView from "./PurchaseView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const basePurchase = {
  id: 1,
  uKey: "purchase-1",
  purchaseNumber: "PUR00001",
  supplierName: "Acme Supplier",
  supplierCode: "SUP001",
  supplierInvoiceNumber: "SUPINV-1",
  invoiceDate: "2026-03-15",
  totalAmount: 1000,
  totalTax: 180,
  totalDiscount: 0,
  netAmount: 1180,
  paymentStatus: "PAID",
  amountPaid: 1180,
  remainingAmount: 0,
  items: [
    { productName: "Amoxicillin", batchNumber: "B1", quantity: 10, costPrice: 100, mrp: 150, gstRate: 18 },
  ],
};

describe("PurchaseView — TDS (194Q)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows no TDS/Net Payable rows when the purchase has no TDS", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { ...basePurchase, tdsAmount: 0 } }));

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    await screen.findByText("Acme Supplier");
    expect(screen.queryByText(/TDS/)).not.toBeInTheDocument();
    expect(screen.queryByText("Net Payable")).not.toBeInTheDocument();
  });

  it("shows TDS and Net Payable once the purchase has a nonzero TDS amount", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: { ...basePurchase, tdsAmount: 50, tdsRate: 0.1, tdsTaxableAmount: 50000, tdsSectionCode: "194Q" },
      })
    );

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    await screen.findByText("Acme Supplier");
    expect(screen.getByText(/TDS \(194Q\) @ 0.1%/)).toBeInTheDocument();
    expect(screen.getByText("Net Payable")).toBeInTheDocument();
  });
});
