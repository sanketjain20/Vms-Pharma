// Reports where one invoice has several rows (one per product and batch, or per custom item): Revenue / Profit, Sales
// and Custom Item Sales. The grid shows one line per invoice with its totals; the invoice's popup shows those totals
// once on top and the invoice's lines below, without the invoice-wide columns. Each report says here which of its
// columns belong to the whole invoice, which add up, which are shown as a range, and what to call its line columns.
// The Excel sheets do the same on the server (Utils/RevenueInvoiceSummary.java, Utils/SalesReportLine.java).

import { ReportEntity } from "../Enums/ReportEntity";

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));
const round2 = (n) => Math.round(n * 100) / 100;
const pct = (part, whole) => (whole === 0 ? 0 : round2((part * 100) / whole));

const LINE_PROFIT = "Line Profit (₹, product/batch-wise)";

const CONFIGS = {
  [ReportEntity.Revenue]: {
    invoiceKeys: ["invoiceNumber", "date", "vendorName", "discount", "tax", "netProfit", "paymentStatus"],
    names: { product: "products", productType: null },
    sum: ["quantity", "revenue", "profit"],
    range: ["sellingPrice", "costPrice"],
    derive: (s, rows, first) => ({
      marginPercent: pct(s.profit, s.revenue),
      netProfit: first.netProfit ?? round2(s.profit - num(first.discount)),
    }),
    batch: true,
    lineLabels: { profit: LINE_PROFIT, marginPercent: "Line Margin %" },
    strip: [["quantity", "Quantity"], ["revenue", "Revenue (₹)"], ["profit", "Profit (₹)"], ["discount", "Discount (₹)"],
      ["tax", "GST (₹)"], ["netProfit", "Net Profit (₹)"], ["marginPercent", "Margin %"], ["paymentStatus", "Payment"]],
  },
  [ReportEntity.Sales]: {
    invoiceKeys: ["invoiceNumber", "date", "vendorName", "billingMode", "paymentStatus", "totalAmountWithoutTax",
      "totalAmountWithTax", "discount", "netAmount", "profit"],
    names: { product: "products" },
    sum: ["quantity", "tax", "subTotal", "perItemProfit"],
    range: ["sellingPrice", "costPrice", "taxPercent"],
    derive: (s, rows) => ({
      marginPercent: pct(s.perItemProfit, rows.reduce((t, r) => t + num(r.sellingPrice) * num(r.quantity), 0)),
    }),
    batch: true,
    // the grid's invoice line has both: the lines' profit added up, and the invoice's after its discount
    gridLabels: { profit: "Invoice Profit (₹, after discount)", perItemProfit: "Items Profit (₹, before discount)" },
    lineLabels: { perItemProfit: LINE_PROFIT, marginPercent: "Line Margin %", subTotal: "Line Total (₹)", tax: "Line Tax (₹)",
      taxPercent: "Tax %" },
    strip: [["quantity", "Quantity"], ["totalAmountWithoutTax", "Amount (₹, excl. GST)"], ["tax", "GST (₹)"],
      ["discount", "Discount (₹)"], ["netAmount", "Net Amount (₹)"], ["perItemProfit", "Items Profit (₹)"],
      ["profit", "Invoice Profit (₹, after discount)"], ["marginPercent", "Margin %"], ["paymentStatus", "Payment"]],
  },
  [ReportEntity.CustomItemSales]: {
    invoiceKeys: ["date", "invoiceNumber", "customer", "mobile", "paymentType"],
    names: { itemName: "items", hsnCode: null },
    sum: ["quantity", "returnedQuantity", "discount", "taxableValue", "gstAmount", "lineTotal", "profit"],
    range: ["sellingPrice", "costPrice", "gstRate"],
    derive: () => ({}),
    batch: false,
    lineLabels: { profit: "Line Profit", lineTotal: "Line Total" },
    strip: [["quantity", "Quantity"], ["returnedQuantity", "Returned"], ["taxableValue", "Value (excl. GST)"],
      ["gstAmount", "GST"], ["discount", "Discount"], ["lineTotal", "Total"], ["profit", "Profit"], ["paymentType", "Payment"]],
  },
};

/** The invoice grouping of a report, or null for a report whose rows stand alone. */
export const invoiceConfig = (moduleId) => CONFIGS[Number(moduleId)] || null;

/** "1440" when every line has the same value, else "1200 – 1300". */
export function valueRange(values) {
  const list = values.filter((v) => v !== null && v !== undefined && v !== "").map(Number);
  if (list.length === 0) return null;
  const lo = Math.min(...list);
  const hi = Math.max(...list);
  return lo === hi ? lo : `${lo} – ${hi}`;
}

/** A sum, or null when no line has the value at all (e.g. profit of custom items bought without a cost). */
const sumOf = (rows, key) => (rows.every((r) => r[key] === null || r[key] === undefined || r[key] === "")
  ? null : round2(rows.reduce((t, r) => t + num(r[key]), 0)));

/** An invoice's rows added up into one row with the same keys, for the grid. */
export function summariseInvoice(cfg, rows) {
  const first = rows[0] || {};
  const s = { ...first };
  Object.entries(cfg.names).forEach(([key, noun]) => {
    const values = [...new Set(rows.map((r) => r[key] ?? ""))];
    s[key] = values.length === 1 ? values[0] : noun ? `${values.length} ${noun}` : "Mixed";
  });
  cfg.sum.forEach((key) => { s[key] = sumOf(rows, key); });
  cfg.range.forEach((key) => { s[key] = valueRange(rows.map((r) => r[key])); });
  Object.assign(s, cfg.derive(s, rows, first));
  // free goods given under a sales scheme are lines of their own (price 0, at their real cost): count them in, and say so
  const freeQty = rows.filter((r) => r.freeItem).reduce((t, r) => t + num(r.quantity), 0);
  if (freeQty > 0) s.quantity = `${s.quantity} (${freeQty} free)`;
  if (cfg.batch) s.batchNumber = rows.length > 1 ? `${rows.length} batches` : first.batchNumber ?? null;
  return s;
}

/**
 * A popup line's cell. A scheme's free-goods line reads "Kurta · Free (Buy 10 Get 1)": its price is 0 and its profit is
 * the (negative) cost of the goods given away, which is why the invoice profit is below the paid lines' own.
 */
export function lineCell(cfg, row, key) {
  const nameKey = Object.keys(cfg.names)[0];
  if (key === nameKey && row.freeItem) return `${row[key]} · Free${row.schemeName ? ` (${row.schemeName})` : ""}`;
  return row[key];
}

/** A grid column's header: the report's own field name, unless the invoice line needs a clearer one. */
export const gridLabel = (cfg, field, key) => cfg?.gridLabels?.[key] ?? field;

/**
 * The popup's line columns: the report's fields without the invoice-wide ones, a Batch column (after the product type,
 * or the product) and the line columns named for what they are.
 * @param toKey  field name → row key
 */
export function lineColumns(cfg, fields, toKey) {
  const cols = [];
  fields.forEach((label) => {
    const key = toKey(label);
    if (cfg.invoiceKeys.includes(key)) return;
    cols.push({ key, label: cfg.lineLabels[key] ?? label });
  });
  if (cfg.batch) {
    const after = ["productType", "product"].map((k) => cols.findIndex((c) => c.key === k)).find((i) => i >= 0);
    cols.splice(after === undefined ? Math.min(1, cols.length) : after + 1, 0, { key: "batchNumber", label: "Batch" });
  }
  return cols;
}

/** The invoice's totals shown once, on top of its popup. */
export function invoiceStrip(cfg, rows) {
  const s = summariseInvoice(cfg, rows);
  return cfg.strip.map(([key, label]) => ({ key, label, value: s[key] === null || s[key] === undefined || s[key] === "" ? "—" : s[key] }));
}
