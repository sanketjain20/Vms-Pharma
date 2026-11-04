import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GenerateReport from "./GenerateReport";
import apiClient from "../../Config/apiClient";

jest.mock("../../Config/apiClient");
jest.mock("../../utils/canvasTheme", () => ({
  useCanvasThemeKey: () => "dark",
  getPerspectiveCanvasPalette: () => ({}),
  drawPerspectiveScene: () => {},
  isLightTheme: () => false,
}));

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

const FIELDS = ["Invoice Number", "Date", "Product", "Product Type", "Quantity", "Selling Price(₹)", "Cost Price(₹)",
  "Revenue (₹)", "Profit (₹)", "Discount (₹)", "Tax (₹)", "Net Profit (₹)", "Vendor Name", "Margin Percent", "Payment Status"];

// INV000004: one kurta sold out of two batches; INV000003: a one-line bill
const ROWS = [
  { invoiceNumber: "INV000004", date: "2026-10-21", product: "Kurta", productType: "Kurtas", batchNumber: "TES-BCH01",
    quantity: 6, sellingPrice: 1440, costPrice: 1200, revenue: 8640, profit: 1440, discount: 0, tax: 2073.6, netProfit: 1720,
    marginPercent: 16.67, paymentStatus: "PAID" },
  { invoiceNumber: null, date: "2026-10-21", product: "Kurta", productType: "Kurtas", batchNumber: "TES-BCH02",
    quantity: 2, sellingPrice: 1440, costPrice: 1300, revenue: 2880, profit: 280, discount: null, tax: null, netProfit: null,
    marginPercent: 9.72, paymentStatus: null },
  { invoiceNumber: "INV000003", date: "2026-10-20", product: "Belt", productType: "Accessories", batchNumber: "TES-BCH07",
    quantity: 1, sellingPrice: 500, costPrice: 300, revenue: 500, profit: 200, discount: 0, tax: 90, netProfit: 200,
    marginPercent: 40, paymentStatus: "PAID" },
];

function mockApi(moduleRows = ROWS) {
  apiClient.mockImplementation((url) => {
    if (url.includes("/api/Reports/GetFieldByModuleId/")) return ok({ status: 200, data: FIELDS });
    if (url.includes("/api/Reports/RevenueReportData")) {
      return ok({ status: 200, data: { summaryDto: { totalRevenue: 12020, totalProfit: 1920 }, revenueDto: moduleRows } });
    }
    return ok({ status: 200, data: [] });
  });
}

function open(moduleId = 8) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/master/reports/generate",
      state: { moduleId, reportName: "Revenue-Profit Report", filters: { startDate: "2026-10-01" } } }]}>
      <Routes><Route path="/master/reports/generate" element={<GenerateReport />} /></Routes>
    </MemoryRouter>,
  );
}

const gridRows = () => [...document.querySelectorAll(".gen-table-body-row.invoice-row")];
const cells = (row) => [...row.querySelectorAll(".gen-table-body-cell")].map((c) => c.textContent.trim());

describe("Reports with several rows per invoice — invoice totals and their lines", () => {
  beforeAll(() => {
    // the page paints a canvas background; jsdom has no canvas, so give it one that accepts anything
    const anything = () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => ({ addColorStop() {} })), set: (t, p, v) => { t[p] = v; return true; } });
    HTMLCanvasElement.prototype.getContext = anything;
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
  });
  beforeEach(() => { jest.clearAllMocks(); mockApi(); });

  it("shows each invoice once, with its totals, not just its first batch line", async () => {
    open();
    await screen.findByText("INV000004");
    const [twoBatches, oneLine] = gridRows();
    // Invoice, Date, Product, Type, Qty, Sell, Cost, Revenue, Profit, Discount, Tax, Net Profit, Vendor, Margin, Payment
    expect(cells(twoBatches)).toEqual(["INV000004", "2026-10-21", "Kurta", "Kurtas", "8", "1440", "1200 – 1300", "11520", "1720",
      "0", "2073.6", "1720", "—", "14.93", "PAID"]);
    expect(cells(oneLine).slice(0, 9)).toEqual(["INV000003", "2026-10-20", "Belt", "Accessories", "1", "500", "300", "500", "200"]);
  });

  it("opens the invoice with its totals once on top and one row per product/batch below", async () => {
    open();
    fireEvent.click(await screen.findByText("INV000004"));
    const totals = await screen.findByTestId("invoice-totals");
    expect(within(totals).getByText("Net Profit (₹)").nextSibling).toHaveTextContent("1720");
    expect(within(totals).getByText("GST (₹)").nextSibling).toHaveTextContent("2073.6");
    expect(within(totals).getByText("Payment").nextSibling).toHaveTextContent("PAID");

    expect(screen.getByText("Line Profit (₹, product/batch-wise)")).toBeInTheDocument();
    expect(screen.getByText("Batch")).toBeInTheDocument();
    expect(screen.queryByText("Net Profit (₹)", { selector: ".gen-modal-content .gen-table-header-cell" })).not.toBeInTheDocument();
    const lines = screen.getAllByTestId("invoice-line").map((l) => cells(l));
    expect(lines).toEqual([
      ["Kurta", "Kurtas", "TES-BCH01", "6", "1440", "1200", "8640", "1440", "16.67"],
      ["Kurta", "Kurtas", "TES-BCH02", "2", "1440", "1300", "2880", "280", "9.72"],
    ]);
    expect(lines.flat()).not.toContain("—"); // no filler dashes for invoice-wide figures any more
  });

  it("does the same for the Sales report, with its two profits named apart", async () => {
    const SALES_FIELDS = ["Invoice Number", "Product", "Quantity", "Cost Price (₹)", "Selling Price (₹)", "Profit (₹)", "Per Item Profit (₹)", "Payment Status"];
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Reports/GetFieldByModuleId/")) return ok({ status: 200, data: SALES_FIELDS });
      if (url.includes("/api/Sales/GetSaleReport")) {
        return ok({ status: 200, data: [
          { invoiceNumber: "INV7", product: "Kurta", batchNumber: "B1", quantity: 6, costPrice: 1200, sellingPrice: 1440, profit: 1620, perItemProfit: 1440, paymentStatus: "PAID" },
          { invoiceNumber: null, product: "Kurta", batchNumber: "B2", quantity: 2, costPrice: 1300, sellingPrice: 1440, profit: null, perItemProfit: 280, paymentStatus: "PAID" },
        ] });
      }
      return ok({ status: 200, data: [] });
    });
    open(5);
    await screen.findByText("INV7");
    const headers = [...document.querySelectorAll(".gen-table-header-cell")].map((h) => h.textContent);
    expect(headers.some((h) => h.endsWith("Invoice Profit (₹, after discount)"))).toBe(true);
    expect(headers.some((h) => h.endsWith("Items Profit (₹, before discount)"))).toBe(true);
    expect(cells(gridRows()[0])).toEqual(["INV7", "Kurta", "8", "1200 – 1300", "1440", "1620", "1720", "PAID"]);

    fireEvent.click(screen.getByText("INV7"));
    expect(within(await screen.findByTestId("invoice-totals")).getByText("Invoice Profit (₹, after discount)").nextSibling).toHaveTextContent("1620");
    expect(screen.getAllByTestId("invoice-line").map((l) => cells(l))).toEqual([
      ["Kurta", "B1", "6", "1200", "1440", "1440"],
      ["Kurta", "B2", "2", "1300", "1440", "280"],
    ]);
  });

  it("leaves other reports with invoice numbers as they were", async () => {
    apiClient.mockImplementation((url) => {
      if (url.includes("/api/Reports/GetFieldByModuleId/")) return ok({ status: 200, data: ["Invoice Number", "Quantity"] });
      if (url.includes("/api/Reports/OutstandingReportData")) {
        return ok({ status: 200, data: [{ invoiceNumber: "INV9", quantity: 2 }, { invoiceNumber: null, quantity: 3 }] });
      }
      return ok({ status: 200, data: [] });
    });
    open(10); // Outstanding: one row per invoice, nothing to add up
    await screen.findByText("INV9");
    expect(cells(gridRows()[0])).toEqual(["INV9", "2"]); // the first row, as before
  });
});
