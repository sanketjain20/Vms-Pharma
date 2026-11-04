// The filters each report offers: which ones (from /api/Filters/GetFiltersByModule) and the dropdown values they
// can take. Shared by the filter page (OpenReport) and the result page (GenerateReport), so a report can be
// re-filtered where its results are shown.

import { useEffect, useState } from "react";
import { ReportEntity } from "../Enums/ReportEntity.js";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { RUN_TIME_REPORTS } from "./runTimeReports";

/** "From Date" → "fromDate": a filter's key in the request. */
export function toFilterKey(name) {
  return name
    .replace(/\s(.)/g, (_, g) => g.toUpperCase())
    .replace(/\s/g, "")
    .replace(/^(.)/, (_, g) => g.toLowerCase());
}

/* ═══════════════════════════════════════════════════════════════════════
   FILTER DROPDOWN DATA — every report's filters should offer a dropdown
   where the underlying field is a known, bounded set of values (status,
   type, mode) rather than free text. Two sources feed filterOptions:

   1. STATIC_FILTER_OPTIONS — fixed value sets read straight off the DTO/
      enum that backs the filter (see the comments on each DTO field this
      mirrors). No network round trip needed for these.
   2. EXTRA_FILTER_SOURCES — name-lookup filters (supplier/retailer/product
      names) that reuse the existing dropdown endpoints those modules
      already expose elsewhere in the app, rather than inventing new ones.

   Reports that already had their own filter-data endpoint (Product,
   ProductType, Inventory, Sales, Revenue, StockMovement) keep using that —
   this just fills in the reports that had none.
═══════════════════════════════════════════════════════════════════════ */
const PAID_CREDIT_PARTIAL = ["PAID", "CREDIT", "PARTIAL"];
const CURRENT_YEAR = new Date().getFullYear();
const RECENT_YEARS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS_1_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));

export const STATIC_FILTER_OPTIONS = {
  [ReportEntity.Outstanding]: {
    paymentType: PAID_CREDIT_PARTIAL,
    ageingBucket: ["Not Due", "0-30 Days", "31-60 Days", "61-90 Days", "90+ Days"],
  },
  [ReportEntity.RetailerCustomer]: {
    paymentType: PAID_CREDIT_PARTIAL,
    customerType: ["Retailer", "Walk-in"],
  },
  [ReportEntity.Purchase]: {
    paymentStatus: PAID_CREDIT_PARTIAL,
    recordStatus: ["Active", "Cancelled"],
  },
  [ReportEntity.Supplier]: {
    paymentStatus: PAID_CREDIT_PARTIAL,
    supplierStatus: ["Active", "Inactive"],
  },
  [ReportEntity.PaymentCollection]: {
    paymentType: PAID_CREDIT_PARTIAL,
    collectionStatus: ["Fully Collected", "Partially Collected", "Pending"],
    billingMode: ["SIMPLE", "MEDICAL", "ADVANCED"],
  },
  [ReportEntity.DayBook]: {
    transactionType: ["SALE", "PURCHASE", "PAYMENT_COLLECTION", "SUPPLIER_PAYMENT"],
    paymentMode: ["CASH", "UPI", "CHEQUE", "CREDIT"],
    paymentStatus: PAID_CREDIT_PARTIAL,
  },
  [ReportEntity.GSTR1]: {
    period: ["MONTHLY", "QUARTERLY", "CUSTOM"],
    month: MONTHS_1_12,
    year: RECENT_YEARS,
  },
  [ReportEntity.ProfitLoss]: {
    period: ["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"],
    month: MONTHS_1_12,
    year: RECENT_YEARS,
  },
  [ReportEntity.AuditLog]: {
    module: ["VENDOR", "SUPPLIER", "SUPPLIER_PAYMENT", "PURCHASE", "SALES", "ROLES", "RETAILER", "PRODUCT_TYPE",
      "PRODUCT", "PAYMENT_COLLECTION", "MANUFACTURER", "INVENTORY"],
    action: ["UPDATE", "ENABLE", "DISABLE", "PAYMENT_COLLECTED", "PAYMENT_MADE", "PAYMENT_REVERSED",
      "STATUS_CHANGED", "RETURN_PROCESSED", "DELETE"],
  },
  [ReportEntity.NarcoticRegister]: {
    scheduleType: ["H", "H1", "NARCOTIC"],
  },
  // run-time reports (Phase 3)
  ...Object.fromEntries(Object.entries(RUN_TIME_REPORTS).map(([id, r]) => [id, r.staticFilters])),
};

const supplierNames = (d) => (d.data || []).map((s) => s.shopName);
const retailerNames = (d) => (d.data || []).map((r) => r.shopName);
const godownNames = (d) => (d.data || []).map((g) => g.name);

export const EXTRA_FILTER_SOURCES = {
  [ReportEntity.Inventory]: [
    { key: "godown", url: `${API_BASE_URL}/api/Godown/GetGodownDropdown`, pluck: godownNames },
  ],
  [ReportEntity.StockMovement]: [
    { key: "godown", url: `${API_BASE_URL}/api/Godown/GetGodownDropdown`, pluck: godownNames },
  ],
  [ReportEntity.Purchase]: [
    { key: "supplierName", url: `${API_BASE_URL}/api/Supplier/GetSupplierDropdown`, pluck: supplierNames },
  ],
  [ReportEntity.Supplier]: [
    { key: "shopName", url: `${API_BASE_URL}/api/Supplier/GetSupplierDropdown`, pluck: supplierNames },
  ],
  [ReportEntity.Outstanding]: [
    { key: "retailerName", url: `${API_BASE_URL}/api/Retailer/Dropdown`, pluck: retailerNames },
  ],
  [ReportEntity.RetailerCustomer]: [
    { key: "customerName", url: `${API_BASE_URL}/api/Retailer/Dropdown`, pluck: retailerNames },
  ],
  [ReportEntity.PaymentCollection]: [
    { key: "customerName", url: `${API_BASE_URL}/api/Retailer/Dropdown`, pluck: retailerNames },
  ],
  [ReportEntity.DayBook]: [
    { key: "partyName", url: `${API_BASE_URL}/api/Supplier/GetSupplierDropdown`, pluck: supplierNames },
    { key: "partyName", url: `${API_BASE_URL}/api/Retailer/Dropdown`, pluck: retailerNames },
  ],
  [ReportEntity.NarcoticRegister]: [
    { key: "productName", url: `${API_BASE_URL}/api/Reports/NarcoticRegisterFilterData`,
      pluck: (d) => d.data?.productName || [] },
    { key: "partyName", url: `${API_BASE_URL}/api/Supplier/GetSupplierDropdown`, pluck: supplierNames },
    { key: "partyName", url: `${API_BASE_URL}/api/Retailer/Dropdown`, pluck: retailerNames },
  ],
  // run-time reports (Phase 3)
  ...Object.fromEntries(Object.entries(RUN_TIME_REPORTS).filter(([, r]) => r.filterSources.length).map(([id, r]) => [id, r.filterSources])),
};

/** The filters a report has (names, in order) and the dropdown values each one offers. */
export function useReportFilters(moduleId) {
  const [filters, setFilters] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [loading, setLoading] = useState(true);

  /* Fetch filter definitions for this module */
  useEffect(() => {
    if (!moduleId) { setLoading(false); return; }
    apiClient(`${API_BASE_URL}/api/Filters/GetFiltersByModule/${moduleId}`)
      .then((r) => r.json())
      .then((d) => {
        // a report without filters may answer with no list at all
        if (d.status === 200) setFilters(Array.isArray(d.data) ? d.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [moduleId]);

  /* Reset filter options, then seed the static (no-network) defaults for this module */
  useEffect(() => {
    setFilterOptions(STATIC_FILTER_OPTIONS[moduleId] || {});
  }, [moduleId]);

  /* Fetch dropdown option lists for the modules that have a dedicated filter-data endpoint */
  useEffect(() => {
    const map = {
      [ReportEntity.Product]:       `${API_BASE_URL}/api/Product/GetFilterData`,
      [ReportEntity.ProductType]:   `${API_BASE_URL}/api/ProductType/GetFilterData`,
      [ReportEntity.Inventory]:     `${API_BASE_URL}/api/Inventory/InvReportFilterData`,
      [ReportEntity.Sales]:         `${API_BASE_URL}/api/Sales/SalesReportFilterData`,
      [ReportEntity.Revenue]:       `${API_BASE_URL}/api/Reports/RevenueReportFilterData`,
      [ReportEntity.StockMovement]: `${API_BASE_URL}/api/Inventory/StockMovReportFilterData`,
    };
    if (!map[moduleId]) return;
    apiClient(map[moduleId])
      .then((r) => r.json())
      .then((d) => d.status === 200 && setFilterOptions((prev) => ({ ...prev, ...d.data })))
      .catch(() => {});
  }, [moduleId]);

  /* Fetch name-lookup dropdown data by reusing each module's existing dropdown endpoint(s) */
  useEffect(() => {
    const sources = EXTRA_FILTER_SOURCES[moduleId];
    if (!sources) return;
    let cancelled = false;

    Promise.all(
      sources.map((s) =>
        apiClient(s.url)
          .then((r) => r.json())
          .then((d) => ({ key: s.key, values: s.pluck(d) || [] }))
          .catch(() => ({ key: s.key, values: [] }))
      )
    ).then((results) => {
      if (cancelled) return;
      setFilterOptions((prev) => {
        const merged = { ...prev };
        results.forEach(({ key, values }) => {
          const clean = values.filter(Boolean);
          merged[key] = Array.from(new Set([...(merged[key] || []), ...clean])).sort();
        });
        return merged;
      });
    });

    return () => { cancelled = true; };
  }, [moduleId]);

  return { filters, filterOptions, loading };
}
