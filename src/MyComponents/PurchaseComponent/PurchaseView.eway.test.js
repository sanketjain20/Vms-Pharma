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
  items: [],
};

describe("PurchaseView — E-Way Bill status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a Generate E-Way Bill button when no e-way bill exists yet", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { ...basePurchase, ewayBillStatus: "NOT_APPLICABLE" } }));

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    expect(await screen.findByRole("button", { name: "Generate E-Way Bill" })).toBeInTheDocument();
  });

  it("shows the e-way bill number/status and hides the generate button once generated", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: { ...basePurchase, ewayBillStatus: "GENERATED", ewayBillNo: "123456789012" },
      })
    );

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    expect(await screen.findByText(/E-Way Bill: GENERATED · 123456789012/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate E-Way Bill" })).not.toBeInTheDocument();
  });

  it("still offers to retry generation after a failed attempt", async () => {
    apiClient.mockReturnValue(
      jsonResponse({
        status: 200,
        data: { ...basePurchase, ewayBillStatus: "FAILED", ewayError: "Portal rejected the request" },
      })
    );

    render(<PurchaseView uKey="purchase-1" onClose={() => {}} />);

    expect(await screen.findByText(/E-Way Bill: FAILED/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate E-Way Bill" })).toBeInTheDocument();
  });
});
