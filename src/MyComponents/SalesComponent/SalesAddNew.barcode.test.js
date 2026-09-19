import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesAddNew from "./SalesAddNew";
import apiClient from "../../Config/apiClient";
import { toast } from "react-toastify";

jest.mock("../../Config/apiClient");
jest.mock("react-toastify", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
  ToastContainer: () => null,
}));

function jsonResponse(body) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

const PRODUCTS = [
  { id: 1, name: "Paracetamol", barcode: "8901234567890", productTypeId: 10, sellingPrice: 50, stock: 20 },
];

function mockApi({ barcodeLookup = {} } = {}) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Retailer/Dropdown")) return jsonResponse({ data: [] });
    if (url.includes("/api/ProductType/GetAllProductType")) return jsonResponse({ data: { productTypes: [{ id: 10, name: "Tablets" }] } });
    if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ data: PRODUCTS });
    if (url.includes("/api/Product/GetProductByBarcode/")) {
      const code = decodeURIComponent(url.split("/").pop());
      const hit = barcodeLookup[code];
      return jsonResponse(hit ? { status: 200, data: hit } : { status: 404, message: "No product found for this barcode." });
    }
    return jsonResponse({ status: 200, data: null });
  });
}

async function openCatalog() {
  render(<SalesAddNew onClose={jest.fn()} onSubmit={jest.fn()} />);
  return screen.findByPlaceholderText("Scan barcode…");
}

function scan(input, code) {
  fireEvent.change(input, { target: { value: code } });
  fireEvent.submit(input.closest("form"));
}

describe("SalesAddNew (Quick Sale) — barcode scan-to-select", () => {
  beforeEach(() => jest.clearAllMocks());

  it("filters the catalog down to the scanned product without adding it to the cart", async () => {
    mockApi({});
    const input = await openCatalog();

    scan(input, "8901234567890");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search products by name…")).toHaveValue("Paracetamol");
    });
    expect(toast.success).toHaveBeenCalledWith("Paracetamol selected");
    // still just the "Add to cart" button — no quantity was picked by the scan
    expect(screen.getByRole("button", { name: /Add to cart/i })).toBeInTheDocument();
    expect(screen.queryByText("Cart is empty")).toBeInTheDocument();
  });

  it("falls back to the barcode API for a product not yet in the loaded catalog", async () => {
    mockApi({
      barcodeLookup: { "9998887776665": { id: 2, name: "Ibuprofen", barcode: "9998887776665", productTypeId: 10, sellingPrice: 80, stock: 5 } },
    });
    const input = await openCatalog();

    scan(input, "9998887776665");

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search products by name…")).toHaveValue("Ibuprofen");
    });
    expect(toast.success).toHaveBeenCalledWith("Ibuprofen selected");
  });

  it("adds to the cart, with quantity 1, only once the user clicks Add to cart themselves", async () => {
    mockApi({});
    const input = await openCatalog();

    scan(input, "8901234567890");
    await waitFor(() => screen.getByPlaceholderText("Search products by name…"));

    fireEvent.click(screen.getByRole("button", { name: /Add to cart/i }));

    expect(await screen.findByText("₹50.00")).toBeInTheDocument();
    expect(screen.queryByText("Cart is empty")).not.toBeInTheDocument();
  });

  it("shows an error toast and selects nothing when the barcode matches no product", async () => {
    mockApi({});
    const input = await openCatalog();

    scan(input, "0000000000");

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No product found for barcode "0000000000"');
    });
    expect(screen.getByPlaceholderText("Search products by name…")).toHaveValue("");
  });
});
