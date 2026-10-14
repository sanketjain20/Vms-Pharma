import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockTransferEdit from "./StockTransferEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const godownDropdown = [
  { id: 1, name: "Main Warehouse" },
  { id: 2, name: "Regional Store" },
  { id: 3, name: "North Depot" },
];
const productList = [
  { id: 101, name: "Paracetamol 500mg" },
  { id: 102, name: "Ibuprofen 200mg" },
];
const existingTransfer = {
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
  ],
};

/** Wait until both the spinner is gone (both fetches resolved). */
async function waitForLoaded() {
  await screen.findByText("Main Warehouse"); // from-godown label from GetStockTransferByUKey
  await waitFor(() => {
    expect(screen.queryByText(/Loading transfer and options/i)).not.toBeInTheDocument();
  });
}

describe("StockTransferEdit — dual-fetch + binding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches only godowns + products + GetStockTransferByUKey (no supplier/invoice/payment)", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (url.includes("/api/StockTransfer/GetStockTransferByUKey/st-1")) return jsonResponse({ status: 200, data: existingTransfer });
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferEdit uKey="st-1" onSubmit={() => {}} onClose={() => {}} />);

    // Spinner shows while loading.
    expect(await screen.findByText(/Loading transfer and options/i)).toBeInTheDocument();

    await waitForLoaded();

    const calledUrls = apiClient.mock.calls.map(([url]) => url);
    expect(calledUrls.some((u) => u.includes("/api/Godown/GetGodownDropdown"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/Product/GetAllProduct"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/StockTransfer/GetStockTransferByUKey/st-1"))).toBe(true);

    // Must NOT fetch the irrelevant endpoints.
    expect(calledUrls.some((u) => u.includes("/api/Supplier/GetSupplierDropdown"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Retailer/Dropdown"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Invoice"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Payment"))).toBe(false);
  });

  it("binds from/to godown and items from the loaded transfer", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (url.includes("/api/StockTransfer/GetStockTransferByUKey/st-1")) return jsonResponse({ status: 200, data: existingTransfer });
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferEdit uKey="st-1" onSubmit={() => {}} onClose={() => {}} />);

    // The loaded "From godown" label must show "Main Warehouse", not the placeholder.
    expect(await screen.findByText("Main Warehouse")).toBeInTheDocument();
    // The loaded "To godown" must show "North Depot".
    expect(screen.getByText("North Depot")).toBeInTheDocument();

    // Vehicle number field is pre-filled.
    const vehicleInput = screen.getByPlaceholderText("e.g. MH12AB1234");
    expect(vehicleInput.value).toBe("MH12AB1234");
  });

  it("PUTs UpdateStockTransfer/{uKey} with the correct payload", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (url.includes("/api/StockTransfer/GetStockTransferByUKey/st-1")) return jsonResponse({ status: 200, data: existingTransfer });
      if (options?.method === "PUT" && url.includes("/api/StockTransfer/UpdateStockTransfer/st-1")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferEdit uKey="st-1" onSubmit={() => {}} onClose={() => {}} />);

    // Wait for the form to finish loading and bind.
    await waitForLoaded();

    // Click Update.
    fireEvent.click(screen.getByRole("button", { name: /Update Stock Transfer/i }));

    await waitFor(() => {
      const putCall = apiClient.mock.calls.find(
        ([url, options]) => options?.method === "PUT" && url.includes("/api/StockTransfer/UpdateStockTransfer/st-1")
      );
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body);
      expect(body).toMatchObject({
        fromGodownId: 1,
        toGodownId: 3,
        transferDate: "2026-09-20",
        vehicleNumber: "MH12AB1234",
        notes: "Urgent transfer",
        items: [{ productId: 101, quantity: 5 }],
      });
    });
  });

  it("disables Update while saving (spinner shows on button)", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (url.includes("/api/StockTransfer/GetStockTransferByUKey/st-1")) return jsonResponse({ status: 200, data: existingTransfer });
      if (options?.method === "PUT" && url.includes("/api/StockTransfer/UpdateStockTransfer/st-1")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferEdit uKey="st-1" onSubmit={() => {}} onClose={() => {}} />);

    await waitForLoaded();

    const saveBtn = screen.getByRole("button", { name: /Update Stock Transfer/i });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    // During the PUT, the button text should switch to "Updating…" and show the spinner.
    expect(await screen.findByText(/Updating…/i)).toBeInTheDocument();
    expect(saveBtn).toBeDisabled();
  });
});
