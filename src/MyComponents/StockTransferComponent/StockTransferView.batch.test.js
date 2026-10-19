import { render, screen, within } from "@testing-library/react";
import StockTransferView from "./StockTransferView";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const transfer = (status, items) => ({
  uKey: "st-1", transferNumber: "ST000001", fromGodownName: "Main Warehouse", toGodownName: "Regional Store",
  transferDate: "2026-10-01", status, vehicleNumber: "GJ01", items,
});

describe("StockTransferView — batch number and expiry per line", () => {
  beforeEach(() => jest.clearAllMocks());

  it("on a draft, shows the batch dispatch will take, marked as planned, with its expiry", async () => {
    apiClient.mockReturnValue(jsonResponse({
      status: 200,
      data: transfer("DRAFT", [
        { id: 1, productId: 5, productName: "Paracetamol", quantity: 45, batchNumber: "B1, B2", expiryDate: "2027-03-31", batchPlanned: true },
      ]),
    }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    const cell = await screen.findByTestId("transfer-batch");
    expect(cell).toHaveTextContent("B1, B2");
    expect(within(cell).getByText("planned")).toBeInTheDocument();
    expect(screen.getByText("2027-03-31")).toBeInTheDocument();
  });

  it("after dispatch, shows each row's own batch without the planned mark", async () => {
    apiClient.mockReturnValue(jsonResponse({
      status: 200,
      data: transfer("IN_TRANSIT", [
        { id: 1, productId: 5, productName: "Paracetamol", quantity: 30, batchNumber: "B1", expiryDate: "2027-03-31", batchPlanned: false },
        { id: 2, productId: 5, productName: "Paracetamol", quantity: 15, batchNumber: "B2", expiryDate: "2027-06-30", batchPlanned: false },
      ]),
    }));

    render(<StockTransferView uKey="st-1" onClose={() => {}} />);

    const cells = await screen.findAllByTestId("transfer-batch");
    expect(cells.map((c) => c.textContent.trim())).toEqual(["B1", "B2"]);
    expect(screen.queryByText("planned")).not.toBeInTheDocument();
    expect(screen.getByText("2027-06-30")).toBeInTheDocument();
  });
});
