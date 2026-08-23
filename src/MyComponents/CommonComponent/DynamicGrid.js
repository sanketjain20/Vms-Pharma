import React, { useEffect, useState, useRef } from "react";
import "../../Styles/DynamicGrid.css";
import { FaSearch } from "react-icons/fa";
import ModuleModal from "../CommonAEUDForm/ModuleModal";
import EditModal from "../CommonAEUDForm/EditModal";
import ViewModal from "../CommonAEUDForm/ViewModal";
import StatusModal from "../CommonAEUDForm/StatusModal";
import DownloadModal from "../CommonAEUDForm/DownloadModal";
import PaymentCollectionModal from "../CommonAEUDForm/PaymentCollectionModal";
import { Status } from "../Enums/Status.js";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ─── tiny xlsx writer ──────────────────────────────────────────────────────── */
function escapeXml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildXlsx(rows, colDefs) {
  const cols = colDefs.filter(c => c.field !== "Action");
  const strings = [];
  const strMap = {};
  const si = (v) => {
    const s = String(v ?? "");
    if (strMap[s] === undefined) { strMap[s] = strings.length; strings.push(s); }
    return strMap[s];
  };

  const sheetRows = [];

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;

  const headerCells = cols.map((c, i) => {
    const col = String.fromCharCode(65 + i);
    return `<c r="${col}1" t="s" s="1"><v>${si(c.header)}</v></c>`;
  });
  sheetRows.push(`<row r="1" ht="18" customHeight="1">${headerCells.join("")}</row>`);

  rows.forEach((row, ri) => {
    const cells = cols.map((c, ci) => {
      const col = String.fromCharCode(65 + ci);
      const rowNum = ri + 2;
      const raw = row[c.field];
      let val = "";
      if (raw !== undefined && raw !== null) {
        val = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
      }
      const num = !isNaN(raw) && raw !== "" && raw !== null && raw !== undefined && typeof raw !== "boolean";
      if (num) return `<c r="${col}${rowNum}"><v>${escapeXml(raw)}</v></c>`;
      return `<c r="${col}${rowNum}" t="s"><v>${si(val)}</v></c>`;
    });
    sheetRows.push(`<row r="${ri + 2}">${cells.join("")}</row>`);
  });

  const colsXml = `<cols>${cols.map((_, i) => `<col min="${i+1}" max="${i+1}" width="16" bestFit="1" customWidth="1"/>`).join("")}</cols>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${colsXml}
<sheetData>${sheetRows.join("")}</sheetData>
</worksheet>`;

  const sst = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">
${strings.map(s => `<si><t xml:space="preserve">${escapeXml(s)}</t></si>`).join("")}
</sst>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  return { sheetXml, sst, workbook, rels, wbRels, contentTypes, stylesXml };
}

async function downloadExcel(rows, colDefs, filename) {
  if (!window.__JSZip__) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload = () => { window.__JSZip__ = window.JSZip; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const JSZip = window.__JSZip__;
  const { sheetXml, sst, workbook, rels, wbRels, contentTypes, stylesXml } = buildXlsx(rows, colDefs);

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", wbRels);
  zip.file("xl/workbook.xml", workbook);
  zip.file("xl/_rels/workbook.xml.rels", rels);
  zip.file("xl/worksheets/sheet1.xml", sheetXml);
  zip.file("xl/sharedStrings.xml", sst);
  zip.file("xl/styles.xml", stylesXml);

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
/* ─────────────────────────────────────────────────────────────────────────── */

/* ── Animated count-up number ── */
function CountUp({ value, duration = 500 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display}</>;
}

/* ── ACTION ICONS — shared by table rows and grid cards ── */
const ActionIcon = {
  Edit: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/></svg>
  ),
  View: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M274-360q31 0 55.5-18t34.5-47l15-46q16-48-8-88.5T302-600H161l19 157q5 35 31.5 59t62.5 24Zm412 0q36 0 62.5-24t31.5-59l19-157H659q-45 0-69 41t-8 89l14 45q10 29 34.5 47t55.5 18Zm-412 80q-66 0-115.5-43.5T101-433L80-600H40v-80h262q44 0 80.5 21.5T440-600h81q21-37 57.5-58.5T659-680h261v80h-40l-21 167q-8 66-57.5 109.5T686-280q-57 0-102.5-32.5T520-399l-15-45q-2-7-4-14.5t-4-21.5h-34q-2 12-4 19.5t-4 14.5l-15 46q-18 54-63.5 87T274-280Z"/></svg>
  ),
  Activate: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
  ),
  Download: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>
  ),
  Payment: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M549-120 280-400h140q24 0 42-13.5t26-36.5H260v-70h228q-8-23-26-36.5T420-570H260v-70h420v70H552q11 15 18 32t10 38h100v70H581q-9 57-52.5 93.5T420-300h-6l232 180h-97ZM160-760q-33 0-56.5-23.5T80-840q0-33 23.5-56.5T160-920h640q33 0 56.5 23.5T880-840q0 33-23.5 56.5T800-760H160Zm0 640q-33 0-56.5-23.5T80-200v-480h80v480h640v-480h80v480q0 33-23.5 56.5T800-120H160Z"/></svg>
  ),
  Disable: () => (
    <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M819-28 701-146q-48 32-103.5 49T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-62 17-117.5T146-701L27-820l57-57L876-85l-57 57ZM480-160q45 0 85.5-12t76.5-33L487-360l-63 64-170-170 56-56 114 114 7-8-226-226q-21 36-33 76.5T160-480q0 133 93.5 226.5T480-160Zm335-100-59-59q21-35 32.5-75.5T800-480q0-133-93.5-226.5T480-800q-45 0-85.5 11.5T319-756l-59-59q48-31 103.5-48T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 61-17 116.5T815-260ZM602-474l-56-56 104-104 56 56-104 104Zm-64-64ZM424-424Z"/></svg>
  ),
  Excel: () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8.5 18l1.75-2.5L8.5 13h1.25L11 15l1.25-2h1.25l-1.75 2.5L13.5 18h-1.25L11 16l-1.25 2H8.5z"/></svg>
  ),
};

/* ── STAT ICONS — for the KPI card row ── */
const StatIcon = {
  Total: () => (
    <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="1" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.3"/><rect x="1" y="9" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.3"/><rect x="9" y="9" width="6" height="6" rx="1.3" stroke="currentColor" strokeWidth="1.3"/></svg>
  ),
  Check: () => (
    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.2 12L13 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  Cross: () => (
    <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.3" stroke="currentColor" strokeWidth="1.3"/><path d="M8 4.5V8l2.6 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
};

/* ── STAT CARD ROW — KPI summary above the toolbar, shared by every module ── */
function StatCards({ Module, total, breakdown }) {
  return (
    <div className="dg-stats">
      <div className="dg-stat-card dg-stat-card--accent">
        <span className="dg-stat-icon"><StatIcon.Total /></span>
        <span className="dg-stat-info">
          <span className="dg-stat-value"><CountUp value={total} /></span>
          <span className="dg-stat-label">Total {Module}</span>
        </span>
      </div>
      {breakdown.map(b => (
        <div key={b.key} className={`dg-stat-card dg-stat-card--${b.color}`}>
          <span className="dg-stat-icon">{b.icon}</span>
          <span className="dg-stat-info">
            <span className="dg-stat-value"><CountUp value={b.value} /></span>
            <span className="dg-stat-label">{b.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Row/card action buttons — one definition, reused by both views ── */
function RowActions({ row, selectedStatus, can, Module, isReadOnlyModule, hideActiveInactiveTabs, onEdit, onView, onDisable, onActivate, onDownload, onPaymentCollection }) {
  const canCollectPayment = Module === "Retailer Outstanding" || Module === "Supplier Outstanding";
  const paymentTitle = Module === "Supplier Outstanding" ? "Pay Supplier" : "Payment Collection";

  // Whether to show "Activate" vs "Disable" must follow the row's own
  // status, not which tab is currently selected — otherwise every row on
  // the "All" tab (which mixes active and inactive rows) shows the same
  // action, including already-inactive rows showing "Disable" again.
  const isRowInactive = !hideActiveInactiveTabs && Module !== "Sales" && row.disable === 1;

  if (isRowInactive) {
    return (
      <>
        <button className="dg-icon-btn dg-icon-btn--view" title="View" onClick={() => onView(row)}><ActionIcon.View /></button>
        {can("Disable") && <button className="dg-icon-btn dg-icon-btn--activate" title="Activate" onClick={() => onActivate(row)}><ActionIcon.Activate /></button>}
      </>
    );
  }

  return (
    <>
      {can("Edit") && !isReadOnlyModule && <button className="dg-icon-btn dg-icon-btn--edit" title="Edit" onClick={() => onEdit(row)}><ActionIcon.Edit /></button>}
      <button className="dg-icon-btn dg-icon-btn--view" title="View" onClick={() => onView(row)}><ActionIcon.View /></button>
      {canCollectPayment && <button className="dg-icon-btn dg-icon-btn--payment" title={paymentTitle} onClick={() => onPaymentCollection(row)}><ActionIcon.Payment /></button>}
      {Module === "Sales" && can("Download") && <button className="dg-icon-btn dg-icon-btn--download" title="Download" onClick={() => onDownload(row)}><ActionIcon.Download /></button>}
      {Module !== "Sales" && can("Disable") && !isReadOnlyModule && <button className="dg-icon-btn dg-icon-btn--disable" title="Disable" onClick={() => onDisable(row)}><ActionIcon.Disable /></button>}
    </>
  );
}

/* ── PAGINATION — shared by table + grid views ── */
function Pager({ page, totalPages, size, onPageChange, onSizeChange, className = "" }) {
  return (
    <div className={`dg-pager ${className}`}>
      <button className="dg-pager-btn" onClick={() => onPageChange(0)} disabled={page === 0} title="First page">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 2L3 5L7 8M4 2L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button className="dg-pager-btn" onClick={() => onPageChange(Math.max(page - 1, 0))} disabled={page === 0} title="Previous page">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div className="dg-pager-info">
        <span className="dg-pager-cur">{page + 1}</span>
        <span className="dg-pager-sep">/</span>
        <span className="dg-pager-tot">{totalPages}</span>
      </div>
      <button className="dg-pager-btn" onClick={() => onPageChange(Math.min(page + 1, totalPages - 1))} disabled={page + 1 >= totalPages} title="Next page">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button className="dg-pager-btn" onClick={() => onPageChange(totalPages - 1)} disabled={page + 1 >= totalPages} title="Last page">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8M6 2L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <select className="dg-pager-size" value={size} onChange={e => onSizeChange(Number(e.target.value))}>
        {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
      </select>
    </div>
  );
}

/* ── VIEW TOGGLE ── */
function ViewToggle({ view, onChange }) {
  return (
    <div className="dg-switch">
      <button className={`dg-switch-btn ${view === "table" ? "active" : ""}`} onClick={() => onChange("table")} title="Table view">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="14" height="3" rx="1"/><rect x="1" y="6" width="14" height="3" rx="1"/><rect x="1" y="11" width="14" height="3" rx="1"/>
        </svg>
        <span>Table</span>
      </button>
      <button className={`dg-switch-btn ${view === "grid" ? "active" : ""}`} onClick={() => onChange("grid")} title="Grid view">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>
        </svg>
        <span>Grid</span>
      </button>
      <div className={`dg-switch-thumb ${view}`} />
    </div>
  );
}

/* ── GRID CARD ── */
function GridItem({ row, columns, index, ...actionProps }) {
  const { Module } = actionProps;
  const dataCols = columns.filter(c => c.field !== "Action").slice(0, 6);

  const titleCol = dataCols[0];
  const titleVal = titleCol ? String(row[titleCol.field] ?? "") : `Record #${index + 1}`;

  const cardModuleKey = String(Module || "").toLowerCase().replace(/\s+/g, "");
  const hideStatus = [
    "purchase", "paymentcollection", "supplierpayment", "supplierpaymnet",
    "salesreturn", "purchasereturn", "stockadjustment",
    "retaileroutstanding", "supplieroutstanding", "batch",
  ].includes(cardModuleKey);
  const isActive = row.disable === 0;
  const statusColor = Module === "Sales"
    ? row.statusId === Status?.PaymentDone ? "green" : "amber"
    : isActive ? "green" : "red";
  const statusLabel = Module === "Sales"
    ? row.statusId === Status?.PaymentDone ? "Paid" : "Pending"
    : isActive ? "Active" : "Inactive";

  return (
    <div className={`dg-item ${!hideStatus ? `dg-item--${statusColor}` : ""}`} style={{ animationDelay: `${index * 0.03}s` }}>
      <div className="dg-item-top">
        <span className="dg-item-index">#{String(index + 1).padStart(3, "0")}</span>
        {!hideStatus && <span className={`dg-item-status dg-item-status--${statusColor}`}>{statusLabel}</span>}
      </div>

      <div className="dg-item-title" title={titleVal}>{titleVal}</div>

      <div className="dg-item-fields">
        {dataCols.slice(1).map((col, i) => {
          const val = row[col.field];
          let display = "";
          if (val !== undefined && val !== null) {
            display = typeof val === "number" ? val.toFixed(2) : typeof val === "object" ? JSON.stringify(val) : String(val);
          }
          return (
            <div key={i} className="dg-item-field">
              <span className="dg-item-field-key">{col.header}</span>
              <span className="dg-item-field-val" title={display}>{display || "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="dg-item-actions">
        <RowActions row={row} {...actionProps} />
      </div>
    </div>
  );
}

/* ── MAIN COMPONENT ── */
export default function DynamicGrid({ columns = [], apiUrl, Module, ModuleId, noPagination = false }) {
  const [allData, setAllData] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUkey, setEditUkey] = useState(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewUkey, setViewUkey] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusUkey, setStatusUkey] = useState(null);
  const [statusDisableValue, setStatusDisableValue] = useState(0);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [downloadId, setDownloadId] = useState(null);
  const [isPaymentCollectionOpen, setIsPaymentCollectionOpen] = useState(false);
  const [paymentCollectionUkey, setPaymentCollectionUkey] = useState(null);
  const [accessList, setAccessList] = useState([]);
  const [colWidths, setColWidths] = useState(() =>
    columns.map(c => c.width || `${Math.floor(100 / Math.max(columns.length, 1))}%`)
  );
  const [hoveredRow, setHoveredRow] = useState(null);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem("dg-view") || "table");
  const handleViewChange = (v) => { setViewMode(v); localStorage.setItem("dg-view", v); };

  const [xlDropOpen, setXlDropOpen] = useState(false);
  const [xlLoading, setXlLoading] = useState(false);
  const xlDropRef = useRef(null);
  const gridRequestRef = useRef(0);

  const can = (perm) => accessList.includes(perm);
  const moduleKey = String(Module || "").toLowerCase().replace(/\s+/g, "");
  const isReadOnlyModule = ["batch"].includes(moduleKey);
  const hideActiveInactiveTabs = [
    "purchase", "paymentcollection", "supplierpayment", "supplierpaymnet",
    "salesreturn", "purchasereturn", "stockadjustment",
    "retaileroutstanding", "supplieroutstanding", "batch",
  ].includes(moduleKey);

  useEffect(() => {
    if (!xlDropOpen) return;
    const handler = (e) => {
      if (xlDropRef.current && !xlDropRef.current.contains(e.target)) setXlDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [xlDropOpen]);

  const doExport = async (rows, label) => {
    setXlLoading(true);
    setXlDropOpen(false);
    try {
      const filename = `${Module || "export"}_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await downloadExcel(rows, columns, filename);
      toast.success(`Downloaded ${rows.length} rows`);
    } catch (err) {
      toast.error("Export failed");
    } finally {
      setXlLoading(false);
    }
  };

  const roleId = localStorage.getItem("roleId");

  useEffect(() => {
    if (!Module) return;
    apiClient(`${API_BASE_URL}/api/Access/GetUserModuleAccess/${ModuleId}/${roleId}`, { method: "GET" })
      .then(r => r.json())
      .then(res => { if (res.status === 200 && Array.isArray(res.data)) setAccessList(res.data); });
  }, [Module]);

  const refreshGrid = React.useCallback(() => {
    const query = new URLSearchParams({
      ...(searchText.trim() && { search: searchText.trim() }),
      tab: selectedStatus,
    });
    const requestUrl = noPagination
      ? `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}${query}`
      : `${apiUrl}/${page}/${size}?${query}`;

    const requestId = ++gridRequestRef.current;

    apiClient(requestUrl, { method: "GET" })
      .then(r => r.json())
      .then(res => {
        if (requestId !== gridRequestRef.current) return;
        if (res.status !== undefined && res.status !== 200) return;

        const payload = res.data ?? res;
        const list = Array.isArray(payload)
          ? payload
          : payload.content ?? payload.items ?? payload.records ?? payload.results ??
            Object.values(payload ?? {}).find(value => Array.isArray(value)) ?? [];
        const pageCount = Number(payload.totalPages ?? res.totalPages);
        const itemCount = Number(payload.totalElements ?? payload.totalItems ?? payload.totalCount ?? res.totalElements ?? res.totalItems ?? res.totalCount);

        setAllData(list);
        setTotalItems(Number.isFinite(itemCount) ? itemCount : list.length);
        setTotalPages(noPagination ? (Math.ceil(list.length / size) || 1) : (Number.isFinite(pageCount) ? Math.max(pageCount, 1) : (Math.ceil((itemCount || list.length) / size) || 1)));
      })
      .catch(() => {
        if (requestId !== gridRequestRef.current) return;
        setAllData([]);
        setTotalItems(0);
        setTotalPages(1);
      });
  }, [apiUrl, noPagination, page, size, searchText, selectedStatus]);

  useEffect(() => { refreshGrid(); }, [refreshGrid]);

  const counts = React.useMemo(() => {
    const all = allData.length;
    if (Module === "Sales") {
      return { all, payment_done: allData.filter(r => r.statusId === Status.PaymentDone).length, payment_pending: allData.filter(r => r.statusId === Status.PaymentPending).length };
    }
    return { all, active: allData.filter(r => r.disable === 0).length, inactive: allData.filter(r => r.disable === 1).length };
  }, [allData, Module]);

  const filteredData = allData
    .filter(row => {
      if (!noPagination) return true;
      if (Module === "Sales") {
        if (selectedStatus === "all") return true;
        if (selectedStatus === "payment_done") return row.statusId === Status.PaymentDone;
        if (selectedStatus === "payment_pending") return row.statusId === Status.PaymentPending;
      } else {
        if (selectedStatus === "all") return true;
        if (row.disable !== undefined) return selectedStatus === (row.disable === 0 ? "active" : "inactive");
      }
      return true;
    })
    .filter(row => noPagination && searchText ? Object.values(row).join(" ").toLowerCase().includes(searchText.toLowerCase()) : true);

  const pagedData = React.useMemo(() => {
    if (!noPagination) return filteredData;
    const start = page * size;
    return filteredData.slice(start, start + size);
  }, [filteredData, noPagination, page, size]);

  useEffect(() => {
    if (!noPagination) return;
    const pages = Math.ceil(filteredData.length / size) || 1;
    setTotalPages(pages);
    if (page >= pages) setPage(0);
  }, [filteredData.length, noPagination, page, size]);

  useEffect(() => { setPage(0); }, [selectedStatus]);

  useEffect(() => {
    if (hideActiveInactiveTabs && selectedStatus !== "all") {
      setSelectedStatus("all");
    }
  }, [hideActiveInactiveTabs, selectedStatus]);

  useEffect(() => {
    if (columns.length > 0)
      setColWidths(columns.map(c => c.width || `${Math.floor(100 / columns.length)}%`));
  }, []);

  const handleEdit = (row) => { setEditUkey(row.uKey); setIsEditOpen(true); };
  const handleView = (row) => { setViewUkey(row.uKey || row.ukey || row.batchUKey || row.batchId || row.id); setIsViewOpen(true); };
  const handleDisable = (row) => { setStatusUkey(row.uKey); setStatusDisableValue(0); setIsStatusOpen(true); };
  const handleActivate = (row) => { setStatusUkey(row.uKey); setStatusDisableValue(1); setIsStatusOpen(true); };
  const handleDownload = (row) => { setDownloadId(row.id); setIsDownloadOpen(true); };
  const handlePaymentCollection = (row) => { setPaymentCollectionUkey(row.uKey); setIsPaymentCollectionOpen(true); };

  const startResize = (index, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const th = document.getElementById(`col-${index}`);
    const startWidth = th.getBoundingClientRect().width;
    const onMouseMove = (mv) => {
      const newWidth = startWidth + (mv.clientX - startX);
      setColWidths(prev => { const u = [...prev]; u[index] = `${Math.max(newWidth, 60)}px`; return u; });
    };
    const onMouseUp = () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const totalColWidth = colWidths.reduce((sum, w) => sum + (parseInt(w) || 150), 0);

  const actionProps = {
    can, Module, isReadOnlyModule, hideActiveInactiveTabs,
    onEdit: handleEdit, onView: handleView, onDisable: handleDisable,
    onActivate: handleActivate, onDownload: handleDownload, onPaymentCollection: handlePaymentCollection,
  };

  const handleSizeChange = (s) => { setSize(s); setPage(0); };

  const statBreakdown = Module === "Sales"
    ? [
        { key: "payment_done", label: "Payment Done", value: counts.payment_done, color: "green", icon: <StatIcon.Check /> },
        { key: "payment_pending", label: "Pending", value: counts.payment_pending, color: "amber", icon: <StatIcon.Clock /> },
      ]
    : hideActiveInactiveTabs
    ? []
    : [
        { key: "active", label: "Active", value: counts.active, color: "green", icon: <StatIcon.Check /> },
        { key: "inactive", label: "Inactive", value: counts.inactive, color: "red", icon: <StatIcon.Cross /> },
      ];

  return (
    <div className="dg-panel">
      <div className="dg-panel-body">

        {/* ── STAT CARDS ── */}
        <StatCards
          Module={Module}
          total={noPagination ? filteredData.length : totalItems}
          breakdown={statBreakdown}
        />

        {/* ── TOOLBAR ── */}
        <div className="dg-toolbar">
          <div className="dg-search-box">
            <FaSearch className="dg-search-icon" />
            <input
              type="text"
              className="dg-search-input"
              placeholder={`Search ${Module || "records"}…`}
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setPage(0); }}
            />
            {searchText && (
              <button className="dg-search-clear" onClick={() => { setSearchText(""); setPage(0); }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>

          <div className="dg-toolbar-end">
            <div className="dg-count">
              <span className="dg-count-dot" />
              <CountUp value={noPagination ? filteredData.length : totalItems} /> records
            </div>

            <ViewToggle view={viewMode} onChange={handleViewChange} />

            {can("Add") && !isReadOnlyModule && (
              <button className="dg-btn-add" onClick={() => setIsModalOpen(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                Add {Module}
              </button>
            )}
          </div>
        </div>

        {/* ── FILTER ROW: tabs + export ── */}
        <div className="dg-filter-row">
          <div className="dg-tabs">
            {Module === "Sales" ? (
              [
                { key: "all", label: "All", count: counts.all },
                { key: "payment_done", label: "Payment Done", count: counts.payment_done },
                { key: "payment_pending", label: "Pending", count: counts.payment_pending },
              ].map(c => (
                <button key={c.key} className={`dg-tab ${selectedStatus === c.key ? "dg-tab--active" : ""}`} onClick={() => setSelectedStatus(c.key)}>
                  {c.label}
                  {selectedStatus === c.key && <span className="dg-tab-count"><CountUp value={c.count} duration={350} /></span>}
                </button>
              ))
            ) : hideActiveInactiveTabs ? (
              <button className="dg-tab dg-tab--active" onClick={() => setSelectedStatus("all")}>
                All
                <span className="dg-tab-count"><CountUp value={counts.all} duration={350} /></span>
              </button>
            ) : (
              [
                { key: "all", label: "All", count: counts.all },
                { key: "active", label: "Active", count: counts.active, color: "green" },
                { key: "inactive", label: "Inactive", count: counts.inactive, color: "red" },
              ].map(c => (
                <button key={c.key} className={`dg-tab ${selectedStatus === c.key ? "dg-tab--active" : ""} ${c.color ? `dg-tab--${c.color}` : ""}`} onClick={() => setSelectedStatus(c.key)}>
                  {c.label}
                  {selectedStatus === c.key && <span className="dg-tab-count"><CountUp value={c.count} duration={350} /></span>}
                </button>
              ))
            )}
          </div>

          <div className="dg-export" ref={xlDropRef}>
            <button className={`dg-export-btn ${xlLoading ? "dg-export-btn--loading" : ""}`} onClick={() => !xlLoading && setXlDropOpen(o => !o)} title="Export to Excel">
              {xlLoading ? <span className="dg-export-spinner" /> : <ActionIcon.Excel />}
              <span>Export</span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ transition: "transform 0.2s", transform: xlDropOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {xlDropOpen && (
              <div className="dg-export-menu">
                <div className="dg-export-menu-label">Export as Excel</div>
                <button className="dg-export-item" onClick={() => doExport(filteredData, "all")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download All
                  <span className="dg-export-badge">{filteredData.length}</span>
                </button>
                <button className="dg-export-item" onClick={() => doExport(pagedData, `page${page + 1}`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12l4 4 4-4"/>
                  </svg>
                  Current Page
                  <span className="dg-export-badge">{pagedData.length}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── TABLE VIEW ── */}
        {viewMode === "table" && (
          <div className="dg-table-card">
            <div className="dg-table-card-head">
              <div className="dg-table-card-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/><rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/><rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
                Data Grid
              </div>
              <div className="dg-table-card-meta">
                <span className="dg-meta-dot" />
                {pagedData.length} of {noPagination ? filteredData.length : totalItems} shown
              </div>
            </div>

            <div className="dg-table-scroll">
              <table className="dg-table" style={{ width: "100%", minWidth: totalColWidth + "px" }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((col, idx) => (
                      <th key={idx} id={`col-${idx}`} title={col.header} className="dg-th" style={{ width: colWidths[idx], minWidth: colWidths[idx] }}>
                        <span className="dg-th-label">
                          <span className="dg-col-index">{String(idx + 1).padStart(2, "0")}</span>
                          {col.header}
                        </span>
                        <div className="dg-col-resizer" onMouseDown={e => startResize(idx, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="dg-empty">
                        <div className="dg-empty-inner">
                          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
                            <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                          </svg>
                          No records found
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedData?.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={`dg-row ${hoveredRow === rowIdx ? "dg-row--hover" : ""}`}
                        style={{ animationDelay: `${rowIdx * 0.02}s` }}
                        onMouseEnter={() => setHoveredRow(rowIdx)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        {columns.map((col, colIdx) => {
                          if (col.field === "Action") {
                            return (
                              <td key={colIdx} className="dg-cell-actions">
                                <RowActions row={row} selectedStatus={selectedStatus} {...actionProps} />
                              </td>
                            );
                          }
                          const value = row[col.field];
                          let displayValue = "";
                          if (value !== undefined && value !== null) {
                            if (typeof value === "number") displayValue = value.toFixed(2);
                            else displayValue = typeof value === "object" ? JSON.stringify(value) : String(value);
                          }
                          return (
                            <td key={colIdx} className="dg-cell" title={displayValue}>
                              {displayValue || <span className="dg-cell-empty">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pager page={page} totalPages={totalPages} size={size} onPageChange={setPage} onSizeChange={handleSizeChange} />
          </div>
        )}

        {/* ── GRID VIEW ── */}
        {viewMode === "grid" && (
          <div className="dg-cards">
            {filteredData.length === 0 ? (
              <div className="dg-cards-empty">
                <svg width="30" height="30" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
                  <path d="M10 14h8M14 10v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                </svg>
                <p>No records found</p>
              </div>
            ) : (
              <>
                <div className="dg-cards-grid">
                  {pagedData.map((row, i) => (
                    <GridItem key={i} row={row} columns={columns} index={page * size + i} selectedStatus={selectedStatus} {...actionProps} />
                  ))}
                </div>
                <Pager page={page} totalPages={totalPages} size={size} onPageChange={setPage} onSizeChange={handleSizeChange} className="dg-pager--cards" />
              </>
            )}
          </div>
        )}
      </div>

      <ModuleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} moduleName={Module} onSubmit={refreshGrid} />
      <EditModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} moduleName={Module} uKey={editUkey} onSubmit={refreshGrid} />
      {isViewOpen && (
        <ViewModal isOpen={isViewOpen} onClose={() => { setIsViewOpen(false); setViewUkey(null); }} moduleName={Module} uKey={viewUkey} />
      )}
      <StatusModal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} moduleName={Module} uKey={statusUkey} isDisable={statusDisableValue} onSubmit={refreshGrid} />
      <DownloadModal isOpen={isDownloadOpen} onClose={() => setIsDownloadOpen(false)} moduleName={Module} id={downloadId} onSubmit={refreshGrid} />
      <PaymentCollectionModal
        isOpen={isPaymentCollectionOpen}
        onClose={() => { setIsPaymentCollectionOpen(false); setPaymentCollectionUkey(null); }}
        moduleName={Module}
        uKey={paymentCollectionUkey}
        onSubmit={refreshGrid}
      />
    </div>
  );
}
