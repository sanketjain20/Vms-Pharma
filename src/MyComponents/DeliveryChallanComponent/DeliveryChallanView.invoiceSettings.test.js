import { render, screen } from "@testing-library/react";
import DeliveryChallanView from "./DeliveryChallanView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const challan = {
  uKey: "dc-1",
  challanNumber: "DC000001",
  retailerName: "City Pharmacy",
  godownName: "Main Warehouse",
  challanDate: "2026-09-20",
  purpose: "SALE_PENDING_INVOICE",
  status: "INVOICED",
  salesInvoiceNumber: "INV000010",
  billingMode: "ONLINE",
  paymentType: "PARTIAL",
  dueDate: "2026-10-20",
  amountPaid: 40,
  totalDiscount: 5,
  autoApplySchemes: false,
  items: [
    { id: 10, productId: 101, productName: "Paracetamol 500mg", batchNumber: "BCH0001", quantity: 3, unitPrice: 25, gstRate: 12 },
  ],
};

describe("DeliveryChallanView — invoice settings and linked invoice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the stored invoice settings, the line GST and the sales invoice number", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: challan }));

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    expect(await screen.findByTestId("challan-sales-invoice")).toHaveTextContent("INV000010");
    expect(screen.getByText("Online / UPI")).toBeInTheDocument();
    expect(screen.getByText("PARTIAL")).toBeInTheDocument();
    expect(screen.getByText("2026-10-20")).toBeInTheDocument();
    expect(screen.getByText("₹40.00")).toBeInTheDocument();
    expect(screen.getByText("₹5.00")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("says the challan is not invoiced yet when it has no sales invoice", async () => {
    apiClient.mockReturnValue(
      jsonResponse({ status: 200, data: { ...challan, status: "ISSUED", salesInvoiceNumber: null } })
    );

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    expect(await screen.findByTestId("challan-sales-invoice")).toHaveTextContent("Not invoiced yet");
  });
});
