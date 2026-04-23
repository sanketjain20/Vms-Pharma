import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Sidebar.css";

/* ── Icon Map ─────────────────────────────────────────────── */
const iconMap = {
  home: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/>
    </svg>
  ),
  product: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M440-183v-274L200-596v274l240 139Zm80 0 240-139v-274L520-457v274Zm-80 92L160-252q-19-11-29.5-29T120-321v-318q0-22 10.5-40t29.5-29l280-161q19-11 40-11t40 11l280 161q19 11 29.5 29t10.5 40v318q0 22-10.5 40T800-252L520-91q-19 11-40 11t-40-11Zm200-528 77-44-237-137-78 45 238 136Zm-160 93 78-45-237-137-78 45 237 137Z"/>
    </svg>
  ),
  vendor: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
    </svg>
  ),
  sales: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M240-80q-50 0-85-35t-35-85v-120h120v-560l60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60v680q0 50-35 85t-85 35H240Zm480-80q17 0 28.5-11.5T760-200v-560H320v440h360v120q0 17 11.5 28.5T720-160Z"/>
    </svg>
  ),
  inventory: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M200-80q-33 0-56.5-23.5T120-160v-451q-18-11-29-28.5T80-680v-120q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v120q0 23-11 40.5T840-611v451q0 33-23.5 56.5T760-80H200Zm0-520v440h560v-440H200Zm-40-80h640v-120H160v120Zm200 280h240v-80H360v80Zm120 20Z"/>
    </svg>
  ),
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Zm80-400h160v-240H200v240Zm400 320h160v-240H600v240Zm0-480h160v-80H600v80ZM200-200h160v-80H200v80Zm160-320Zm240-160Zm0 240ZM360-280Z"/>
    </svg>
  ),
  reports: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>
    </svg>
  ),
  scheduler: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"/>
    </svg>
  ),
  default: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Z"/>
    </svg>
  ),
};

const normalize  = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const formatName = (name) =>
  name.toString().toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ── SubMenu panel ────────────────────────────────────────── */
function SubMenu({ items, sidebarOpen, onNavigate }) {
  return (
    <div className="sb-submenu" style={{ left: sidebarOpen ? 220 : 64 }}>
      <div className="sb-submenu-glow-line" />
      {items.map(({ label, key }) => (
        <div key={key} className="sb-submenu-item" onClick={() => onNavigate(key)}>
          <span className="sb-sub-dot" />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── SidebarItem ──────────────────────────────────────────── */
function SidebarItem({ icon, label, open, onClick, hasSubmenu, isHovered, onMouseEnter, onMouseLeave, children }) {
  return (
    <div
      className={`sb-item ${hasSubmenu ? "has-submenu" : ""} ${isHovered ? "hovered" : ""}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="sb-icon">{icon}</span>
      <span className={`sb-label ${open ? "visible" : ""}`}>{label}</span>
      {hasSubmenu && isHovered && children}
    </div>
  );
}

/* ── Divider ──────────────────────────────────────────────── */
function SidebarDivider({ open }) {
  return (
    <div className="sb-divider">
      <div className="sb-divider-line" />
    </div>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────── */
export default function Sidebar() {
  const [open,        setOpen]        = useState(false);
  const [modules,     setModules]     = useState([]);
  const [error,       setError]       = useState("");
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const navigate    = useNavigate();
  const sidebarRef  = useRef(null);
  const toggleRef   = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8080/api/Access/GetModules", {
      method: "GET", credentials: "include",
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
        toggleRef.current  && !toggleRef.current.contains(e.target)
      ) { setOpen(false); setHoveredMenu(null); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNavigation = (moduleName) => {
    navigate(`/master/${moduleName.toLowerCase().replace(/_/g, "-")}`);
    setHoveredMenu(null);
  };

  const normalizedSet = new Set(modules.map((m) => normalize(m)));
  const find = (k) => modules.find((m) => normalize(m) === k) || null;
  const has  = (k) => normalizedSet.has(normalize(k));

  /* ── Group: Masters ── */
  const hasProduct      = has("product");
  const hasProductType  = has("producttype");
  const hasRetailer     = has("retailer");
  const hasSupplier     = has("supplier");
  const hasManufacturer = has("manufacturer");
  const hasMasters      = hasProduct || hasProductType || hasRetailer || hasSupplier || hasManufacturer;

  /* ── Group: Billing / Transactions ── */
  const hasSales    = has("sales");
  const hasPurchase = has("purchase");
  const hasPayment  = has("paymentcollection");
  const hasSupplierPayment  = has("supplierpayment");
  const hasBilling  = hasSales || hasPurchase || hasPayment|| hasSupplierPayment;

  /* ── Standalone items ── */
  const hasInventory  = has("inventory");
  const hasDashboard  = has("dashboard");
  const hasReports    = has("reports") || has("report");
  const hasScheduler  = has("scheduler");

  /* ── Group: Vendor & Roles ── */
  const hasVendor = has("vendor");
  const hasRoles  = has("roles");
  const hasVendorGroup = hasVendor || hasRoles;

  /* ── Unknown/other modules ── */
  const knownKeys = [
    "product","producttype","retailer","supplier","manufacturer",
    "sales","purchase","paymentcollection",
    "inventory","dashboard","reports","report","scheduler",
    "vendor","roles","supplierpayment",
  ];
  const otherModules = modules.filter(m => !knownKeys.includes(normalize(m)));

  return (
    <>
      <button
        className={`sb-toggle ${open ? "open" : ""}`}
        ref={toggleRef}
        onClick={() => setOpen(!open)}
      >
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
      </button>

      <aside ref={sidebarRef} className={`sb-sidebar ${open ? "open" : ""}`}>
        <nav className="sb-nav">

          {/* 1 ── HOME (always visible) */}
          <SidebarItem
            icon={iconMap.home}
            label="Home"
            open={open}
            onClick={() => navigate("/home")}
          />

          {/* 2 ── DASHBOARD (standalone) */}
          {hasDashboard && (
            <SidebarItem
              icon={iconMap.dashboard}
              label="Dashboard"
              open={open}
              onClick={() => handleNavigation(find("dashboard") || "dashboard")}
            />
          )}

          <SidebarDivider open={open} />

          {/* 3 ── MASTERS (product, type, retailer, supplier, manufacturer) */}
          {hasMasters && (
            <SidebarItem
              icon={iconMap.product}
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
                  hasManufacturer && { label: "Manufacturer",  key: find("manufacturer")  || "Manufacturer"  },
                  hasSupplier     && { label: "Supplier",      key: find("supplier")      || "Supplier"      },
                  hasRetailer     && { label: "Retailer",      key: find("retailer")      || "Retailer"      },
                  hasProductType  && { label: "Product Type",  key: find("producttype")   || "ProductType"   },
                  hasProduct      && { label: "Product",       key: find("product")       || "Product"       },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* 4 ── INVENTORY (standalone) */}
          {hasInventory && (
            <SidebarItem
              icon={iconMap.inventory}
              label="Inventory"
              open={open}
              onClick={() => handleNavigation(find("inventory") || "inventory")}
            />
          )}

          <SidebarDivider open={open} />

          {/* 5 ── BILLING (sales, purchase, payment) */}
          {hasBilling && (
            <SidebarItem
              icon={iconMap.sales}
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
                  hasSales    && { label: "Sales",              key: find("sales")             || "Sales"             },
                  hasPurchase && { label: "Purchase",           key: find("purchase")          || "Purchase"          },
                  hasPayment  && { label: "Payment Collection", key: find("paymentcollection") || "PaymentCollection" },
                  hasSupplierPayment  && { label: "Supplier Payment", key: find("supplierpayment") || "SupplierPayment" },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          <SidebarDivider open={open} />

          {/* 6 ── REPORTS (standalone) */}
          {hasReports && (
            <SidebarItem
              icon={iconMap.reports}
              label="Reports"
              open={open}
              onClick={() => handleNavigation(find("reports") || find("report") || "reports")}
            />
          )}

          {/* 7 ── SCHEDULER (standalone) */}
          {hasScheduler && (
            <SidebarItem
              icon={iconMap.scheduler}
              label="Scheduler"
              open={open}
              onClick={() => handleNavigation(find("scheduler") || "scheduler")}
            />
          )}

          <SidebarDivider open={open} />

          {/* 8 ── VENDOR & ROLES (grouped) */}
          {hasVendorGroup && (
            <SidebarItem
              icon={iconMap.vendor}
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
                  hasVendor && { label: "Vendor", key: find("vendor") || "Vendor" },
                  hasRoles  && { label: "Roles",  key: find("roles")  || "Roles"  },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* 9 ── ANY OTHER unknown modules */}
          {otherModules.map((mod) => (
            <SidebarItem
              key={mod}
              icon={iconMap[normalize(mod)] || iconMap.default}
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
