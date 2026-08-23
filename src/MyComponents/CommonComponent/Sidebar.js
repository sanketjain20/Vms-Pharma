import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Sidebar.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Icon primitives ──────────────────────────────────────────
   Clean stroke-based glyphs (no filled Material Symbols) so every
   module can carry its own accent color via `stroke="currentColor"`
   + a tinted chip background driven by --sic-color / --ssc-color. */
const S = (props) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...props} />
);
const Ss = (props) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" {...props} />
);

/* ── Icon Map (top-level rail items) ─────────────────────────── */
const iconMap = {
  home: <S><path d="M3 9.5L10 3l7 6.5" /><path d="M5 8.2V16a1 1 0 001 1h2.5v-5h3v5H14a1 1 0 001-1V8.2" /></S>,
  dashboard: <S><rect x="3" y="3" width="14" height="14" rx="3" /><path d="M3 8.5h14M8.5 8.5V17" /></S>,
  product: <S><ellipse cx="10" cy="5.5" rx="6" ry="2.3" /><path d="M4 5.5v9c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3v-9" /><path d="M4 10c0 1.27 2.69 2.3 6 2.3s6-1.03 6-2.3" /></S>,
  inventory: <S><path d="M3 6.8L10 3l7 3.8v6.4L10 17l-7-3.8V6.8z" /><path d="M3 6.8L10 10.6l7-3.8M10 10.6V17" /></S>,
  sales: <S><path d="M5.5 2.5h9v15l-2-1.3-1.5 1.3-1.5-1.3-1.5 1.3-2.5-1.3v-13.7z" /><path d="M7.7 6.5h4.6M7.7 9.7h4.6" /></S>,
  reports: <S><path d="M4 16.5V11M9 16.5V5M14 16.5v-8M17.5 16.5v-4.5" /></S>,
  scheduler: <S><circle cx="10" cy="10.5" r="7" /><path d="M10 6.5v4l3 2" /></S>,
  bulkupload: <S><path d="M10 13V4M10 4L6.5 7.5M10 4l3.5 3.5" /><path d="M4 13.5v1.5a1 1 0 001 1h10a1 1 0 001-1v-1.5" /></S>,
  vendor: <S><path d="M10 2.3l6 2.4v4.6c0 4-2.6 6.9-6 8-3.4-1.1-6-4-6-8V4.7l6-2.4z" /><circle cx="10" cy="8.6" r="2" /><path d="M6.4 14.2a3.6 3.6 0 017.2 0" /></S>,
  default: <S><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></S>,
};

/* Accent color per top-level item — this is what makes the rail read
   as "colored icons", not a monochrome list. */
const colorMap = {
  home: "#6366f1",
  dashboard: "#3b82f6",
  product: "#8b5cf6",   // "Masters" group reuses this key/icon
  inventory: "#10b981",
  sales: "#f472b6",     // "Billing" group reuses this key/icon
  reports: "#0ea5e9",
  scheduler: "#a78bfa",
  bulkupload: "#fb923c",
  vendor: "#fbbf24",
  default: "#6b7280",
};

const subIconMap = {
  product:   <Ss><path d="M2 5.3L8 2l6 3.3v5.4L8 14 2 10.7V5.3z" /><path d="M2 5.3L8 8.6l6-3.3M8 8.6V14" /></Ss>,
  type:      <Ss><path d="M2 2h5.2l6.8 6.8-5.2 5.2L2 7.2V2z" /><circle cx="5" cy="5" r="1.1" /></Ss>,
  user:      <Ss><circle cx="8" cy="5.6" r="2.6" /><path d="M3 14a5 5 0 0110 0" /></Ss>,
  supplier:  <Ss><rect x="1" y="5" width="8" height="6" rx="1" /><path d="M9 7.2h2.6L13.5 9.6V11H9" /><circle cx="4" cy="12.3" r="1.3" /><circle cx="11.3" cy="12.3" r="1.3" /></Ss>,
  factory:   <Ss><path d="M2 14V8.2l2.6 1.9V8.2l2.6 1.9V6.4l3.2 2.4V14H2z" /><path d="M2 14h10.6" /></Ss>,
  inventory: <Ss><rect x="2" y="3" width="12" height="3" rx="1" /><rect x="2" y="7.3" width="12" height="3" rx="1" /><rect x="2" y="11.6" width="7.5" height="2" rx="1" /></Ss>,
  batch:     <Ss><path d="M8 2l6 3-6 3-6-3 6-3z" /><path d="M2 8l6 3 6-3M2 11l6 3 6-3" /></Ss>,
  alert:     <Ss><path d="M8 2.2a3 3 0 00-3 3v2.1c0 .6-.2 1.1-.6 1.5L3 10h10l-1.4-1.2a2.1 2.1 0 01-.6-1.5V5.2a3 3 0 00-3-3z" /><path d="M6.5 12.3a1.5 1.5 0 003 0" /></Ss>,
  reorder:   <Ss><path d="M3 4.5h10M3 8h10M3 11.5h10" /><circle cx="6.3" cy="4.5" r="1.3" /><circle cx="10.7" cy="8" r="1.3" /><circle cx="7.3" cy="11.5" r="1.3" /></Ss>,
  sales:     <Ss><circle cx="6.2" cy="13.4" r="1.2" /><circle cx="12" cy="13.4" r="1.2" /><path d="M1.8 2h2l1.6 8.2c.1.7.7 1.2 1.5 1.2h5.4c.7 0 1.3-.5 1.5-1.2L15 5.2H4.3" /></Ss>,
  return:    <Ss><path d="M3.8 8a5.2 5.2 0 1 1 8.3 3.6" /><path d="M3.8 4v4h4" /></Ss>,
  purchase:  <Ss><path d="M4 6h8l1 8H3l1-8z" /><path d="M6 6V4.6a2 2 0 014 0V6" /></Ss>,
  payment:   <Ss><rect x="2" y="4" width="12" height="9" rx="2" /><path d="M2 7h12" /><circle cx="11.4" cy="9.6" r="1" /></Ss>,
  ledger:    <Ss><path d="M4.2 2h5.6l3 3v9H4.2V2z" /><path d="M6.2 8.2h4.8M6.2 10.6h4.8M6.2 5.6h2.2" /></Ss>,
  role:      <Ss><path d="M8 2.2l4.8 2v3.6c0 3-1.9 4.9-4.8 5.8-2.9-.9-4.8-2.8-4.8-5.8V4.2l4.8-2z" /><path d="M5.8 8l1.4 1.4L10.4 6" /></Ss>,
};

const subColorMap = {
  product: "#8b5cf6",
  type: "#a78bfa",
  user: "#22d3ee",
  supplier: "#fb923c",
  factory: "#f59e0b",
  inventory: "#10b981",
  batch: "#34d399",
  alert: "#f87171",
  reorder: "#fbbf24",
  sales: "#22d3ee",
  return: "#f87171",
  purchase: "#f59e0b",
  payment: "#34d399",
  ledger: "#f472b6",
  role: "#fbbf24",
};

const normalize = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const formatName = (name) =>
  name.toString().toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ── SubMenu panel ────────────────────────────────────────── */
function SubMenu({ items, sidebarOpen, onNavigate }) {
  const sortedItems = [...items]
    .map((item) => item.children
      ? { ...item, children: [...item.children].sort((a, b) => a.label.localeCompare(b.label)) }
      : item)
    .sort((a, b) => a.label.localeCompare(b.label));

  const renderItem = ({ label, key, icon, color, nested }) => (
    <div key={key} className={`sb-submenu-item ${nested ? "nested" : ""}`} onClick={() => onNavigate(key)}>
      <span className="sb-sub-chip" style={{ "--ssc-color": color || subColorMap.product }}>{icon || subIconMap.product}</span>
      <span>{label}</span>
    </div>
  );

  return (
    <div className="sb-submenu" style={{ left: sidebarOpen ? "var(--sb-w-open)" : "var(--sb-w-col)" }}>
      <div className="sb-submenu-glow-line" />
      {sortedItems.map((item) =>
        item.children ? (
          <div key={item.label} className="sb-sub-group">
            <div className="sb-subgroup-header">
              <span className="sb-sub-chip" style={{ "--ssc-color": item.color || subColorMap.product }}>{item.icon || subIconMap.product}</span>
              <span>{item.label}</span>
            </div>
            <div className="sb-subgroup-items">
              {item.children.map((child) => renderItem({ ...child, nested: true }))}
            </div>
          </div>
        ) : renderItem(item)
      )}
    </div>
  );
}

/* ── SidebarItem ──────────────────────────────────────────── */
function SidebarItem({ icon, color, label, open, onClick, hasSubmenu, isHovered, onMouseEnter, onMouseLeave, children }) {
  return (
    <div
      className={`sb-item ${hasSubmenu ? "has-submenu" : ""} ${isHovered ? "hovered" : ""}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-tooltip={label}
    >
      <span className="sb-icon-chip" style={{ "--sic-color": color || colorMap.default }}>{icon}</span>
      <span className={`sb-label ${open ? "visible" : ""}`}>{label}</span>
      {hasSubmenu && <span className="sb-caret"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5L7 5l-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
      {hasSubmenu && isHovered && children}
    </div>
  );
}

/* ── Divider ──────────────────────────────────────────────── */
function SidebarDivider() {
  return (
    <div className="sb-divider">
      <div className="sb-divider-line" />
    </div>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────── */
export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Access/GetModules`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => {
        if (data.status === 200 && Array.isArray(data.data)) {
          localStorage.setItem("modules", JSON.stringify(data.data));
          setModules(data.data);
        } else {
          localStorage.setItem("modules", JSON.stringify([]));
          setModules([]);
        }
      })
      .catch(() => setError("Failed to load modules."));
  }, []);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (
        sidebarRef.current && !sidebarRef.current.contains(e.target) &&
        toggleRef.current && !toggleRef.current.contains(e.target)
      ) { setOpen(false); setHoveredMenu(null); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNavigation = (moduleName) => {
    const path = String(moduleName)
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-");
    navigate(`/master/${path}`);
    setHoveredMenu(null);
  };

  const normalizedSet = new Set(modules.map((m) => normalize(m)));
  const find = (k) => modules.find((m) => normalize(m) === k) || null;
  const has = (k) => normalizedSet.has(normalize(k));

  /* ── Group: Masters ── */
  const hasProduct = has("product");
  const hasProductType = has("producttype");
  const hasRetailer = has("retailer");
  const hasSupplier = has("supplier");
  const hasManufacturer = has("manufacturer");
  const hasMasters = hasProduct || hasProductType || hasRetailer || hasSupplier || hasManufacturer;

  /* ── Group: Billing / Transactions ── */
  const hasSales = has("sales");
  const hasPurchase = has("purchase");
  const hasPayment = has("paymentcollection");
  const hasSupplierPayment = has("supplierpayment");
  const hasSalesReturn = has("salesreturn");
  const hasPurchaseReturn = has("purchasereturn");
  const hasRetailerOutstanding = has("retaileroutstanding");
  const hasSupplierOutstanding = has("supplieroutstanding");
  const hasBilling = hasSales || hasPurchase || hasPayment || hasSupplierPayment || hasSalesReturn || hasPurchaseReturn || hasRetailerOutstanding || hasSupplierOutstanding;

  /* ── Standalone items ── */
  const hasInventory = has("inventory");
  const hasBatch =   has("batch") || has("batches");
  const hasStockAdjustment = has("stockadjustment") || has("stockadjustments") || has("stock adjustment") || has("stock_adjustment");
  const hasExpiryAlerts = has("expiryalerts") || has("expiryalert") || has("alerts");
  const hasReorderAlerts = has("reorderalerts") || has("reorderalert") || has("lowstockalerts") || has("lowstockalert") || has("alerts");
  const hasDashboard = has("dashboard");
  const hasReports = has("reports") || has("report");
  const hasScheduler = has("scheduler");
  const hasBulkUpload = has("bulkuploadmanagement") || has("bulk upload") || has("bulk_upload");

  /* ── Group: Vendor & Roles ── */
  const hasVendor = has("vendor");
  const hasRoles = has("roles");
  const hasVendorGroup = hasVendor || hasRoles;

  /* ── Unknown/other modules ── */
  const knownKeys = [
    "product", "producttype", "retailer", "supplier", "manufacturer",
    "sales", "purchase", "paymentcollection",
    "inventory", "batch", "batches", "stockadjustment", "stockadjustments", "expiryalerts", "expiryalert", "reorderalerts", "reorderalert", "lowstockalerts", "lowstockalert", "alerts", "dashboard", "reports", "report", "scheduler",
    "bulkuploadmanagement", "bulk upload", "bulk_upload",
    "vendor", "roles", "supplierpayment", "salesreturn", "purchasereturn", "retaileroutstanding", "supplieroutstanding",
  ];
  const otherModules = modules.filter(m => !knownKeys.includes(normalize(m)));

  const searchResults = [
    { label: "Home", route: "/home" },
    hasDashboard && { label: "Dashboard", route: "/master/dashboard" },
    hasManufacturer && { label: "Manufacturer", route: "/master/manufacturer" },
    hasProduct && { label: "Product", route: "/master/product" },
    hasProductType && { label: "Product Type", route: "/master/product-type" },
    hasRetailer && { label: "Retailer", route: "/master/retailer" },
    hasSupplier && { label: "Supplier", route: "/master/supplier" },
    hasBatch && { label: "Batches", route: "/master/batch" },
    hasExpiryAlerts && { label: "Expiry Alerts", route: "/master/alerts" },
    hasInventory && { label: "Inventory", route: "/master/inventory" },
    hasReorderAlerts && { label: "Reorder Alerts", route: "/master/reorder-alerts" },
    hasStockAdjustment && { label: "Stock Adjustment", route: "/master/stock-adjustment" },
    hasPayment && { label: "Payment Collection", route: "/master/payment-collection" },
    hasPurchase && { label: "Purchase", route: "/master/purchase" },
    hasPurchaseReturn && { label: "Purchase Return", route: "/master/purchase-return" },
    hasRetailerOutstanding && { label: "Retailer Outstanding", route: "/master/retailer-outstanding" },
    hasSales && { label: "Sales", route: "/master/sales" },
    hasSalesReturn && { label: "Sales Return", route: "/master/sales-return" },
    hasSupplierOutstanding && { label: "Supplier Outstanding", route: "/master/supplier-outstanding" },
    hasSupplierPayment && { label: "Supplier Payment", route: "/master/supplier-payment" },
    hasBulkUpload && { label: "Bulk Data Upload", route: "/master/bulk-upload" },
    hasReports && { label: "Reports", route: "/master/reports" },
    hasScheduler && { label: "Job Scheduler", route: "/master/job-scheduler" },
    hasRoles && { label: "Roles", route: "/master/roles" },
    hasVendor && { label: "Vendor", route: "/master/vendor" },
    ...otherModules.map((module) => ({ label: formatName(module), key: module })),
  ].filter(Boolean)
    .filter((item) => item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <button
        className={`sb-toggle ${open ? "open" : ""}`}
        ref={toggleRef}
        onClick={() => setOpen(!open)}
        aria-label={open ? "Collapse navigation" : "Expand navigation"}
      >
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
      </button>

      <aside ref={sidebarRef} className={`sb-sidebar ${open ? "open" : ""}`}>
        <nav className={`sb-nav ${searchQuery ? "searching" : ""}`}>
          <div className="sb-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" /></svg>
            <input
              value={searchQuery}
              onFocus={() => setOpen(true)}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search modules"
              aria-label="Search modules"
            />
            {searchQuery && <button onClick={() => setSearchQuery("")} aria-label="Clear module search">×</button>}
          </div>

          {searchQuery && (
            <div className="sb-search-results">
              {searchResults.length ? searchResults.map((item) => (
                <button key={item.label} onClick={() => {
                  if (item.route) navigate(item.route);
                  else handleNavigation(item.key);
                  setSearchQuery("");
                }}>
                  {item.label}
                </button>
              )) : <span>No matching module</span>}
            </div>
          )}

          <SidebarItem
            icon={iconMap.home}
            color={colorMap.home}
            label="Home"
            open={open}
            onClick={() => navigate("/home")}
          />

          {hasDashboard && (
            <SidebarItem
              icon={iconMap.dashboard}
              color={colorMap.dashboard}
              label="Dashboard"
              open={open}
              onClick={() => handleNavigation(find("dashboard") || "dashboard")}
            />
          )}

          <SidebarDivider />

          {hasMasters && (
            <SidebarItem
              icon={iconMap.product}
              color={colorMap.product}
              label="Masters"
              open={open}
              hasSubmenu
              isHovered={hoveredMenu === "masters"}
              onMouseEnter={() => setHoveredMenu("masters")}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <SubMenu
                sidebarOpen={open}
                onNavigate={handleNavigation}
                items={[
                  hasManufacturer && { label: "Manufacturer", key: find("manufacturer") || "Manufacturer", icon: subIconMap.factory, color: subColorMap.factory },
                  hasSupplier && { label: "Supplier", key: find("supplier") || "Supplier", icon: subIconMap.supplier, color: subColorMap.supplier },
                  hasRetailer && { label: "Retailer", key: find("retailer") || "Retailer", icon: subIconMap.user, color: subColorMap.user },
                  hasProductType && { label: "Product Type", key: find("producttype") || "ProductType", icon: subIconMap.type, color: subColorMap.type },
                  hasProduct && { label: "Product", key: find("product") || "Product", icon: subIconMap.product, color: subColorMap.product },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {(hasInventory || hasBatch || hasStockAdjustment || hasExpiryAlerts || hasReorderAlerts) && (
            <SidebarItem
              icon={iconMap.inventory}
              color={colorMap.inventory}
              label="Inventory"
              open={open}
              hasSubmenu={hasInventory || hasBatch || hasStockAdjustment || hasExpiryAlerts || hasReorderAlerts}
              isHovered={hoveredMenu === "inventory"}
              onMouseEnter={() => setHoveredMenu("inventory")}
              onMouseLeave={() => setHoveredMenu(null)}
              onClick={() =>
                !(hasInventory || hasBatch || hasStockAdjustment || hasExpiryAlerts || hasReorderAlerts) &&
                handleNavigation(find("inventory") || "inventory")
              }
            >
              {(hasInventory || hasBatch || hasStockAdjustment || hasExpiryAlerts || hasReorderAlerts) && (
                <SubMenu
                  sidebarOpen={open}
                  onNavigate={handleNavigation}
                  items={[
                    hasInventory && {
                      label: "Inventory",
                      key: find("inventory") || "Inventory",
                      icon: subIconMap.inventory,
                      color: subColorMap.inventory,
                    },
                    hasBatch && {
                      label: "Batches",
                      key: find("batch") || find("batches") || "Batch",
                      icon: subIconMap.batch,
                      color: subColorMap.batch,
                    },
                    hasStockAdjustment && {
                      label: "Stock Adjustment",
                      key: find("stockadjustment") || find("stockadjustments") || find("stock adjustment") || find("stock_adjustment") || "StockAdjustment",
                      icon: subIconMap.reorder,
                      color: subColorMap.reorder,
                    },
                    hasExpiryAlerts && {
                      label: "Expiry Alerts",
                      key:
                        find("expiryalerts") ||
                        find("expiryalert") ||
                        find("alerts")||
                        "Alerts",
                      icon: subIconMap.alert,
                      color: subColorMap.alert,
                    },
                    hasReorderAlerts && {
                      label: "Reorder Alerts",
                      key: "ReorderAlerts",
                      icon: subIconMap.reorder,
                      color: subColorMap.reorder,
                    },
                  ].filter(Boolean)}
                />
              )}
            </SidebarItem>
          )}

          <SidebarDivider />

          {hasBilling && (
            <SidebarItem
              icon={iconMap.sales}
              color={colorMap.sales}
              label="Billing"
              open={open}
              hasSubmenu
              isHovered={hoveredMenu === "billing"}
              onMouseEnter={() => setHoveredMenu("billing")}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <SubMenu
                sidebarOpen={open}
                onNavigate={handleNavigation}
                items={[
                  (hasSales || hasSalesReturn) && {
                    label: "Sales",
                    icon: subIconMap.sales,
                    color: subColorMap.sales,
                    children: [
                      hasSales && { label: "Sales", key: find("sales") || "Sales", icon: subIconMap.sales, color: subColorMap.sales },
                      hasSalesReturn && { label: "Sales Return", key: find("salesreturn") || "SalesReturn", icon: subIconMap.return, color: subColorMap.return },
                    ].filter(Boolean),
                  },
                  (hasPurchase || hasPurchaseReturn) && {
                    label: "Purchase",
                    icon: subIconMap.purchase,
                    color: subColorMap.purchase,
                    children: [
                      hasPurchase && { label: "Purchase", key: find("purchase") || "Purchase", icon: subIconMap.purchase, color: subColorMap.purchase },
                      hasPurchaseReturn && { label: "Purchase Return", key: find("purchasereturn") || "PurchaseReturn", icon: subIconMap.return, color: subColorMap.return },
                    ].filter(Boolean),
                  },
                  (hasPayment || hasSupplierPayment) && {
                    label: "Payments",
                    icon: subIconMap.payment,
                    color: subColorMap.payment,
                    children: [
                      hasPayment && { label: "Payment Collection", key: find("paymentcollection") || "PaymentCollection", icon: subIconMap.payment, color: subColorMap.payment },
                      hasSupplierPayment && { label: "Supplier Payment", key: find("supplierpayment") || "SupplierPayment", icon: subIconMap.payment, color: subColorMap.payment },
                    ].filter(Boolean),
                  },
                  (hasRetailerOutstanding || hasSupplierOutstanding) && {
                    label: "Outstanding",
                    icon: subIconMap.ledger,
                    color: subColorMap.ledger,
                    children: [
                      hasRetailerOutstanding && { label: "Retailer Outstanding", key: find("retaileroutstanding") || "RetailerOutstanding", icon: subIconMap.ledger, color: subColorMap.ledger },
                      hasSupplierOutstanding && { label: "Supplier Outstanding", key: find("supplieroutstanding") || "SupplierOutstanding", icon: subIconMap.ledger, color: subColorMap.ledger },
                    ].filter(Boolean),
                  },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          <SidebarDivider />

          {hasReports && (
            <SidebarItem
              icon={iconMap.reports}
              color={colorMap.reports}
              label="Reports"
              open={open}
              onClick={() => handleNavigation(find("reports") || find("report") || "reports")}
            />
          )}

          {hasScheduler && (
            <SidebarItem
              icon={iconMap.scheduler}
              color={colorMap.scheduler}
              label="Scheduler"
              open={open}
              onClick={() => handleNavigation(find("scheduler") || "scheduler")}
            />
          )}

          {hasBulkUpload && (
            <SidebarItem
              icon={iconMap.bulkupload}
              color={colorMap.bulkupload}
              label="Bulk Data Upload"
              open={open}
              onClick={() => handleNavigation(find("bulkupload") || find("bulk upload management") || find("BULK_UPLOAD_MANAGEMENT") || "BulkUpload")}
            />
          )}

          <SidebarDivider />

          {hasVendorGroup && (
            <SidebarItem
              icon={iconMap.vendor}
              color={colorMap.vendor}
              label="Vendor & Roles"
              open={open}
              hasSubmenu
              isHovered={hoveredMenu === "vendor"}
              onMouseEnter={() => setHoveredMenu("vendor")}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <SubMenu
                sidebarOpen={open}
                onNavigate={handleNavigation}
                items={[
                  hasVendor && { label: "Vendor", key: find("vendor") || "Vendor", icon: subIconMap.user, color: subColorMap.user },
                  hasRoles && { label: "Roles", key: find("roles") || "Roles", icon: subIconMap.role, color: subColorMap.role },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {otherModules.map((mod) => (
            <SidebarItem
              key={mod}
              icon={iconMap[normalize(mod)] || iconMap.default}
              color={colorMap[normalize(mod)] || colorMap.default}
              label={formatName(mod)}
              open={open}
              onClick={() => handleNavigation(mod)}
            />
          ))}

          {error && <div className="sb-error">{error}</div>}

        </nav>
      </aside>
    </>
  );
}
