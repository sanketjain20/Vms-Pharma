// The three run-time reports (Phase 3): Custom Item Sales, Daily Sales Finance and Walk-in Customer.
// Their columns and filters come from the seeded report fields / filters like every other report; what is here is the
// rest: which endpoints serve them, the fixed dropdown values of their filters, and the totals shown as cards above the
// table (each data endpoint answers { rows, summary }).

import { ReportEntity } from "../Enums/ReportEntity";
import API_BASE_URL from "../../Config/api.config";

const money = { money: true };

// each card's colour, from the palette the Revenue and GSTR-1 cards use
const tone = (color, glow) => ({ color, glow });

export const RUN_TIME_REPORTS = {
  [ReportEntity.CustomItemSales]: {
    nameMatch: "custom item",
    permission: "custom item sales", // its own report permission (Roles screen), like every other report
    data: `${API_BASE_URL}/api/Reports/CustomItemSalesReportData`,
    download: `${API_BASE_URL}/api/Reports/CustomItemSalesReport`,
    staticFilters: { view: ["Each sale", "Item-wise"] },
    filterSources: [
      { key: "itemName", url: `${API_BASE_URL}/api/Reports/CustomItemFilterData`, pluck: (d) => d.data?.itemName || [] },
    ],
    cards: [
      { key: "period", label: "Period", icon: "◷", ...tone("#64748b", "rgba(100,116,139,0.4)") },
      { key: "bills", label: "Bills", icon: "#", ...tone("#8b5cf6", "rgba(139,92,246,0.4)") },
      { key: "quantitySold", label: "Qty Sold", icon: "↑", ...tone("#06b6d4", "rgba(6,182,212,0.4)") },
      { key: "quantityReturned", label: "Qty Returned", icon: "↓", ...tone("#f97316", "rgba(249,115,22,0.4)") },
      { key: "taxableValue", label: "Value (excl. GST)", icon: "₹", ...tone("#3b82f6", "rgba(59,130,246,0.4)"), ...money },
      { key: "gstAmount", label: "GST", icon: "G", ...tone("#8b5cf6", "rgba(139,92,246,0.4)"), ...money },
      { key: "totalValue", label: "Total", icon: "Σ", ...tone("#ec4899", "rgba(236,72,153,0.4)"), ...money },
      { key: "profit", label: "Profit", icon: "P", ...tone("#10b981", "rgba(16,185,129,0.4)"), ...money, hint: (s) => (s.linesWithoutCost ? `${s.linesWithoutCost} line(s) without a cost not counted` : "") },
    ],
  },
  [ReportEntity.DailySalesFinance]: {
    nameMatch: "daily sales finance",
    permission: "daily sales finance",
    data: `${API_BASE_URL}/api/Reports/DailySalesFinanceReportData`,
    download: `${API_BASE_URL}/api/Reports/DailySalesFinanceReport`,
    staticFilters: {},
    filterSources: [],
    cards: [
      { key: "period", label: "Period", icon: "◷", ...tone("#64748b", "rgba(100,116,139,0.4)") },
      { key: "bills", label: "Bills", icon: "#", ...tone("#8b5cf6", "rgba(139,92,246,0.4)") },
      { key: "stockSales", label: "Stock Sales", icon: "S", ...tone("#06b6d4", "rgba(6,182,212,0.4)"), ...money },
      { key: "customSales", label: "Custom Sales", icon: "C", ...tone("#ec4899", "rgba(236,72,153,0.4)"), ...money },
      { key: "netSales", label: "Net Sales", icon: "₹", ...tone("#3b82f6", "rgba(59,130,246,0.4)"), ...money },
      { key: "gstAmount", label: "GST", icon: "G", ...tone("#8b5cf6", "rgba(139,92,246,0.4)"), ...money },
      { key: "paidSoFar", label: "Paid So Far", icon: "✓", ...tone("#10b981", "rgba(16,185,129,0.4)"), ...money },
      { key: "stillDue", label: "Still Due", icon: "!", ...tone("#ef4444", "rgba(239,68,68,0.4)"), ...money },
      { key: "returns", label: "Returns", icon: "↩", ...tone("#f97316", "rgba(249,115,22,0.4)"), ...money },
      { key: "grossProfit", label: "Gross Profit", icon: "P", ...tone("#10b981", "rgba(16,185,129,0.4)"), ...money },
    ],
  },
  [ReportEntity.WalkInCustomer]: {
    nameMatch: "walk-in",
    permission: "walk-in customer",
    data: `${API_BASE_URL}/api/Reports/WalkInCustomerReportData`,
    download: `${API_BASE_URL}/api/Reports/WalkInCustomerReport`,
    staticFilters: { outstandingOnly: ["Yes", "No"] },
    filterSources: [],
    cards: [
      { key: "period", label: "Period", icon: "◷", ...tone("#64748b", "rgba(100,116,139,0.4)") },
      { key: "customers", label: "Customers", icon: "#", ...tone("#f59e0b", "rgba(245,158,11,0.4)") },
      { key: "bills", label: "Bills", icon: "#", ...tone("#8b5cf6", "rgba(139,92,246,0.4)") },
      { key: "totalBilled", label: "Total Billed", icon: "₹", ...tone("#3b82f6", "rgba(59,130,246,0.4)"), ...money },
      { key: "paid", label: "Paid", icon: "✓", ...tone("#10b981", "rgba(16,185,129,0.4)"), ...money },
      { key: "outstanding", label: "Outstanding", icon: "!", ...tone("#ef4444", "rgba(239,68,68,0.4)"), ...money },
      { key: "returns", label: "Returns", icon: "↩", ...tone("#f97316", "rgba(249,115,22,0.4)"), ...money },
    ],
  },
};

/** The run-time report a report name opens, or null. Checked before the older name rules ("sales", "customer"). */
export function runTimeReportIdByName(reportName) {
  const name = String(reportName || "").toLowerCase();
  const hit = Object.entries(RUN_TIME_REPORTS).find(([, r]) => name.includes(r.nameMatch));
  return hit ? Number(hit[0]) : null;
}

/**
 * Whether a role with these report permission keys (the action names, lower-cased and split on "/") sees a report.
 * Older reports match any key their name contains ("Sales" opens "Sales Report"). A run-time report needs its own
 * permission, so the Sales or Customer permission does not open it just because its name contains "sales" or
 * "customer". No keys at all (access not loaded) shows everything, as the list always has.
 */
export function canSeeReport(reportName, allowedKeys) {
  if (!allowedKeys || allowedKeys.length === 0) return true;
  const name = String(reportName || "").toLowerCase();
  const runTime = runTimeReportIdByName(name);
  if (runTime) return allowedKeys.includes(RUN_TIME_REPORTS[runTime].permission);
  return allowedKeys.some((k) => name.includes(k));
}

const inr = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A card's value as shown: money as ₹ with two decimals, anything else as it is. */
export const cardValue = (card, summary) => {
  const v = summary?.[card.key];
  if (v === null || v === undefined || v === "") return "—";
  return card.money ? `₹${inr(v)}` : String(v);
};
