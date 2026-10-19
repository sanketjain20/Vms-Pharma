import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StockTransferAdd from "./StockTransferAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const godownDropdown = [
  { id: 1, name: "Main Warehouse" },
  { id: 2, name: "Regional Store" },
];
const productList = [
  { id: 101, name: "Paracetamol 500mg" },
  { id: 102, name: "Ibuprofen 200mg" },
];

/** Helper: wait until the loading spinner is gone (catalogs loaded). */
function waitForCatalogs(fn = () => {}) {
  return waitFor(() => {
    // The spinner text disappears once all catalogs resolve.
    const spinner = screen.queryByText(/Loading godowns and products/i);
    expect(spinner).not.toBeInTheDocument();
    fn();
  });
}

describe("StockTransferAdd — dropdown latency fix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches only godowns + products (never supplier / invoice / payment endpoints)", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferAdd onSubmit={() => {}} onClose={() => {}} />);

    // Spinner shows until catalogs resolve.
    expect(await screen.findByText(/Loading godowns and products/i)).toBeInTheDocument();

    await waitForCatalogs();

    const calledUrls = apiClient.mock.calls.map(([url]) => url);

    // The two endpoints it actually needs.
    expect(calledUrls.some((u) => u.includes("/api/Godown/GetGodownDropdown"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/Product/GetAllProduct"))).toBe(true);

    // The four endpoints it must NOT touch (the old generic form fetched all 5).
    expect(calledUrls.some((u) => u.includes("/api/Supplier/GetSupplierDropdown"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Retailer/Dropdown"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/ProductType/GetAllProductType"))).toBe(false);

    // Supplier / invoice / payment URL fragments that don't exist for ST.
    expect(calledUrls.some((u) => u.includes("/api/Invoice"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Payment"))).toBe(false);
  });

  it("disables the submit button while the catalog is loading", async () => {
    let resolveProducts;
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) {
        return new Promise(r => { resolveProducts = r; }); // never resolves during this test
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferAdd onSubmit={() => {}} onClose={() => {}} />);

    // While still loading, submit is disabled.
    const submit = await screen.findByRole("button", { name: /Save Stock Transfer/i });
    expect(submit).toBeDisabled();

    // Resolve the pending product call to let the test finish cleanly.
    resolveProducts(jsonResponse({ status: 200, data: productList }));
  });

  it("validates from ≠ to godown and at least one item before POSTing", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (options?.method === "POST" && url.includes("/api/StockTransfer/AddStockTransfer")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<StockTransferAdd onSubmit={() => {}} onClose={() => {}} />);

    await waitForCatalogs();

    // Click Save without selecting anything — should NOT POST.
    const submit = screen.getByRole("button", { name: /Save Stock Transfer/i });
    fireEvent.click(submit);

    await waitFor(() => {
      const postCall = apiClient.mock.calls.find(
        ([url, options]) => options?.method === "POST" && url.includes("/api/StockTransfer/AddStockTransfer")
      );
      expect(postCall).toBeUndefined();
    });
  });

  it("sends the correct ST payload shape on successful save", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (options?.method === "POST" && url.includes("/api/StockTransfer/AddStockTransfer")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    const { container } = render(<StockTransferAdd onSubmit={() => {}} onClose={() => {}} />);

    // Wait for catalogs.
    await waitForCatalogs();

    // Select from godown — the placeholder text appears on the SearchDrop face.
    fireEvent.click(screen.getAllByText("Search godowns…")[0]);
    await screen.findByText("Main Warehouse");
    fireEvent.mouseDown(screen.getByText("Main Warehouse"));

    // Select to godown — after From is chosen, only the To SearchDrop still shows the placeholder.
    await screen.findByText("Search godowns…");
    fireEvent.click(screen.getAllByText("Search godowns…")[0]);
    await screen.findByText("Regional Store");
    fireEvent.mouseDown(screen.getByText("Regional Store"));

    // Switch to Items tab to reveal the product SearchDrop.
    fireEvent.click(screen.getByText(/Items/));

    // Select product.
    fireEvent.click(screen.getByText("Select product"));
    await screen.findByText("Paracetamol 500mg");
    fireEvent.mouseDown(screen.getByText("Paracetamol 500mg"));

    // Enter quantity.
    const qtyInput = container.querySelector('input[type="number"]');
    fireEvent.change(qtyInput, { target: { value: "5" } });

    // Save.
    fireEvent.click(screen.getByRole("button", { name: /Save Stock Transfer/i }));

    await waitFor(() => {
      const postCall = apiClient.mock.calls.find(
        ([url, options]) => options?.method === "POST" && url.includes("/api/StockTransfer/AddStockTransfer")
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body).toMatchObject({
        fromGodownId: 1,
        toGodownId: 2,
        transferDate: expect.any(String),
        vehicleNumber: null,
        notes: expect.any(String),
        items: [{ productId: 101, quantity: 5 }],
      });
    });
  });
});
