import { render, screen } from "@testing-library/react";
import SalesView from "./SalesView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const baseSale = {
  id: 1,
  uKey: "sale-1",
  invoiceNumber: "INV00001",
  totalAmount: 1000,
  totalTax: 180,
  totalDiscount: 0,
  netAmount: 1180,
  billingMode: "MEDICAL",
  createdAt: "2026-03-15",
  items: [],
  remainingAmount: 0,
};

function mockApi({ sale, eInvoice }) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Sales/GetSalesByUkey/")) return jsonResponse({ status: 200, data: sale });
    if (url.includes("/api/EInvoice/GetEInvoiceByUKey/")) return jsonResponse({ status: 200, data: eInvoice });
    return jsonResponse({ status: 200, data: null });
  });
}

describe("SalesView — TCS (historical), Retailer TDS estimate, and retailer outstanding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows no TCS row and no outstanding row for a walk-in (no retailer) sale", async () => {
    mockApi({
      sale: { ...baseSale, tcsAmount: 0, retailerId: null },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.queryByText(/TCS/)).not.toBeInTheDocument();
    expect(screen.queryByText("Retailer Outstanding")).not.toBeInTheDocument();
  });

  it("shows the TCS row once the sale has a nonzero TCS amount (historical, pre-1 Apr 2025 sales only)", async () => {
    mockApi({
      sale: { ...baseSale, tcsAmount: 30, tcsRate: 0.1, tcsSectionCode: "206C(1H)", retailerId: 7 },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText(/TCS \(206C\(1H\)\) @ 0.1%/)).toBeInTheDocument();
  });

  it("shows an informational Retailer TDS row, not folded into Net Amount, for a sale with a retailer-TDS estimate", async () => {
    mockApi({
      sale: {
        ...baseSale,
        netAmount: 1180,
        tcsAmount: 0,
        retailerTdsAmount: 1.18,
        retailerTdsRate: 0.1,
        retailerTdsSectionCode: "194Q",
        retailerId: 7,
      },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText(/Retailer TDS \(194Q\) @ 0.1% — est., withheld by them/)).toBeInTheDocument();
    expect(screen.getByText("₹1180.00")).toBeInTheDocument(); // Net Amount is untouched by the estimate
  });

  it("shows Retailer Outstanding only when the retailer has an outstanding balance", async () => {
    mockApi({
      sale: { ...baseSale, tcsAmount: 0, retailerId: 7, retailerOutstandingBalance: 45000 },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText("Retailer Outstanding")).toBeInTheDocument();
    expect(screen.getByText("₹45,000.00")).toBeInTheDocument();
  });

  it("hides Retailer Outstanding when the balance is zero even for a registered retailer", async () => {
    mockApi({
      sale: { ...baseSale, tcsAmount: 0, retailerId: 7, retailerOutstandingBalance: 0 },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.queryByText("Retailer Outstanding")).not.toBeInTheDocument();
  });
});
