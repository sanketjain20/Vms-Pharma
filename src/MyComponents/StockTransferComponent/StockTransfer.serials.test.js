import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import StockTransferAdd from "./StockTransferAdd";
import StockAdjustmentAdd from "../StockAdjustmentComponent/StockAdjustmentAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const call = (path) => apiClient.mock.calls.find(([u, o]) => u.includes(path) && o?.method === "POST");

const PRODUCTS = [{ id: 7, name: "Phone X", trackSerial: true }, { id: 8, name: "USB Cable" }];

describe("Moving and writing off units of a product with serial numbers (Phase 7)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("a stock transfer picks the units from the source godown; the quantity follows them", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return ok({ status: 200, data: [{ id: 1, name: "Main" }, { id: 2, name: "Branch" }] });
      if (url.includes("/api/Product/GetAllProduct")) return ok({ status: 200, data: PRODUCTS });
      if (url.includes("/api/Serial/InStock/7?godownId=1")) return ok({ status: 200, data: [{ serialNo: "IMEI1" }, { serialNo: "IMEI2" }] });
      if (url.includes("/api/StockTransfer/AddStockTransfer")) return ok({ status: 200, data: {} });
      return ok({ status: 200, data: null });
    });
    render(<StockTransferAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText(/Loading godowns and products/i)).not.toBeInTheDocument());
    fireEvent.click(screen.getAllByText("Search godowns…")[0]);
    fireEvent.mouseDown(await screen.findByText("Main"));
    fireEvent.click(screen.getAllByText("Search godowns…")[0]);
    fireEvent.mouseDown(await screen.findByText("Branch"));
    fireEvent.click(screen.getByText(/Items/));
    fireEvent.click(screen.getByText("Select product"));
    fireEvent.mouseDown(await screen.findByText("Phone X"));

    const qty = screen.getByLabelText("Quantity");
    expect(qty).toBeDisabled();
    const picker = await screen.findByTestId("line-serials");
    fireEvent.click(await within(picker).findByRole("button", { name: /^IMEI2/ }));
    expect(qty).toHaveValue(1);

    fireEvent.click(screen.getByRole("button", { name: /Save Stock Transfer/i }));
    await waitFor(() => expect(call("/api/StockTransfer/AddStockTransfer")).toBeDefined());
    expect(JSON.parse(call("/api/StockTransfer/AddStockTransfer")[1].body).items).toEqual([{ productId: 7, quantity: 1, serials: ["IMEI2"] }]);
  });

  it("a breakage names the units written off; the count of such a product can't simply be set", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Inventory/GetAllInventory")) {
        return ok({ status: 200, data: [{ id: 50, inventoryCode: "INV1", productId: 7, productName: "Phone X", godownId: 1 }] });
      }
      if (url.includes("/api/Product/GetAllProduct")) return ok({ status: 200, data: PRODUCTS });
      if (url.includes("/api/Serial/InStock/7?godownId=1")) return ok({ status: 200, data: [{ serialNo: "IMEI1" }, { serialNo: "IMEI2" }] });
      if (url.includes("/api/Inventory/StockAdjustment")) return ok({ status: 200, message: "done" });
      return ok({ status: 200, data: null });
    });
    render(<StockAdjustmentAdd onSubmit={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Product/GetAllProduct"))).toBe(true));
    await waitFor(() => expect(apiClient.mock.calls.some(([u]) => u.includes("/api/Inventory/GetAllInventory"))).toBe(true));
    fireEvent.click(screen.getByText("Choose inventory"));
    fireEvent.mouseDown(await screen.findByText("INV1 — Phone X"));

    const picker = await screen.findByTestId("adjust-serials");
    fireEvent.click(await within(picker).findByRole("button", { name: /^IMEI1/ }));
    expect(screen.getByPlaceholderText("Pick the units")).toHaveValue(1);
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));
    await waitFor(() => expect(call("/api/Inventory/StockAdjustment")).toBeDefined());
    expect(JSON.parse(call("/api/Inventory/StockAdjustment")[1].body)).toMatchObject({
      inventoryId: 50, adjustmentType: "BREAKAGE", quantity: 1, serials: ["IMEI1"],
    });

    apiClient.mockClear();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "OPENING_STOCK_CORRECTION" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Adjustment" }));
    expect(await screen.findByText(/counted from its units/)).toBeInTheDocument();
    expect(call("/api/Inventory/StockAdjustment")).toBeUndefined();
  });
});
