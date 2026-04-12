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
  default: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Z"/>
    </svg>
  ),
};

const normalize = (s = "") => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const formatName = (name) =>
  name.toString().toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

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

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);

  useEffect(() => {
    fetch("http://localhost:8080/api/Access/GetModules", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (data.status === 200 && Array.isArray(data.data)){
           localStorage.setItem("modules", JSON.stringify(data.data)); 
          setModules(data.data);
        } else {
          localStorage.setItem("modules", JSON.stringify([]));
          setModules([]);
        }
      })
      .catch(() => setError("Failed to load modules."));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (
        sidebarRef.current && !sidebarRef.current.contains(e.target) &&
        toggleRef.current && !toggleRef.current.contains(e.target)
      ) {
        setOpen(false);
        setHoveredMenu(null);
      }
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

  // existing
  const hasProduct = normalizedSet.has("product");
  const hasProductType = normalizedSet.has("producttype");
  const hasRetailer = normalizedSet.has("retailer");
  const hasSupplier = normalizedSet.has("supplier");
  const hasManufacturer = normalizedSet.has("manufacturer");
  const hasPayment = normalizedSet.has("paymentcollection");

  // ✅ NEW
  const hasSales = normalizedSet.has("sales");
  const hasPurchase = normalizedSet.has("purchase");

  const hasVendor = normalizedSet.has("vendor");
  const hasRoles = normalizedSet.has("roles");

  const otherModules = modules.filter(
    (m) =>
      ![
        "product",
        "producttype",
        "retailer",
        "supplier",
        "manufacturer",
        "paymentcollection",
        "sales",
        "purchase",
        "vendor",
        "roles",
      ].includes(normalize(m))
  );

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

          <SidebarItem
            icon={iconMap.home}
            label="Home"
            open={open}
            onClick={() => navigate("/home")}
          />

          {/* MASTERS */}
          {(hasProduct || hasProductType || hasRetailer || hasSupplier || hasManufacturer) && (
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
                  hasProduct && { label: "Product", key: find("product") || "Product" },
                  hasProductType && { label: "Product Type", key: find("producttype") || "ProductType" },
                  hasRetailer && { label: "Retailer", key: find("retailer") || "Retailer" },
                  hasSupplier && { label: "Supplier", key: find("supplier") || "Supplier" },
                  hasManufacturer && { label: "Manufacturer", key: find("manufacturer") || "Manufacturer" },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* ✅ TRANSACTIONS (NEW) */}
          {(hasSales || hasPurchase || hasPayment) && (
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
                  hasSales && { label: "Sales", key: find("sales") || "Sales" },
                  hasPurchase && { label: "Purchase", key: find("purchase") || "Purchase" },
                  hasPayment && { label: "Payment Collection", key: find("paymentcollection") || "PaymentCollection" },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* VENDOR & ROLES */}
          {(hasVendor || hasRoles) && (
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
                  hasRoles && { label: "Roles", key: find("roles") || "Roles" },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* OTHER */}
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

function SidebarItem({
  icon,
  label,
  open,
  onClick,
  hasSubmenu,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  children,
}) {
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