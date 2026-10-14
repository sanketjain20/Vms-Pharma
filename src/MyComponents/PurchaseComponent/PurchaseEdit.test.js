import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PurchaseEdit from "./PurchaseEdit";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");

function jsonResponse(body) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

const supplierDropdown = [
  { id: 7, shopName: "Sunrise Distributors", supplierCode: "SUP0007" },
  { id: 8, shopName: "Metro Pharma", supplierCode: "SUP0008" },
];

const existingPurchase = {
  id: 42,
  supplierId: 7,
  supplierInvoiceNumber: "SINV-100",
  invoiceDate: "2026-09-01",
  paymentStatus: "CREDIT",
  amountPaid: 0,
  items: [],
};

/**
 * Regression test for a URL typo: this component was fetching
 * "/api/suppliers/dropdown" (wrong casing/path) instead of the real
 * "/api/Supplier/GetSupplierDropdown" endpoint (see SupplierController /
 * PurchaseAdd.js, which calls it correctly). The wrong URL never matched a
 * backend route, so `suppliers` stayed empty and the Supplier field couldn't
 * bind to the purchase's existing supplierId even though it loaded fine.
 */
describe("PurchaseEdit — supplier dropdown binding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls the real Supplier dropdown endpoint", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Supplier/GetSupplierDropdown")) return jsonResponse({ status: 200, data: supplierDropdown });
      if (url.includes("/api/Purchase/GetPurchaseByUKey/")) return jsonResponse({ status: 200, data: existingPurchase });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: [] });
      return jsonResponse({ status: 200, data: null });
    });

    render(<PurchaseEdit uKey="purchase-1" onSubmit={() => {}} onClose={() => {}} />);

    await screen.findByText("Sunrise Distributors");

    const calledUrls = apiClient.mock.calls.map(([url]) => url);
    expect(calledUrls.some((u) => u.includes("/api/Supplier/GetSupplierDropdown"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("/api/suppliers/dropdown"))).toBe(false);
  });

  it("binds the existing purchase's supplier once both fetches resolve", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Supplier/GetSupplierDropdown")) return jsonResponse({ status: 200, data: supplierDropdown });
      if (url.includes("/api/Purchase/GetPurchaseByUKey/")) return jsonResponse({ status: 200, data: existingPurchase });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: [] });
      return jsonResponse({ status: 200, data: null });
    });

    render(<PurchaseEdit uKey="purchase-1" onSubmit={() => {}} onClose={() => {}} />);

    // supplierId 7 on the loaded purchase must resolve to its name, not the
    // placeholder — proves the dropdown options and the loaded form value
    // actually matched up.
    expect(await screen.findByText("Sunrise Distributors")).toBeInTheDocument();
    expect(screen.queryByText("Search supplier…")).not.toBeInTheDocument();
  });
});

/**
 * Regression test for a 403 on the update-purchase flow: the backend's
 * PUT /api/Purchase/UpdatePurchase/{uKey} requires an `updatedBy` request
 * param (like CreatePurchase requires `createdBy`, see PurchaseAdd.js).
 * This component was omitting it, so Spring rejected the missing-required-
 * param request as an unauthenticated 403 before it ever reached the
 * service layer. Fixed by reading the logged-in vendor's id from the same
 * "vmsUser" localStorage entry apiClient/VendorEdit already read.
 */
describe("PurchaseEdit — update submission", () => {
  const purchaseWithItems = {
    id: 42,
    supplierId: 7,
    supplierInvoiceNumber: "SINV-100",
    invoiceDate: "2026-09-01",
    paymentStatus: "CREDIT",
    dueDate: "2026-10-01",
    amountPaid: 0,
    items: [
      {
        productId: 10271,
        productName: "Bhelpuri",
        batchNumber: "BCH0001",
        manufacturingDate: "2026-01-01",
        expiryDate: "2027-01-01",
        quantity: 5,
        costPrice: 20,
        mrp: 30,
        gstRate: 5,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("includes the logged-in vendor's id as updatedBy on the PUT call", async () => {
    localStorage.setItem("vmsUser", JSON.stringify({ data: { vendorId: 55, token: "tok" } }));

    apiClient.mockImplementation((url, options) => {
      if (url.includes("/api/Supplier/GetSupplierDropdown")) return jsonResponse({ status: 200, data: supplierDropdown });
      if (url.includes("/api/Purchase/GetPurchaseByUKey/")) return jsonResponse({ status: 200, data: purchaseWithItems });
      if (url.includes("/api/Product/GetAllProduct")) return jsonResponse({ status: 200, data: [] });
      if (options?.method === "PUT" && url.includes("/api/Purchase/UpdatePurchase/")) {
        return jsonResponse({ status: 200, data: purchaseWithItems });
      }
      return jsonResponse({ status: 200, data: null });
    });

    render(<PurchaseEdit uKey="purchase-1" onSubmit={() => {}} onClose={() => {}} />);

    const submitButton = await screen.findByRole("button", { name: "Update Purchase" });
    await waitFor(() => expect(submitButton).not.toBeDisabled());

    fireEvent.click(submitButton);

    await waitFor(() => {
      const putCall = apiClient.mock.calls.find(([, options]) => options?.method === "PUT");
      expect(putCall).toBeDefined();
      expect(putCall[0]).toContain("/api/Purchase/UpdatePurchase/purchase-1?updatedBy=55");
    });
  });
});
