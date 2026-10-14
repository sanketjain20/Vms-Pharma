import { render, screen, waitFor } from "@testing-library/react";
import StockTransferView from "./StockTransferView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const transferResponse = {
  uKey: "st-1",
  transferNumber: "ST000001",
  fromGodownId: 1,
  fromGodownName: "Main Warehouse",
  toGodownId: 3,
  toGodownName: "North Depot",
  transferDate: "2026-09-20",
  status: "DRAFT",
  vehicleNumber: "MH12AB1234",
  notes: "Urgent transfer",
  items: [
    { id: 10, productId: 101, productName: "Paracetamol 500mg", quantity: 5, batchNumber: "BCH0001" },
    { id: 11, productId: 102, productName: "Ibuprofen 200mg", quantity: 10, batchNumber: "BCH0002" },
  ],
};

describe("StockTransferView — detail display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches GetStockTransferByUKey and shows a spinner until loaded", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/StockTransfer/GetStockTransferByUKey/st-1")) return jsonResponse({ status: 200, data: transferResponse });
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    // Spinner first.
    expect(await screen.findByText(/Loading stock transfer/i)).toBeInTheDocument();

    // After load, spinner disappears and content appears.
    await waitFor(() => {
      expect(screen.queryByText(/Loading stock transfer/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText("ST000001")).toBeInTheDocument();
  });

  it("renders the meta cards (from/to godown, date, vehicle, status, total units)", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: transferResponse }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    // Wait for spinner to go away and content to appear.
    await waitFor(() => {
      expect(screen.queryByText(/Loading stock transfer/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText("ST000001")).toBeInTheDocument();

    // Meta card labels + values.
    expect(screen.getByText("From godown")).toBeInTheDocument();
    expect(screen.getByText("Main Warehouse")).toBeInTheDocument();
    expect(screen.getByText("To godown")).toBeInTheDocument();
    expect(screen.getByText("North Depot")).toBeInTheDocument();
    expect(screen.getByText("Transfer date")).toBeInTheDocument();
    expect(screen.getByText("2026-09-20")).toBeInTheDocument();
    expect(screen.getByText("Vehicle number")).toBeInTheDocument();
    expect(screen.getByText("MH12AB1234")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("Total units")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument(); // totalUnits = 5 + 10
  });

  it("renders the line table with product, qty, batch", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: transferResponse }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading stock transfer/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
    expect(screen.getByText("BCH0001")).toBeInTheDocument();
    expect(screen.getByText("Ibuprofen 200mg")).toBeInTheDocument();
    expect(screen.getByText("BCH0002")).toBeInTheDocument();
  });

  it("shows the Edit button only when status is DRAFT", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: transferResponse }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading stock transfer/i)).not.toBeInTheDocument();
    });

    // DRAFT status → Edit button present.
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  it("hides the Edit button when status is NOT DRAFT", async () => {
    apiClient.mockReturnValue(jsonResponse({ status: 200, data: { ...transferResponse, status: "RECEIVED" } }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} onEdit={() => {}} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading stock transfer/i)).not.toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
  });
});
