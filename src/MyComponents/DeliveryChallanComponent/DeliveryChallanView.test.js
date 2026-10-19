import { render, screen, waitFor } from "@testing-library/react";
import DeliveryChallanView from "./DeliveryChallanView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const challanResponse = {
  uKey: "dc-1",
  challanNumber: "DC000001",
  retailerId: 5,
  retailerName: "City Pharmacy",
  godownId: 1,
  godownName: "Main Warehouse",
  salesOrderUKey: "so-123",
  challanDate: "2026-09-20",
  purpose: "SALE_PENDING_INVOICE",
  status: "ISSUED",
  vehicleNumber: "MH12AB1234",
  transporter: "FastTrans Logistics",
  notes: "Fragile goods",
  totalValue: 150.0,
  items: [
    { id: 10, productId: 101, productName: "Paracetamol 500mg", batchNumber: "BCH0001", expiryDate: "2027-01-01", quantity: 3, unitPrice: 25.00, returnedQuantity: 0, outstandingQuantity: 3 },
    { id: 11, productId: 102, productName: "Ibuprofen 200mg", batchNumber: "BCH0002", expiryDate: "2027-06-30", quantity: 5, unitPrice: 15.00, returnedQuantity: 2, outstandingQuantity: 3 },
  ],
};

describe("DeliveryChallanView — detail display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function waitForLoaded() {
    await waitFor(() => {
      expect(screen.queryByText(/Loading delivery challan/i)).not.toBeInTheDocument();
    });
  }

  it("fetches GetDeliveryChallanByUKey and shows spinner until loaded", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/DeliveryChallan/GetDeliveryChallanByUKey/dc-1")) return jsonResponse({ status: 200, data: challanResponse });
      return jsonResponse({ status: 200, data: null });
    });

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    // Spinner first.
    expect(await screen.findByText(/Loading delivery challan/i)).toBeInTheDocument();

    await waitForLoaded();
    expect(screen.getByText("DC000001")).toBeInTheDocument();
  });

  it("renders all meta cards (retailer, godown, date, purpose, vehicle, transporter, status, total value)", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: challanResponse }));

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    await waitForLoaded();
    expect(screen.getByText("DC000001")).toBeInTheDocument();

    expect(screen.getByText("Retailer")).toBeInTheDocument();
    expect(screen.getByText("City Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("Godown")).toBeInTheDocument();
    expect(screen.getByText("Main Warehouse")).toBeInTheDocument();
    expect(screen.getByText("Challan date")).toBeInTheDocument();
    expect(screen.getByText("2026-09-20")).toBeInTheDocument();
    expect(screen.getByText("Purpose")).toBeInTheDocument();
    expect(screen.getByText("SALE_PENDING_INVOICE")).toBeInTheDocument();
    expect(screen.getByText("Vehicle number")).toBeInTheDocument();
    expect(screen.getByText("MH12AB1234")).toBeInTheDocument();
    expect(screen.getByText("Transporter")).toBeInTheDocument();
    expect(screen.getByText("FastTrans Logistics")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("ISSUED")).toBeInTheDocument();
    expect(screen.getByText("Total value")).toBeInTheDocument();
    expect(screen.getByText("₹150.00")).toBeInTheDocument();
  });

  it("renders the line table with product, batch, expiry, qty, unit price, line total", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: challanResponse }));

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    await waitForLoaded();

    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
    expect(screen.getByText("BCH0001")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01")).toBeInTheDocument();
    // Qty 3 in the table, and 5
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("₹25.00")).toBeInTheDocument();
    // 3 * 25 = 75 and 5 * 15 = 75 (both show ₹75.00)
    const lineTotals = screen.getAllByText("₹75.00");
    expect(lineTotals.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("Ibuprofen 200mg")).toBeInTheDocument();
    expect(screen.getByText("BCH0002")).toBeInTheDocument();
    expect(screen.getByText("₹15.00")).toBeInTheDocument();
  });

  it("renders Notes when present", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: challanResponse }));

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    await waitForLoaded();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Fragile goods")).toBeInTheDocument();
  });

  it("does NOT render an Edit button (DC has no update endpoint)", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: challanResponse }));

    render(<DeliveryChallanView uKey="dc-1" onClose={() => {}} />);

    await waitForLoaded();
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
  });
});
