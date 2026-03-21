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
  producttype: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="m260-520 220-360 220 360H260ZM700-80q-75 0-127.5-52.5T520-260q0-75 52.5-127.5T700-440q75 0 127.5 52.5T880-260q0 75-52.5 127.5T700-80Zm-580-20v-320h320v320H120Zm580-60q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29Zm-500-20h160v-160H200v160Zm202-420h156l-78-126-78 126Zm78 0ZM36₀-34₀Zm34₀ 8₀Z"/>
    </svg>
  ),
  vendor: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
    </svg>
  ),
  inventory: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M620-163 450-333l56-56 114 114 226-226 56 56-282 282Zm220-397h-80v-200h-80v120H280v-120h-80v560h240v80H200q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h167q11-35 43-57.5t70-22.5q40 0 71.5 22.5T594-840h166q33 0 56.5 23.5T840-760v200Z"/>
    </svg>
  ),
  sales: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M240-80q-50 0-85-35t-35-85v-120h120v-560l60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60 60 60 60-60v680q0 50-35 85t-85 35H240Zm480-80q17 0 28.5-11.5T760-200v-560H320v440h360v120q0 17 11.5 28.5T720-160Z"/>
    </svg>
  ),
  roles: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M480-440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35ZM240-40v-309q-38-42-59-96t-21-115q0-134 93-227t227-93q134 0 227 93t93 227q0 61-21 115t-59 96v309l-240-80-240 80Z"/>
    </svg>
  ),
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF">
      <path d="M520-600v-240h320v240H520ZM120-440v-400h320v400H120Zm400 320v-400h320v400H520Zm-400 0v-240h320v240H120Z"/>
    </svg>
  ),
  jobscheduler: (
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#ffffff">
      <path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
    </svg>
  ),
  reports: (
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M280-280h80v-200h-80v200Zm320 0h80v-400h-80v400Zm-160 0h80v-120h-80v120Zm0-200h80v-80h-80v80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/></svg>
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

/* ── Submenu Panel ────────────────────────────────────────── */
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

/* ── Main Component ───────────────────────────────────────── */
export default function Sidebar() {
  const [open, setOpen]           = useState(false);
  const [modules, setModules]     = useState([]);
  const [error, setError]         = useState("");
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const navigate    = useNavigate();
  const sidebarRef  = useRef(null);
  const toggleRef   = useRef(null);

  /* Fetch modules */
  useEffect(() => {
    fetch("http://localhost:8080/api/Access/GetModules", {
      method: "GET",
      credentials: "include",
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

  /* Close on outside click */
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

  const hasProduct     = normalizedSet.has("product");
  const hasProductType = normalizedSet.has("producttype");
  const hasVendor      = normalizedSet.has("vendor");
  const hasRoles       = normalizedSet.has("roles");

  const otherModules = modules.filter(
    (m) => !["product", "producttype", "vendor", "roles"].includes(normalize(m))
  );

  return (
    <>
      {/* ── Toggle Button ─────────────────────────────────── */}
      <button className={`sb-toggle ${open ? "open" : ""}`} ref={toggleRef} onClick={() => setOpen(!open)} aria-label="Toggle sidebar">
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
        <span className="sb-toggle-bar" />
      </button>

      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside ref={sidebarRef} className={`sb-sidebar ${open ? "open" : ""}`}>

        {/* Top glow line */}
        <div className="sb-top-glow" />
        {/* Scanline */}
        <div className="sb-scan" />

        <nav className="sb-nav">

          {/* HOME */}
          <SidebarItem
            icon={iconMap.home}
            label="Home"
            tooltip="Home"
            open={open}
            onClick={() => navigate("/home")}
          />

          {/* PRODUCT & TYPE */}
          {(hasProduct || hasProductType) && (
            <SidebarItem
              icon={iconMap.product}
              label="Product & Type"
              tooltip="Product & Type"
              open={open}
              hasSubmenu
              isHovered={hoveredMenu === "product"}
              onMouseEnter={() => setHoveredMenu("product")}
              onMouseLeave={() => setHoveredMenu(null)}
            >
              <SubMenu
                sidebarOpen={open}
                onNavigate={handleNavigation}
                items={[
                  hasProduct     && { label: "Product",      key: find("product")     || "Product" },
                  hasProductType && { label: "Product Type", key: find("producttype") || "ProductType" },
                ].filter(Boolean)}
              />
            </SidebarItem>
          )}

          {/* VENDOR & ROLES */}
          {(hasVendor || hasRoles) && (
            <SidebarItem
              icon={iconMap.vendor}
              label="Vendor & Roles"
              tooltip="Vendor & Roles"
              open={open}
              hasSubmenu
              isHovered={hoveredMenu === "vendorroles"}
              onMouseEnter={() => setHoveredMenu("vendorroles")}
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

          {/* OTHER MODULES */}
          {otherModules.map((mod) => (
            <SidebarItem
              key={mod}
              icon={iconMap[normalize(mod)] || iconMap.default}
              label={formatName(mod)}
              tooltip={formatName(mod)}
              open={open}
              onClick={() => handleNavigation(mod)}
            />
          ))}

          {error && (
            <div className="sb-error">
              <span>{error}</span>
            </div>
          )}
        </nav>

        {/* Bottom accent */}
        <div className="sb-bottom-accent">
          <span className="sb-bottom-dot" />
        </div>
      </aside>
    </>
  );
}

/* ── Reusable Item ────────────────────────────────────────── */
function SidebarItem({
  icon, label, tooltip, open, onClick,
  hasSubmenu, isHovered, onMouseEnter, onMouseLeave, children,
}) {
  return (
    <div
      className={`sb-item ${hasSubmenu ? "has-submenu" : ""} ${isHovered ? "hovered" : ""}`}
      data-tooltip={!open ? tooltip : undefined}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="sb-icon">{icon}</span>
      <span className={`sb-label ${open ? "visible" : ""}`}>{label}</span>

      {hasSubmenu && (
        <span className={`sb-chevron ${open ? "visible" : ""} ${isHovered ? "rotated" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )}

      {/* Active indicator bar */}
      <span className="sb-active-bar" />

      {/* Submenu */}
      {hasSubmenu && isHovered && children}
    </div>
  );
}
