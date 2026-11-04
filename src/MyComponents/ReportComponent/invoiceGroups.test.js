import { gridLabel, invoiceConfig, invoiceStrip, lineCell, lineColumns, summariseInvoice, valueRange } from "./invoiceGroups";
import { ReportEntity } from "../Enums/ReportEntity";

const toKey = (str) => str.replace(/\s(.)/g, (_, g) => g.toUpperCase()).replace(/\s/g, "").replace(/^(.)/, (_, g) => g.toLowerCase()).replace(/[()₹]/g, "");
const strip = (cfg, rows) => Object.fromEntries(invoiceStrip(cfg, rows).map((c) => [c.key, c.value]));

describe("which reports group rows into invoices", () => {
  it("Revenue, Sales and Custom Item Sales do; the others don't", () => {
    expect(invoiceConfig(ReportEntity.Revenue)).toBeTruthy();
    expect(invoiceConfig(String(ReportEntity.Sales))).toBeTruthy(); // a route state may carry it as text
    expect(invoiceConfig(ReportEntity.CustomItemSales)).toBeTruthy();
    [ReportEntity.Purchase, ReportEntity.Outstanding, ReportEntity.PaymentCollection, ReportEntity.DayBook, undefined]
      .forEach((id) => expect(invoiceConfig(id)).toBeNull());
  });

  it("shows a single value or a range", () => {
    expect(valueRange([1440, 1440])).toBe(1440);
    expect(valueRange([1300, 1200, null])).toBe("1200 – 1300");
    expect(valueRange([null, ""])).toBeNull();
  });
});

describe("Revenue / Profit report", () => {
  const cfg = invoiceConfig(ReportEntity.Revenue);
  const FIELDS = ["Invoice Number", "Date", "Product", "Product Type", "Quantity", "Selling Price(₹)", "Cost Price(₹)",
    "Revenue (₹)", "Profit (₹)", "Discount (₹)", "Tax (₹)", "Net Profit (₹)", "Vendor Name", "Margin Percent", "Payment Status"];
  // the screenshot's invoice: one product out of two batches
  const ROWS = [
    { invoiceNumber: "INV000004", date: "2026-10-21", product: "Kurta", productType: "Kurtas", batchNumber: "B1", quantity: 6,
      sellingPrice: 1440, costPrice: 1200, revenue: 8640, profit: 1440, discount: 0, tax: 2073.6, netProfit: 1720, marginPercent: 16.67, paymentStatus: "PAID" },
    { invoiceNumber: null, date: "2026-10-21", product: "Kurta", productType: "Kurtas", batchNumber: "B2", quantity: 2,
      sellingPrice: 1440, costPrice: 1300, revenue: 2880, profit: 280, discount: null, tax: null, netProfit: null, marginPercent: 9.72, paymentStatus: null },
  ];

  it("adds the batch lines up for the grid instead of showing only the first", () => {
    expect(summariseInvoice(cfg, ROWS)).toMatchObject({ invoiceNumber: "INV000004", product: "Kurta", productType: "Kurtas", quantity: 8,
      sellingPrice: 1440, costPrice: "1200 – 1300", revenue: 11520, profit: 1720, tax: 2073.6, netProfit: 1720, marginPercent: 14.93,
      paymentStatus: "PAID", batchNumber: "2 batches" });
  });

  it("names several products and mixed types", () => {
    const s = summariseInvoice(cfg, [ROWS[0], { ...ROWS[1], product: "Belt", productType: "Accessories" }]);
    expect([s.product, s.productType]).toEqual(["2 products", "Mixed"]);
  });

  it("gives the popup line columns without the invoice-wide ones, with Batch and the line profit named", () => {
    const cols = lineColumns(cfg, FIELDS, toKey);
    expect(cols.map((c) => c.key)).toEqual(["product", "productType", "batchNumber", "quantity", "sellingPrice", "costPrice", "revenue", "profit", "marginPercent"]);
    expect(cols.find((c) => c.key === "profit").label).toBe("Line Profit (₹, product/batch-wise)");
  });

  it("puts the totals once on top of the popup, working net profit out if it is missing", () => {
    expect(strip(cfg, ROWS)).toEqual({ quantity: 8, revenue: 11520, profit: 1720, discount: 0, tax: 2073.6, netProfit: 1720, marginPercent: 14.93, paymentStatus: "PAID" });
    expect(strip(cfg, [{ ...ROWS[0], netProfit: null, discount: 100 }]).netProfit).toBe(1340);
  });

  it("keeps the report's own grid headers", () => {
    expect(gridLabel(cfg, "Profit (₹)", "profit")).toBe("Profit (₹)");
    expect(gridLabel(null, "Name", "name")).toBe("Name");
  });
});

describe("Sales report", () => {
  const cfg = invoiceConfig(ReportEntity.Sales);
  const FIELDS = ["Invoice Number", "Product", "Quantity", "Cost Price (₹)", "Selling Price (₹)", "Tax (₹)", "Sub Total (₹)",
    "Total Amount Without Tax (₹)", "Total Amount With Tax (₹)", "Discount (₹)", "Net Amount (₹)", "Profit (₹)", "Billing Mode",
    "Date", "Vendor Name", "Tax Percent", "Margin Percent", "Payment Status", "Per Item Profit (₹)"];
  // 6 from the ₹1200 batch and 2 from the ₹1300 batch at ₹1440 + 18% GST, ₹100 off the bill
  const ROWS = [
    { invoiceNumber: "INV000004", product: "Kurta", batchNumber: "B1", quantity: 6, costPrice: 1200, sellingPrice: 1440, tax: 1555.2,
      subTotal: 10195.2, totalAmountWithoutTax: 11520, totalAmountWithTax: 13593.6, discount: 100, netAmount: 13493.6, profit: 1620,
      billingMode: "CASH", date: "2026-10-21", vendorName: null, taxPercent: 18, marginPercent: 16.67, paymentStatus: "PAID", perItemProfit: 1440 },
    { invoiceNumber: null, product: "Kurta", batchNumber: "B2", quantity: 2, costPrice: 1300, sellingPrice: 1440, tax: 518.4,
      subTotal: 3398.4, totalAmountWithoutTax: null, totalAmountWithTax: null, discount: null, netAmount: null, profit: null,
      billingMode: null, date: null, vendorName: null, taxPercent: 18, marginPercent: 9.72, paymentStatus: "PAID", perItemProfit: 280 },
  ];

  it("shows the whole invoice on the grid line", () => {
    expect(summariseInvoice(cfg, ROWS)).toMatchObject({ invoiceNumber: "INV000004", product: "Kurta", quantity: 8, costPrice: "1200 – 1300",
      sellingPrice: 1440, tax: 2073.6, subTotal: 13593.6, perItemProfit: 1720, profit: 1620, netAmount: 13493.6, taxPercent: 18,
      marginPercent: 14.93, batchNumber: "2 batches", date: "2026-10-21" });
  });

  it("names its two profits apart on the grid", () => {
    expect(gridLabel(cfg, "Profit (₹)", "profit")).toBe("Invoice Profit (₹, after discount)");
    expect(gridLabel(cfg, "Per Item Profit (₹)", "perItemProfit")).toBe("Items Profit (₹, before discount)");
  });

  it("lists line columns only in the popup, with Batch after the product", () => {
    const cols = lineColumns(cfg, FIELDS, toKey);
    expect(cols.map((c) => c.key)).toEqual(["product", "batchNumber", "quantity", "costPrice", "sellingPrice", "tax", "subTotal", "taxPercent", "marginPercent", "perItemProfit"]);
    expect(cols.find((c) => c.key === "perItemProfit").label).toBe("Line Profit (₹, product/batch-wise)");
  });

  it("puts the invoice totals on top of the popup", () => {
    expect(strip(cfg, ROWS)).toEqual({ quantity: 8, totalAmountWithoutTax: 11520, tax: 2073.6, discount: 100, netAmount: 13493.6,
      perItemProfit: 1720, profit: 1620, marginPercent: 14.93, paymentStatus: "PAID" });
  });
});

describe("Custom Item Sales report (each sale)", () => {
  const cfg = invoiceConfig(ReportEntity.CustomItemSales);
  const FIELDS = ["Date", "Invoice Number", "Customer", "Mobile", "Item Name", "Hsn Code", "Quantity", "Returned Quantity", "Selling Price",
    "Discount", "Taxable Value", "Gst Rate", "Gst Amount", "Line Total", "Cost Price", "Profit", "Payment Type"];
  const ROWS = [
    { date: "2026-10-21", invoiceNumber: "INV9", customer: "Asha", mobile: "9876543210", itemName: "Alteration", hsnCode: "9988", quantity: 1,
      returnedQuantity: 0, sellingPrice: 150, discount: 0, taxableValue: 150, gstRate: 5, gstAmount: 7.5, lineTotal: 157.5, costPrice: null, profit: null, paymentType: "PAID" },
    { date: "2026-10-21", invoiceNumber: "INV9", customer: "Asha", mobile: "9876543210", itemName: "Blue kurta", hsnCode: "6211", quantity: 2,
      returnedQuantity: 1, sellingPrice: 800, discount: 50, taxableValue: 1550, gstRate: 12, gstAmount: 186, lineTotal: 1736, costPrice: 500, profit: 550, paymentType: "PAID" },
  ];

  it("adds the custom lines up and keeps the invoice's own details", () => {
    expect(summariseInvoice(cfg, ROWS)).toMatchObject({ invoiceNumber: "INV9", customer: "Asha", itemName: "2 items", hsnCode: "Mixed",
      quantity: 3, returnedQuantity: 1, taxableValue: 1700, gstAmount: 193.5, lineTotal: 1893.5, profit: 550, gstRate: "5 – 12", sellingPrice: "150 – 800" });
  });

  it("has no batch column (custom items take no stock) and leaves out the invoice columns", () => {
    expect(lineColumns(cfg, FIELDS, toKey).map((c) => c.key)).toEqual(["itemName", "hsnCode", "quantity", "returnedQuantity", "sellingPrice",
      "discount", "taxableValue", "gstRate", "gstAmount", "lineTotal", "costPrice", "profit"]);
  });

  it("shows a dash for a profit no line has (no cost typed in)", () => {
    expect(strip(cfg, [ROWS[0]]).profit).toBe("—");
  });
});

describe("free goods given under a sales scheme", () => {
  const cfg = invoiceConfig(ReportEntity.Sales);
  // Buy 10 Get 1: 10 paid at 100 (cost 80) and 1 free (price 0, cost 80)
  const ROWS = [
    { invoiceNumber: "INV3", product: "Paracetamol", batchNumber: "B1", quantity: 10, costPrice: 80, sellingPrice: 100, perItemProfit: 200,
      profit: 120, freeItem: false, schemeName: "Buy 10 Get 1" },
    { invoiceNumber: null, product: "Paracetamol", batchNumber: "B1", quantity: 1, costPrice: 80, sellingPrice: 0, perItemProfit: -80,
      profit: null, freeItem: true, schemeName: "Buy 10 Get 1" },
  ];

  it("the invoice line says how many were free, and its profit is net of what they cost", () => {
    const s = summariseInvoice(cfg, ROWS);
    expect(s.quantity).toBe("11 (1 free)");
    expect(s.perItemProfit).toBe(120);
    expect(strip(cfg, ROWS).quantity).toBe("11 (1 free)");
  });

  it("the free line is named in the popup", () => {
    expect(lineCell(cfg, ROWS[1], "product")).toBe("Paracetamol · Free (Buy 10 Get 1)");
    expect(lineCell(cfg, { ...ROWS[1], schemeName: null }, "product")).toBe("Paracetamol · Free");
    expect(lineCell(cfg, ROWS[0], "product")).toBe("Paracetamol");
    expect(lineCell(cfg, ROWS[1], "perItemProfit")).toBe(-80);
  });

  it("an invoice without free goods keeps a plain quantity", () => {
    expect(summariseInvoice(cfg, [ROWS[0], { ...ROWS[0], invoiceNumber: null }]).quantity).toBe(20);
  });
});
