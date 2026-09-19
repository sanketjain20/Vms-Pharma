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

describe("SalesView — E-Invoice / E-Way Bill status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows no E-Invoice card for a NOT_APPLICABLE (B2C) sale", async () => {
    mockApi({
      sale: baseSale,
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.queryByText("E-Invoice (IRN)")).not.toBeInTheDocument();
  });

  it("shows a Generate IRN button when the sale is a pending B2B invoice", async () => {
    mockApi({
      sale: baseSale,
      eInvoice: { salesUKey: "sale-1", irnStatus: "PENDING" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText("PENDING")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate IRN" })).toBeInTheDocument();
  });

  it("shows a Cancel IRN button (not Generate) once the IRN is generated and within the cancel window", async () => {
    mockApi({
      sale: baseSale,
      eInvoice: {
        salesUKey: "sale-1",
        irnStatus: "GENERATED",
        irn: "a".repeat(64),
        cancellable: true,
      },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText("GENERATED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel IRN" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate IRN" })).not.toBeInTheDocument();
  });

  it("renders the E-Way Bill status badge and number when present on the sale", async () => {
    mockApi({
      sale: { ...baseSale, ewayBillStatus: "GENERATED", ewayBillNo: "123456789012" },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByText("E-Way Bill")).toBeInTheDocument();
    expect(screen.getByText("GENERATED")).toBeInTheDocument();
    expect(screen.getByText("123456789012")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate E-Way Bill" })).not.toBeInTheDocument();
  });

  it("offers Generate E-Way Bill when the sale has no e-way bill yet", async () => {
    mockApi({
      sale: { ...baseSale, ewayBillStatus: "NOT_APPLICABLE" },
      eInvoice: { salesUKey: "sale-1", irnStatus: "NOT_APPLICABLE" },
    });

    render(<SalesView uKey="sale-1" onClose={() => {}} />);

    await screen.findByText(/Invoice · INV00001/i);
    expect(screen.getByRole("button", { name: "Generate E-Way Bill" })).toBeInTheDocument();
  });
});
