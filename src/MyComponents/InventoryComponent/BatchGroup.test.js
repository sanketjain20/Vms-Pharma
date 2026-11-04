import { render, screen, within, waitFor } from "@testing-library/react";
import BatchView from "./BatchView";
import { batchColumns } from "./Batch";
import StockAdjustmentView from "../StockAdjustmentComponent/StockAdjustmentView";
import apiClient from "../../Config/apiClient";
import { resetBusinessProfile } from "../../utils/businessProfile";

jest.mock("../../Config/apiClient");
const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const GROUP = {
  uKey: "u1", batchNumber: "BCH000012", purchaseNumber: "TES-PUR000009", supplier: "Gadget Hub", productCount: 2,
  products: ["Phone X", "Cable"], purchased: 13, available: 5, expiryDate: null, lines: [
    { uKey: "u1", productName: "Phone X", productCode: "PRD000001", godownName: "Main", originalQuantity: 3, quantity: 1, quantitySold: 2, costPrice: 9000, mrp: 12000 },
    { uKey: "u2", productName: "Cable", productCode: "PRD000002", godownName: "Main", originalQuantity: 10, quantity: 4, quantitySold: 6, costPrice: 100, mrp: 200 },
  ],
};

describe("Batches: one row per batch number, the view lists its products", () => {
  beforeEach(() => { jest.clearAllMocks(); resetBusinessProfile(); });

  it("the grid's columns are per batch number (no product column)", () => {
    const headers = batchColumns(false).map((c) => c.header);
    expect(headers).toEqual(["Batch No", "Purchase No", "Supplier", "Products", "Purchased Qty", "Available Qty", "Action"]);
    expect(batchColumns(true).map((c) => c.header)).toContain("Earliest Expiry");
  });

  it("the view shows the purchase, totals and every product received under the number", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/BusinessSetting/Get")) return ok({ status: 200, data: { businessType: "ELECTRONICS", trackExpiry: false, isPharma: false } });
      if (url.includes("/api/Batch/GetBatchGroup/u1")) return ok({ status: 200, data: GROUP });
      return ok({ status: 200, data: null });
    });
    render(<BatchView uKey="u1" onClose={jest.fn()} />);
    const table = await screen.findByTestId("batch-lines");
    expect(screen.getAllByText("BCH000012").length).toBeGreaterThan(0);
    expect(screen.getByText("TES-PUR000009")).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + 2 products
    expect(rows[2]).toHaveTextContent("Cable");
    expect(rows[2]).toHaveTextContent("Main");
    await waitFor(() => expect(within(table).queryByText("Expiry")).not.toBeInTheDocument());
  });
});

describe("Stock Adjustment > View", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads the adjustment by its id and shows the type, change and note", async () => {
    apiClient.mockImplementation((url) => (url.includes("/api/Inventory/StockMovement/7")
      ? ok({ status: 200, data: { id: 7, productName: "Phone X", inventoryCode: "INV000050", movementType: "BREAKAGE", quantity: 2,
        oldQuantity: 10, newQuantity: 8, unitCostPrice: 9000, note: "Breakage: dropped", createdAt: "2026-10-26T10:00:00" } })
      : ok({ status: 200, data: null })));
    render(<StockAdjustmentView uKey={7} onClose={jest.fn()} />);
    expect(await screen.findByTestId("adjustment-type")).toHaveTextContent("Breakage");
    expect(screen.getByTestId("adjustment-change")).toHaveTextContent("-2");
    expect(screen.getByText("INV000050")).toBeInTheDocument();
    expect(screen.getByText("Breakage: dropped")).toBeInTheDocument();
  });
});
