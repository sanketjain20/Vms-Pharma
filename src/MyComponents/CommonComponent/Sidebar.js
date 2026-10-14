import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Sidebar.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { buildMenu, searchMenu } from "./sidebarMenu";

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
  intelligence: <S><path d="M10 2.8a4.6 4.6 0 00-2.6 8.4c.5.35.8.9.8 1.5V13h3.6v-.3c0-.6.3-1.15.8-1.5A4.6 4.6 0 0010 2.8z" /><path d="M8.2 15.4h3.6M8.7 17.2h2.6" /></S>,
  // Document with a lightning bolt — an invoice generated/signed electronically.
  einvoice: <S><path d="M6 2.5h5.5l3.5 3.5v11a1 1 0 01-1 1H6a1 1 0 01-1-1v-13.5a1 1 0 011-1z" /><path d="M11.5 2.5V6H15" /><path d="M11.3 8.7l-2.6 3.6h2.4l-2 3.5" /></S>,
  // Delivery truck — the e-way bill accompanies goods in transit.
  ewaybill: <S><rect x="2" y="6.2" width="9" height="6.8" rx="1" /><path d="M11 8.7h3.2L17 11.2v1.8h-6" /><circle cx="6" cy="15.3" r="1.6" /><circle cx="14" cy="15.3" r="1.6" /></S>,
  // Document with a checkmark — portal data matched/reconciled against books.
  gstr2recon: <S><path d="M4 3.5h6.5l3.5 3.5v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-12a1 1 0 011-1z" /><path d="M10.5 3.5V7H14" /><path d="M6.3 11.8l1.8 1.8 3.8-4" /></S>,
  // Person with a route pin — a salesman out on a beat.
  fieldsales: <S><circle cx="8" cy="6.5" r="2.6" /><path d="M3 16.5a5 5 0 0110 0" /><path d="M15.5 8.2c1.3 0 2.3 1 2.3 2.3 0 1.6-2.3 3.7-2.3 3.7s-2.3-2.1-2.3-3.7c0-1.3 1-2.3 2.3-2.3z" /></S>,
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
  intelligence: "#facc15",
  einvoice: "#14b8a6",
  ewaybill: "#f43f5e",
  gstr2recon: "#84cc16",
  fieldsales: "#f97316",
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
  dashboard: <Ss><rect x="2" y="2" width="12" height="12" rx="2.5" /><path d="M2 7h12M6.5 7V14" /></Ss>,
  intelligence: <Ss><path d="M8 1.8a3.7 3.7 0 00-2.1 6.7c.4.28.6.7.6 1.2V10h3v-.3c0-.5.2-.92.6-1.2A3.7 3.7 0 008 1.8z" /><path d="M6.6 12.2h2.8M7 13.6h2" /></Ss>,
  einvoice:  <Ss><path d="M5 1.8h4.2L12 4.6v8.6a.9.9 0 01-.9.9H5a.9.9 0 01-.9-.9V2.7A.9.9 0 015 1.8z" /><path d="M9.2 1.8v2.8H12" /><path d="M9 6.6l-2 2.9h1.9l-1.6 2.7" /></Ss>,
  ewaybill:  <Ss><rect x="1.6" y="5" width="7.2" height="5.4" rx="0.8" /><path d="M8.8 7h2.6l2.2 2v1.4H8.8" /><circle cx="4.8" cy="12.2" r="1.3" /><circle cx="11.6" cy="12.2" r="1.3" /></Ss>,
  gstr2recon: <Ss><path d="M3.2 1.8h5.2l2.8 2.8v7.7a.8.8 0 01-.8.8H3.2a.8.8 0 01-.8-.8V2.6a.8.8 0 01.8-.8z" /><path d="M8.4 1.8v2.8h2.8" /><path d="M5 9.4l1.4 1.4 3-3.3" /></Ss>,
  warehouse: <Ss><path d="M1.5 6.4L8 2l6.5 4.4V14H1.5V6.4z" /><path d="M6 14V9.5h4V14" /></Ss>,
  fieldrep:  <Ss><circle cx="6.5" cy="5" r="2.2" /><path d="M2.2 13.5a4.3 4.3 0 018.6 0" /><path d="M12.5 6.5c1 0 1.8.8 1.8 1.8 0 1.3-1.8 3-1.8 3s-1.8-1.7-1.8-3c0-1 .8-1.8 1.8-1.8z" /></Ss>,
  fieldcollection: <Ss><rect x="2" y="4" width="12" height="8" rx="1.4" /><circle cx="8" cy="8" r="1.8" /><path d="M4.2 6.2v.01M11.8 9.8v.01" /></Ss>,
  fieldorder: <Ss><path d="M4 2h6l3 3v8.5a.8.8 0 01-.8.8H4a.8.8 0 01-.8-.8V2.8A.8.8 0 014 2z" /><path d="M10 2v3h3" /><path d="M5.6 9l1.6 1.6 3-3.2" /></Ss>,
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
  dashboard: "#3b82f6",
  intelligence: "#facc15",
  einvoice: "#14b8a6",
  ewaybill: "#f43f5e",
  gstr2recon: "#84cc16",
  warehouse: "#06b6d4",
  fieldrep: "#f97316",
  fieldorder: "#fb923c",
  fieldcollection: "#fbbf24",
};

/* Icons for the pages and sub menus that have no dedicated glyph above. */
const SUB_ICONS = {
  ...subIconMap,
  home: <Ss><path d="M2 7.6L8 2.4l6 5.2" /><path d="M3.6 6.6V13a.8.8 0 00.8.8H6.6V10h2.8v3.8h2.2a.8.8 0 00.8-.8V6.6" /></Ss>,
  reports: <Ss><path d="M3 13.5V9M7 13.5V3.5M11 13.5V7M14.5 13.5V10" /></Ss>,
  scheduler: <Ss><circle cx="8" cy="8.4" r="5.6" /><path d="M8 5.4v3.2l2.4 1.6" /></Ss>,
  bulkupload: <Ss><path d="M8 10.5V3M8 3L5.4 5.6M8 3l2.6 2.6" /><path d="M3 10.8V12a.8.8 0 00.8.8h8.4a.8.8 0 00.8-.8v-1.2" /></Ss>,
  default: <Ss><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></Ss>,
};
const SUB_COLORS = {
  ...subColorMap,
  home: "#6366f1",
  reports: "#0ea5e9",
  scheduler: "#a78bfa",
  bulkupload: "#fb923c",
  default: "#6b7280",
};
const subIcon = (key) => SUB_ICONS[key] || SUB_ICONS.default;
const subColor = (key) => SUB_COLORS[key] || SUB_COLORS.default;

/* ── SubMenu panels (cascading) ───────────────────────────────
   Level 2 lists the sub menus and pages directly under a main menu; a sub menu shows a caret and opens
   level 3 (its pages) in a second panel beside it — hover, tap, Enter or the right arrow. Only one level-3
   panel is open at a time, so nothing is ever listed all at once. Order is the menu's own, not alphabetical. */
function SubMenu({ items, sidebarOpen, onSelect }) {
  const [openGroup, setOpenGroup] = useState(null);
  const group = items.find((i) => i.type === "group" && i.label === openGroup) || null;

  const renderLeaf = (leaf, inGroup) => (
    <div
      key={leaf.route || leaf.navKey}
      className="sb-submenu-item"
      role="menuitem"
      tabIndex={0}
      onMouseEnter={() => { if (!inGroup) setOpenGroup(null); }}
      onClick={(e) => { e.stopPropagation(); onSelect(leaf); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onSelect(leaf); } }}
    >
      <span className="sb-sub-chip" style={{ "--ssc-color": subColor(leaf.icon) }}>{subIcon(leaf.icon)}</span>
      <span className="sb-submenu-label">{leaf.label}</span>
    </div>
  );

  const baseLeft = sidebarOpen ? "var(--sb-w-open)" : "var(--sb-w-col)";

  return (
    <>
      <div className="sb-submenu" role="menu" style={{ left: baseLeft }}>
        <div className="sb-submenu-glow-line" />
        {items.map((item) =>
          item.type === "group" ? (
            <div
              key={item.label}
              className={`sb-submenu-item has-children ${openGroup === item.label ? "is-open" : ""}`}
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={openGroup === item.label}
              tabIndex={0}
              onMouseEnter={() => setOpenGroup(item.label)}
              onClick={(e) => { e.stopPropagation(); setOpenGroup((cur) => (cur === item.label ? null : item.label)); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "ArrowRight") { e.stopPropagation(); setOpenGroup(item.label); }
                if (e.key === "Escape" || e.key === "ArrowLeft") { e.stopPropagation(); setOpenGroup(null); }
              }}
            >
              <span className="sb-sub-chip" style={{ "--ssc-color": subColor(item.icon) }}>{subIcon(item.icon)}</span>
              <span className="sb-submenu-label">{item.label}</span>
              <span className="sb-sub-caret" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 1.5L7 5l-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </div>
          ) : renderLeaf(item, false)
        )}
      </div>

      {group && (
        <div
          className="sb-submenu sb-submenu--l3"
          role="menu"
          aria-label={group.label}
          style={{ "--sb-l2-left": baseLeft }}
        >
          <div className="sb-submenu-glow-line" />
          <div className="sb-l3-head">
            <button type="button" className="sb-l3-back" aria-label={`Back from ${group.label}`} onClick={(e) => { e.stopPropagation(); setOpenGroup(null); }}>‹</button>
            <span>{group.label}</span>
          </div>
          {group.children.map((c) => renderLeaf(c, true))}
        </div>
      )}
    </>
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

/* Main menu -> rail icon + accent colour (reusing the existing rail glyphs). */
const MAIN_LOOK = {
  home: { icon: iconMap.home, color: colorMap.home },
  overview: { icon: iconMap.dashboard, color: colorMap.dashboard },
  masters: { icon: iconMap.product, color: colorMap.product },
  inventory: { icon: iconMap.inventory, color: colorMap.inventory },
  billing: { icon: iconMap.sales, color: colorMap.sales },
  field: { icon: iconMap.fieldsales, color: colorMap.fieldsales },
  admin: { icon: iconMap.vendor, color: colorMap.vendor },
};

/* ── Main Sidebar ─────────────────────────────────────────── */
export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [modules, setModules] = useState([]);
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const navigate = useNavigate();
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);
  const closeTimer = useRef(null);

  const openMenu = (id) => { clearTimeout(closeTimer.current); setHoveredMenu(id); };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHoveredMenu(null), 140);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

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
      .catch(() => {});
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

  /* A page with an explicit route goes there; a module the menu doesn't know about falls back to its generated path. */
  const goTo = (leaf) => {
    if (leaf.route) {
      navigate(leaf.route);
    } else {
      const path = String(leaf.navKey)
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");
      navigate(`/master/${path}`);
    }
    setHoveredMenu(null);
  };

  const menu = useMemo(() => buildMenu(modules), [modules]);
  const searchResults = searchMenu(menu, searchQuery);

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
                <button key={`${item.path}/${item.label}`} onClick={() => { goTo(item); setSearchQuery(""); }}>
                  <span className="sb-sr-label">{item.label}</span>
                  <span className="sb-sr-path">{item.path}</span>
                </button>
              )) : <span>No matching module</span>}
            </div>
          )}

          {menu.map((main) => {
            const look = MAIN_LOOK[main.id] || { icon: iconMap.default, color: colorMap.default };
            const hasSubmenu = !main.direct;
            return (
              <SidebarItem
                key={main.id}
                icon={look.icon}
                color={look.color}
                label={main.label}
                open={open}
                hasSubmenu={hasSubmenu}
                isHovered={hoveredMenu === main.id}
                onMouseEnter={() => hasSubmenu && openMenu(main.id)}
                onMouseLeave={scheduleClose}
                /* tap/click also opens it, for touch screens that have no hover */
                onClick={() => (main.direct ? goTo(main.direct) : (clearTimeout(closeTimer.current), setHoveredMenu((cur) => (cur === main.id ? null : main.id))))}
              >
                {hasSubmenu && <SubMenu sidebarOpen={open} onSelect={goTo} items={main.items} />}
              </SidebarItem>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
