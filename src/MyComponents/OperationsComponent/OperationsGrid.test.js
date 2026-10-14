import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import apiClient from "../../Config/apiClient";
import PurchaseOrder, { buildDocumentItems, buildDocumentPayload, readResponse } from "../PurchaseOrderComponent/PurchaseOrder";
import SalesOrder from "../SalesOrderComponent/SalesOrder";
import DeliveryChallan from "../DeliveryChallanComponent/DeliveryChallan";
import StockTransfer from "../StockTransferComponent/StockTransfer";

jest.mock("../CommonComponent/DynamicGrid", () => ({ customAddAction }) => (
  <button onClick={customAddAction}>Add document</button>
));
jest.mock("../../Config/apiClient", () => jest.fn());

describe("operations document payloads", () => {
  const form = {
    partyId: "12", godownId: "4", toGodownId: "7", date: "2026-10-10",
    expectedDate: "2026-10-20", terms: "Net 30", notes: "Test", purpose: "SAMPLE",
    vehicleNumber: "AB12", transporter: "Fast Freight", salesOrderUKey: "SO-1",
  };

  it("maps purchase order fields and item cost/tax to the API DTO", () => {
    const items = buildDocumentItems(35, [{ productId: "8", quantity: "3", unitCost: "12.5", gstRate: "5" }]);
    expect(buildDocumentPayload({ id: 35 }, form, items)).toEqual({
      supplierId: 12, godownId: 4, orderDate: form.date, expectedDate: form.expectedDate,
      terms: form.terms, notes: form.notes,
      items: [{ productId: 8, quantity: 3, unitCost: 12.5, gstRate: 5 }],
    });
  });

  it("maps sales order fields and item price/tax", () => {
    const items = buildDocumentItems(36, [{ productId: "8", quantity: "2", unitPrice: "19.9", gstRate: "18" }]);
    expect(buildDocumentPayload({ id: 36 }, form, items)).toEqual({
      retailerId: 12, godownId: 4, orderDate: form.date, expectedDate: form.expectedDate,
      terms: form.terms, notes: form.notes,
      items: [{ productId: 8, quantity: 2, unitPrice: 19.9, gstRate: 18, schemeId: null }],
    });
  });

  it("maps challan fields and leaves price null for the godown default", () => {
    const items = buildDocumentItems(37, [{ productId: "8", quantity: "2", unitPrice: "" }]);
    expect(buildDocumentPayload({ id: 37 }, form, items)).toEqual({
      retailerId: 12, godownId: 4, salesOrderUKey: "SO-1", challanDate: form.date,
      purpose: "SAMPLE", vehicleNumber: "AB12", transporter: "Fast Freight", notes: "Test",
      items: [{ productId: 8, quantity: 2, unitPrice: null }],
    });
  });

  it("maps stock transfer source, destination and quantities", () => {
    const items = buildDocumentItems(38, [{ productId: "8", quantity: "6" }]);
    expect(buildDocumentPayload({ id: 38 }, form, items)).toEqual({
      fromGodownId: 4, toGodownId: 7, transferDate: form.date,
      vehicleNumber: "AB12", notes: "Test", items: [{ productId: 8, quantity: 6 }],
    });
  });

  it("accepts an empty successful response body", async () => {
    await expect(readResponse({ status: 200, text: async () => "" })).resolves.toBeNull();
  });

  it("still parses API messages from non-empty response bodies", async () => {
    await expect(readResponse({ status: 400, text: async () => '{"status":400,"message":"Invalid order"}' }))
      .resolves.toEqual({ status: 400, message: "Invalid order" });
  });
});

describe("operations document create forms", () => {
  beforeEach(() => {
    apiClient.mockImplementation(async (url, options = {}) => {
      if (options.method === "POST") return { ok: true, status: 200, text: async () => "" };
      let data = [];
      if (url.includes("Supplier/GetSupplierDropdown")) data = [{ id: 2, shopName: "Supplier One" }];
      if (url.includes("Retailer/Dropdown")) data = [{ id: 3, shopName: "Retailer One" }];
      if (url.includes("Godown/GetGodownDropdown")) data = [{ id: 4, name: "Central" }, { id: 5, name: "East" }];
      if (url.includes("Product/GetAllProduct")) data = [{ id: 8, name: "Bandage", price: 10, sellingPrice: 15 }];
      return { ok: true, status: 200, json: async () => ({ status: 200, data }) };
    });
  });

  it.each([
    ["purchase-order", "/api/PurchaseOrder/AddPurchaseOrder", { supplierId: 2, godownId: 4, orderDate: expect.any(String), expectedDate: null, terms: "", notes: "", supplierInvoiceNumber: null, invoiceDate: null, paymentStatus: "CREDIT", dueDate: null, amountPaid: 0, items: [{ productId: 8, quantity: 2, unitCost: 10, gstRate: 18 }] }],
    ["sales-order", "/api/SalesOrder/AddSalesOrder", { retailerId: 3, godownId: 4, orderDate: expect.any(String), expectedDate: null, terms: "", notes: "", billingMode: "SIMPLE", paymentType: "CREDIT", dueDate: null, amountPaid: 0, totalDiscount: 0, autoApplySchemes: true, items: [{ productId: 8, quantity: 2, unitPrice: 15, gstRate: 18, schemeId: null }] }],
    ["delivery-challan", "/api/DeliveryChallan/AddDeliveryChallan", { retailerId: 3, godownId: 4, salesOrderUKey: null, challanDate: expect.any(String), purpose: "SALE_PENDING_INVOICE", vehicleNumber: "", transporter: "", notes: "", items: [{ productId: 8, quantity: 2, unitPrice: 15 }] }],
    ["stock-transfer", "/api/StockTransfer/AddStockTransfer", { fromGodownId: 4, toGodownId: 5, transferDate: expect.any(String), vehicleNumber: "", notes: "", items: [{ productId: 8, quantity: 2 }] }],
  ])("submits %s form with the matching API request", async (module, endpoint, expectedBody) => {
    const Component = {
      "purchase-order": PurchaseOrder,
      "sales-order": SalesOrder,
      "delivery-challan": DeliveryChallan,
      "stock-transfer": StockTransfer,
    }[module];
    const { container } = render(<Component />);
    fireEvent.click(screen.getByText("Add document"));
    await waitFor(() => expect(apiClient).toHaveBeenCalledWith(expect.stringContaining("Product/GetAllProduct"), expect.anything()));

    const form = container.querySelector("form");
    const selects = form.querySelectorAll("select");
    await waitFor(() => expect(selects[0].options.length).toBeGreaterThan(1));
    if (module === "purchase-order") fireEvent.change(selects[0], { target: { value: "2" } });
    if (module === "sales-order" || module === "delivery-challan") fireEvent.change(selects[0], { target: { value: "3" } });
    fireEvent.change(selects[module === "stock-transfer" ? 0 : 1], { target: { value: "4" } });
    if (module === "stock-transfer") fireEvent.change(selects[1], { target: { value: "5" } });
    fireEvent.click(screen.getByRole("tab", { name: /Items/ }));
    fireEvent.click(screen.getByText("+ Add item"));
    await waitFor(() => expect(form.querySelector(".ops-order-item select option[value='8']")).toBeTruthy());

    const itemSelects = form.querySelectorAll(".ops-order-item select");
    fireEvent.change(itemSelects[0], { target: { value: "8" } });
    const numeric = form.querySelectorAll(".ops-order-item input[type='number']");
    fireEvent.change(numeric[0], { target: { value: "2" } });
    if (module === "purchase-order") fireEvent.change(numeric[1], { target: { value: "10" } });
    if (module === "sales-order" || module === "delivery-challan") {
      const price = form.querySelector(".ops-order-item input[placeholder='Use godown price']");
      if (price) fireEvent.change(price, { target: { value: "15" } });
    }
    fireEvent.submit(form);

    await waitFor(() => expect(apiClient).toHaveBeenCalledWith(
      expect.stringContaining(endpoint),
      expect.objectContaining({ method: "POST", body: expect.any(String) }),
    ));
    const [, request] = apiClient.mock.calls.find(([url, options]) => url.includes(endpoint) && options?.method === "POST");
    expect(JSON.parse(request.body)).toEqual(expectedBody);
  });
});
