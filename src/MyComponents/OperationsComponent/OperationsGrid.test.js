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
  // Each module now opens its full Add screen (the generic order form these tests used to drive was replaced).
  // What each screen submits is covered next to it: PurchaseAdd.purchaseOrder, SalesAdd.salesOrder,
  // DeliveryChallanAdd and StockTransferAdd tests.
  beforeEach(() => {
    apiClient.mockImplementation(async (url) => {
      let data = [];
      if (url.includes("Supplier/GetSupplierDropdown")) data = [{ id: 2, shopName: "Supplier One" }];
      if (url.includes("Retailer/Dropdown")) data = [{ id: 3, shopName: "Retailer One", ownerName: "Owner" }];
      if (url.includes("Godown/GetGodownDropdown")) data = [{ id: 4, name: "Central" }, { id: 5, name: "East" }];
      if (url.includes("Product/GetAllProduct")) data = [{ id: 8, name: "Bandage", price: 10, sellingPrice: 15 }];
      if (url.includes("ProductType/GetAllProductType")) data = { productTypes: [] };
      const body = { status: 200, data };
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    });
  });

  it.each([
    ["purchase-order", PurchaseOrder, "Create Purchase Order"],
    ["sales-order", SalesOrder, "Add Sales Order"],
    ["delivery-challan", DeliveryChallan, "Create Delivery Challan"],
    ["stock-transfer", StockTransfer, "Create Stock Transfer"],
  ])("%s: Add document opens its own create screen", async (_module, Component, title) => {
    render(<Component />);
    fireEvent.click(screen.getByText("Add document"));
    expect(await screen.findByText(title)).toBeInTheDocument();
  });
});
