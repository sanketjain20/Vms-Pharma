import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DeliveryChallanAdd from "./DeliveryChallanAdd";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const retailerDropdown = [
  { id: 5, name: "City Pharmacy", shopName: "City Pharmacy" },
  { id: 6, name: "Meds Mart", shopName: "Meds Mart" },
];
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
    const spinner = screen.queryByText(/Loading retailer, godowns and products/i);
    expect(spinner).not.toBeInTheDocument();
    fn();
  });
}

describe("DeliveryChallanAdd — dropdown latency fix", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches only retailer + godowns + products (not supplier / productType / invoice / payment)", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ status: 200, data: retailerDropdown });
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      return jsonResponse({ status: 200, data: null });
    });

    render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);

    // Spinner shows until catalogs resolve.
    expect(await screen.findByText(/Loading retailer, godowns and products/i)).toBeInTheDocument();

    await waitForCatalogs();

    const calledUrls = apiClient.mock.calls.map(([url]) => url);

    // The three endpoints it actually needs.
    expect(calledUrls.some((u) => u.includes("/api/Retailer/Dropdown"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/Godown/GetGodownDropdown"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/Product/GetAllProduct"))).toBe(true);

    // Must NOT fetch the irrelevant endpoints.
    expect(calledUrls.some((u) => u.includes("/api/Supplier/GetSupplierDropdown"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/ProductType/GetAllProductType"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Invoice"))).toBe(false);
    expect(calledUrls.some((u) => u.includes("/api/Payment"))).toBe(false);
  });

  it("disables submit while loading and re-enables once catalogs resolve", async () => {
    let resolveRetailer;
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Retailer/Dropdown")) {
        return new Promise(r => { resolveRetailer = r; });
      }
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      return jsonResponse({ status: 200, data: null });
    });

    render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);

    const submit = await screen.findByRole("button", { name: /Save Delivery Challan/i });
    expect(submit).toBeDisabled();

    resolveRetailer(jsonResponse({ status: 200, data: retailerDropdown }));

    await waitFor(() => {
      expect(submit).not.toBeDisabled();
    });
  });

  it("validates required fields and item rules before POSTing", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ status: 200, data: retailerDropdown });
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);

    await waitForCatalogs();

    // Click Save without filling anything.
    const submit = screen.getByRole("button", { name: /Save Delivery Challan/i });
    fireEvent.click(submit);

    await waitFor(() => {
      const postCall = apiClient.mock.calls.find(
        ([url, options]) => options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")
      );
      expect(postCall).toBeUndefined();
    });
  });

  it("POSTs AddDeliveryChallan with unitPrice per item (DC DTO shape)", async () => {
    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ status: 200, data: retailerDropdown });
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      if (options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")) {
        return jsonResponse({ status: 200, data: {} });
      }
      return jsonResponse({ status: 200, data: null });
    });

    const { container } = render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);

    // Wait for catalogs.
    await waitForCatalogs();

    // Select retailer — the placeholder text appears on the SearchDrop face.
    fireEvent.click(screen.getByText("Search retailers…"));
    await screen.findByText("City Pharmacy");
    fireEvent.mouseDown(await screen.findByText("City Pharmacy"));

    // Select godown.
    fireEvent.click(screen.getByText("Search godowns…"));
    await screen.findByText("Main Warehouse");
    fireEvent.mouseDown(screen.getByText("Main Warehouse"));

    // Switch to Items tab to reveal the product SearchDrop.
    fireEvent.click(screen.getByText(/Items/));

    // Select product.
    fireEvent.click(screen.getByText("Select product"));
    await screen.findByText("Paracetamol 500mg");
    fireEvent.mouseDown(screen.getByText("Paracetamol 500mg"));

    // Enter quantity and unit price — these are the two number inputs in the item card.
    const inputs = container.querySelectorAll('input[type="number"]');
    const qtyInput = inputs[0];
    const priceInput = inputs[1];
    fireEvent.change(qtyInput, { target: { value: "3" } });
    fireEvent.change(priceInput, { target: { value: "12.50" } });

    // Save.
    fireEvent.click(screen.getByRole("button", { name: /Save Delivery Challan/i }));

    await waitFor(() => {
      const postCall = apiClient.mock.calls.find(
        ([url, options]) => options?.method === "POST" && url.includes("/api/DeliveryChallan/AddDeliveryChallan")
      );
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body).toMatchObject({
        retailerId: 5,
        godownId: 1,
        challanDate: expect.any(String),
        purpose: "SALE_PENDING_INVOICE",
        vehicleNumber: null,
        transporter: null,
        notes: expect.any(String),
        items: [{ productId: 101, quantity: 3, unitPrice: 12.5 }],
      });
    });
  });

  it("does NOT call any UpdateDeliveryChallan endpoint (no edit for DC)", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ status: 200, data: retailerDropdown });
      if (url.includes("/api/Godown/GetGodownDropdown")) return jsonResponse({ status: 200, data: godownDropdown });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: productList });
      return jsonResponse({ status: 200, data: null });
    });

    render(<DeliveryChallanAdd onSubmit={() => {}} onClose={() => {}} />);

    await waitForCatalogs();

    const calledUrls = apiClient.mock.calls.map(([url]) => url);
    expect(calledUrls.some((u) => u.includes("/api/DeliveryChallan/UpdateDeliveryChallan"))).toBe(false);
  });
});
