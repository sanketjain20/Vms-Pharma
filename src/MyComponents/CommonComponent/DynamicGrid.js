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
import {
  useCanvasThemeKey,
  getPerspectiveCanvasPalette,
  createOrbField,
  drawPerspectiveScene,
} from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ─── tiny xlsx writer ──────────────────────────────────────────────────────── */
function s2ab(s) {
  const buf = new ArrayBuffer(s.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
  return buf;
}

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

/* ── Animated count-up number (signature touch shared with Home) ── */
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

/* ── Mini pulse waveform — same signature motif as the Home page, scaled down ── */
function MiniPulse({ className = "" }) {
  return (
    <svg viewBox="0 0 120 24" className={`dg-mini-pulse ${className}`} preserveAspectRatio="none">
      <path
        d="M0,12 L24,12 L29,4 L34,20 L39,12 L58,12 L63,7 L68,17 L73,12 L92,12 L97,3 L102,21 L107,12 L120,12"
        fill="none"
      />
    </svg>
  );
}

/* ── VIEW TOGGLE ────────────────────────────────────────────────────────────── */
function ViewToggle({ view, onChange }) {
  return (
    <div className="dg-view-toggle">
      <button
        className={`dg-vt-btn ${view === "table" ? "active" : ""}`}
        onClick={() => onChange("table")}
        title="Table view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="14" height="3" rx="1"/>
          <rect x="1" y="6" width="14" height="3" rx="1"/>
          <rect x="1" y="11" width="14" height="3" rx="1"/>
        </svg>
        <span>Table</span>
      </button>
      <button
        className={`dg-vt-btn ${view === "grid" ? "active" : ""}`}
        onClick={() => onChange("grid")}
        title="Grid view"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="1.5"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5"/>
        </svg>
        <span>Grid</span>
      </button>
      <div className={`dg-vt-pill ${view}`} />
    </div>
  );
}

/* ── GRID CARD ─────────────────────────────────────────────────────────────── */
function GridCard({ row, columns, index, selectedStatus, can, Module, isReadOnlyModule, onEdit, onView, onDisable, onActivate, onDownload, onPaymentCollection }) {
  const dataCols = columns.filter(c => c.field !== "Action").slice(0, 6);

  const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
    </svg>
  );
  const IconView = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M274-360q31 0 55.5-18t34.5-47l15-46q16-48-8-88.5T302-600H161l19 157q5 35 31.5 59t62.5 24Zm412 0q36 0 62.5-24t31.5-59l19-157H659q-45 0-69 41t-8 89l14 45q10 29 34.5 47t55.5 18Z"/>
    </svg>
  );
  const IconActivate = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
    </svg>
  );
  const IconDownload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
    </svg>
  );
  const IconPaymentCollection = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M549-120 280-400h140q24 0 42-13.5t26-36.5H260v-70h228q-8-23-26-36.5T420-570H260v-70h420v70H552q11 15 18 32t10 38h100v70H581q-9 57-52.5 93.5T420-300h-6l232 180h-97ZM160-760q-33 0-56.5-23.5T80-840q0-33 23.5-56.5T160-920h640q33 0 56.5 23.5T880-840q0 33-23.5 56.5T800-760H160Zm0 640q-33 0-56.5-23.5T80-200v-480h80v480h640v-480h80v480q0 33-23.5 56.5T800-120H160Z"/>
    </svg>
  );
  const IconDisable = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 -960 960 960" width="13px" fill="currentColor">
      <path d="M819-28 701-146q-48 32-103.5 49T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-62 17-117.5T146-701L27-820l57-57L876-85l-57 57Z"/>
    </svg>
  );

  /* first non-action field as the "title" */
  const titleCol = dataCols[0];
  const titleVal = titleCol ? String(row[titleCol.field] ?? "") : `Record #${index + 1}`;

  /* status color */
  const cardModuleKey = String(Module || "").toLowerCase().replace(/\s+/g, "");
  const hideCardStatus = [
    "purchase",
    "paymentcollection",
    "supplierpayment",
    "supplierpaymnet",
    "salesreturn",
    "purchasereturn",
    "stockadjustment",
    "retaileroutstanding",
    "supplieroutstanding",
    "batch",
  ].includes(cardModuleKey);
  const isActive = row.disable === 0;
  const statusColor = Module === "Sales"
    ? row.statusId === Status?.PaymentDone ? "green" : "amber"
    : isActive ? "green" : "red";
  const statusLabel = Module === "Sales"
    ? row.statusId === Status?.PaymentDone ? "Paid" : "Pending"
    : isActive ? "Active" : "Inactive";
  const canCollectPayment = Module === "Retailer Outstanding" || Module === "Supplier Outstanding";
  const paymentActionTitle = Module === "Supplier Outstanding" ? "Pay Supplier" : "Payment Collection";

  return (
    <div className="dg-card" style={{ animationDelay: `${index * 0.04}s` }}>
      
      {!hideCardStatus && <div className={`dg-card-beam dg-card-beam-${statusColor}`} />}

      
      <div className="dg-card-corner dg-cc-tl" />
      <div className="dg-card-corner dg-cc-tr" />
      <div className="dg-card-corner dg-cc-bl" />
      <div className="dg-card-corner dg-cc-br" />

      
      <div className="dg-card-head">
        <div className="dg-card-idx">#{String(index + 1).padStart(3, "0")}</div>
        {!hideCardStatus && (
          <span className={`dg-card-status dg-card-status-${statusColor}`}>{statusLabel}</span>
        )}
      </div>

      
      <div className="dg-card-title" title={titleVal}>{titleVal}</div>

      
      <div className="dg-card-fields">
        {dataCols.slice(1).map((col, i) => {
          const val = row[col.field];
          let display = "";
          if (val !== undefined && val !== null) {
            display = typeof val === "number" ? val.toFixed(2) : typeof val === "object" ? JSON.stringify(val) : String(val);
          }
          return (
            <div key={i} className="dg-card-field">
              <span className="dg-card-field-key">{col.header}</span>
              <span className="dg-card-field-val" title={display}>{display || "—"}</span>
            </div>
          );
        })}
      </div>

      
      <div className="dg-card-actions">
        {selectedStatus === "inactive" ? (
          <>
            <button className="dg-card-btn view" title="View" onClick={() => onView(row)}><IconView /></button>
            {can("Disable") && <button className="dg-card-btn activate" title="Activate" onClick={() => onActivate(row)}><IconActivate /></button>}
          </>
        ) : (
          <>
            {can("Edit") && !isReadOnlyModule && <button className="dg-card-btn edit" title="Edit" onClick={() => onEdit(row)}><IconEdit /></button>}
            <button className="dg-card-btn view" title="View" onClick={() => onView(row)}><IconView /></button>
            {canCollectPayment && <button className="dg-card-btn payment-collection" title={paymentActionTitle} onClick={() => onPaymentCollection(row)}><IconPaymentCollection /></button>}
            {Module === "Sales" && can("Download") && <button className="dg-card-btn download" title="Download" onClick={() => onDownload(row)}><IconDownload /></button>}
            {(Module !== "Sales") && can("Disable") && !isReadOnlyModule && <button className="dg-card-btn disable" title="Disable" onClick={() => onDisable(row)}><IconDisable /></button>}
          </>
        )}
      </div>
    </div>
  );
}

/* ── MAIN COMPONENT ─────────────────────────────────────────────────────────── */
export default function DynamicGrid({ columns = [], apiUrl, Module, ModuleId, noPagination = false }) {
  const [data, setData] = useState([]);
  const [allData, setAllData] = useState([]);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [emptyMsg, setEmptyMsg] = useState("");
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

  /* ── view mode: "table" | "grid" ── */
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("dg-view") || "table");
  const handleViewChange = (v) => { setViewMode(v); localStorage.setItem("dg-view", v); };

  /* excel dropdown */
  const [xlDropOpen, setXlDropOpen] = useState(false);
  const [xlLoading, setXlLoading] = useState(false);
  const xlDropRef = useRef(null);

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const can = (perm) => accessList.includes(perm);
  const moduleKey = String(Module || "").toLowerCase().replace(/\s+/g, "");
  const isReadOnlyModule = ["batch"].includes(moduleKey);
  const hideActiveInactiveTabs = [
    "purchase",
    "paymentcollection",
    "supplierpayment",
    "supplierpaymnet",
    "salesreturn",
    "purchasereturn",
    "stockadjustment",
    "retaileroutstanding",
    "supplieroutstanding",
    "batch",
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

  /* 3D CANVAS BACKGROUND */
  const canvasThemeKey = useCanvasThemeKey();
  const orbsRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);

    const palette = getPerspectiveCanvasPalette();
    orbsRef.current = createOrbField(4, canvas.width, canvas.height, [215, 225, 230, 210], palette);

    let tick = 0;
    const draw = () => {
      tick++;
      drawPerspectiveScene(ctx, canvas, tick, {
        horizonRatio: 0.48,
        gridCount: 10,
        radialCount: 14,
        speed: 0.2,
        orbs: orbsRef.current,
      });
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animFrameRef.current); };
  }, [canvasThemeKey]);

  const roleId = localStorage.getItem("roleId");

  useEffect(() => {
    if (!Module) return;
    apiClient(`${API_BASE_URL}/api/Access/GetUserModuleAccess/${ModuleId}/${roleId}`, { method: "GET" })
      .then(r => r.json())
      .then(res => { if (res.status === 200 && Array.isArray(res.data)) setAccessList(res.data); });
  }, [Module]);

  const refreshGrid = React.useCallback(() => {
    apiClient(noPagination ? apiUrl : `${apiUrl}/0/100000`, { method: "GET" })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) {
          const dataObj = res.data;
          const list = Array.isArray(dataObj) ? dataObj : Object.values(dataObj ?? {}).find(v => Array.isArray(v)) || [];
          setAllData(list);
        }
      });
  }, [apiUrl, page, size]);

  useEffect(() => { refreshGrid(); }, [refreshGrid]);

  useEffect(() => {
    apiClient(noPagination ? apiUrl : `${apiUrl}/0/100000`, { method: "GET" })
      .then(r => r.json())
      .then(res => {
        const dataObj = res.data;
        const list = Array.isArray(dataObj) ? dataObj : Object.values(dataObj ?? {}).find(v => Array.isArray(v)) || [];
        setAllData(list);
      });
  }, [apiUrl]);

  const counts = React.useMemo(() => {
    const all = allData.length;
    if (Module === "Sales") {
      return { all, payment_done: allData.filter(r => r.statusId === Status.PaymentDone).length, payment_pending: allData.filter(r => r.statusId === Status.PaymentPending).length };
    }
    return { all, active: allData.filter(r => r.disable === 0).length, inactive: allData.filter(r => r.disable === 1).length };
  }, [allData, Module]);

  const filteredData = allData
    .filter(row => {
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
    .filter(row => searchText ? Object.values(row).join(" ").toLowerCase().includes(searchText.toLowerCase()) : true);

  const pagedData = React.useMemo(() => {
    const start = page * size;
    return filteredData.slice(start, start + size);
  }, [filteredData, page, size]);

  useEffect(() => {
    const pages = Math.ceil(filteredData.length / size) || 1;
    setTotalPages(pages);
    if (page >= pages) setPage(0);
  }, [filteredData.length, size]);

  useEffect(() => { setPage(0); }, [selectedStatus]);

  useEffect(() => {
    if (hideActiveInactiveTabs && (selectedStatus === "active" || selectedStatus === "inactive")) {
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

  /* ACTION ICONS */
  const IconEdit = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
    </svg>
  );
  const IconView = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M274-360q31 0 55.5-18t34.5-47l15-46q16-48-8-88.5T302-600H161l19 157q5 35 31.5 59t62.5 24Zm412 0q36 0 62.5-24t31.5-59l19-157H659q-45 0-69 41t-8 89l14 45q10 29 34.5 47t55.5 18Zm-412 80q-66 0-115.5-43.5T101-433L80-600H40v-80h262q44 0 80.5 21.5T440-600h81q21-37 57.5-58.5T659-680h261v80h-40l-21 167q-8 66-57.5 109.5T686-280q-57 0-102.5-32.5T520-399l-15-45q-2-7-4-14.5t-4-21.5h-34q-2 12-4 19.5t-4 14.5l-15 46q-18 54-63.5 87T274-280Z"/>
    </svg>
  );
  const IconActivate = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
    </svg>
  );
  const IconDownload = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
    </svg>
  );
  const IconPaymentCollection = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M549-120 280-400h140q24 0 42-13.5t26-36.5H260v-70h228q-8-23-26-36.5T420-570H260v-70h420v70H552q11 15 18 32t10 38h100v70H581q-9 57-52.5 93.5T420-300h-6l232 180h-97ZM160-760q-33 0-56.5-23.5T80-840q0-33 23.5-56.5T160-920h640q33 0 56.5 23.5T880-840q0 33-23.5 56.5T800-760H160Zm0 640q-33 0-56.5-23.5T80-200v-480h80v480h640v-480h80v480q0 33-23.5 56.5T800-120H160Z"/>
    </svg>
  );
  const IconDisable = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="15px" viewBox="0 -960 960 960" width="15px" fill="currentColor">
      <path d="M819-28 701-146q-48 32-103.5 49T480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-62 17-117.5T146-701L27-820l57-57L876-85l-57 57ZM480-160q45 0 85.5-12t76.5-33L487-360l-63 64-170-170 56-56 114 114 7-8-226-226q-21 36-33 76.5T160-480q0 133 93.5 226.5T480-160Zm335-100-59-59q21-35 32.5-75.5T800-480q0-133-93.5-226.5T480-800q-45 0-85.5 11.5T319-756l-59-59q48-31 103.5-48T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 61-17 116.5T815-260ZM602-474l-56-56 104-104 56 56-104 104Zm-64-64ZM424-424Z"/>
    </svg>
  );
  const IconExcel = () => (
    <svg xmlns="http://www.w3.org/2000/svg" height="13px" viewBox="0 0 24 24" width="13px" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM8.5 18l1.75-2.5L8.5 13h1.25L11 15l1.25-2h1.25l-1.75 2.5L13.5 18h-1.25L11 16l-1.25 2H8.5z"/>
    </svg>
  );

  const totalColWidth = colWidths.reduce((sum, w) => sum + (parseInt(w) || 150), 0);

  return (
    <div className="dg-wrapper">
      <canvas ref={canvasRef} className="dg-canvas" />
      <div className="dg-noise" />
      <div className="dg-glow-blob dg-glow-blob-a" />
      <div className="dg-glow-blob dg-glow-blob-b" />
      <div className="dg-top-beam" />

      <div className="dg-inner">

        
        <div className="dg-topbar">
          <div className="dg-search-wrap">
            <FaSearch className="dg-search-icon" />
            <input
              type="text"
              className="dg-search"
              placeholder={`      Search ${Module || "records"}…`}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
            {searchText && (
              <button className="dg-search-clear" onClick={() => setSearchText("")}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>

          <div className="dg-topbar-right">
            <div className="dg-record-count">
              <span className="dg-count-dot" />
              <CountUp value={filteredData.length} /> records
            </div>

            
            <ViewToggle view={viewMode} onChange={handleViewChange} />

            {can("Add") && !isReadOnlyModule && (
              <button className="dg-add-btn" onClick={() => setIsModalOpen(true)}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Add {Module}
              </button>
            )}
          </div>
        </div>

        
        <div className="dg-chips-row">
          <div className="dg-chips">
            {Module === "Sales" ? (
              <>
                {[
                  { key: "all", label: "All", count: counts.all },
                  { key: "payment_done", label: "Payment Done", count: counts.payment_done },
                  { key: "payment_pending", label: "Pending", count: counts.payment_pending },
                ].map(c => (
                  <button key={c.key} className={`dg-chip ${selectedStatus === c.key ? "dg-chip-active" : ""}`} onClick={() => setSelectedStatus(c.key)}>
                    {c.label}
                    <span className="dg-chip-count"><CountUp value={c.count} duration={350} /></span>
                  </button>
                ))}
              </>
            ) : hideActiveInactiveTabs ? (
              <button className={`dg-chip ${selectedStatus === "all" ? "dg-chip-active" : ""}`} onClick={() => setSelectedStatus("all")}>
                All
                <span className="dg-chip-count"><CountUp value={counts.all} duration={350} /></span>
              </button>
            ) : (
              <>
                {[
                  { key: "all", label: "All", count: counts.all },
                  { key: "active", label: "Active", count: counts.active, color: "green" },
                  { key: "inactive", label: "Inactive", count: counts.inactive, color: "red" },
                ].map(c => (
                  <button key={c.key} className={`dg-chip ${selectedStatus === c.key ? "dg-chip-active" : ""} ${c.color ? `dg-chip-${c.color}` : ""}`} onClick={() => setSelectedStatus(c.key)}>
                    {c.label}
                    <span className="dg-chip-count"><CountUp value={c.count} duration={350} /></span>
                  </button>
                ))}
              </>
            )}
          </div>

          
          <div className="dg-xl-wrap" ref={xlDropRef}>
            <button
              className={`dg-xl-btn ${xlLoading ? "dg-xl-btn--loading" : ""}`}
              onClick={() => !xlLoading && setXlDropOpen(o => !o)}
              title="Export to Excel"
            >
              {xlLoading ? <span className="dg-xl-spinner" /> : <IconExcel />}
              <span>Export</span>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ transition: "transform 0.2s", transform: xlDropOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M1 2.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {xlDropOpen && (
              <div className="dg-xl-drop">
                <div className="dg-xl-drop-label">Export as Excel</div>
                <button className="dg-xl-drop-item" onClick={() => doExport(filteredData, "all")}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download All
                  <span className="dg-xl-badge">{filteredData.length}</span>
                </button>
                <button className="dg-xl-drop-item" onClick={() => doExport(pagedData, `page${page + 1}`)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M12 8v8M8 12l4 4 4-4"/>
                  </svg>
                  Current Page
                  <span className="dg-xl-badge">{pagedData.length}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        
        {viewMode === "table" && (
          <div className="dg-shell">
            <div className="dg-shell-header">
              <div className="dg-shell-title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                  <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                </svg>
                Data Grid
                <MiniPulse />
              </div>
              <div className="dg-shell-meta">
                <span className="dg-shell-pulse" />
                {pagedData.length} of {filteredData.length} shown
              </div>
            </div>

            <div className="dg-scroll">
              <table className="dg-table" style={{ width: "100%", minWidth: totalColWidth + "px" }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {columns.map((col, idx) => (
                      <th key={idx} id={`col-${idx}`} title={col.header} className="dg-th"
                        style={{ width: colWidths[idx], minWidth: colWidths[idx] }}>
                        <span className="dg-th-inner">
                          <span className="dg-col-num">{String(idx + 1).padStart(2, "0")}</span>
                          {col.header}
                        </span>
                        <div className="dg-resizer" onMouseDown={e => startResize(idx, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {emptyMsg && filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="dg-empty">
                        <div className="dg-empty-inner">
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="12" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5"/>
                            <path d="M10 14h8M14 10v8" stroke="rgba(34,211,238,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          {emptyMsg}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pagedData?.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={`dg-row ${hoveredRow === rowIdx ? "dg-row-hovered" : ""}`}
                        style={{ animationDelay: `${rowIdx * 0.025}s` }}
                        onMouseEnter={() => setHoveredRow(rowIdx)}
                        onMouseLeave={() => setHoveredRow(null)}
                      >
                        {columns.map((col, colIdx) => {
                          if (col.field === "Action") {
                            return (
                              <td key={colIdx} className="dg-action-cell">
                                {selectedStatus === "inactive" ? (
                                  <>
                                    <button className="dg-action-btn view" title="View" onClick={() => handleView(row)}><IconView /></button>
                                    {can("Disable") && <button className="dg-action-btn activate" title="Activate" onClick={() => handleActivate(row)}><IconActivate /></button>}
                                  </>
                                ) : (
                                  <>
                                    {can("Edit") && !isReadOnlyModule && <button className="dg-action-btn edit" title="Edit" onClick={() => handleEdit(row)}><IconEdit /></button>}
                                    <button className="dg-action-btn view" title="View" onClick={() => handleView(row)}><IconView /></button>
                                    {(Module === "Retailer Outstanding" || Module === "Supplier Outstanding") && (
                                      <button
                                        className="dg-action-btn payment-collection"
                                        title={Module === "Supplier Outstanding" ? "Pay Supplier" : "Payment Collection"}
                                        onClick={() => handlePaymentCollection(row)}
                                      >
                                        <IconPaymentCollection />
                                      </button>
                                    )}
                                    {Module === "Sales" && can("Download") && <button className="dg-action-btn download" title="Download" onClick={() => handleDownload(row)}><IconDownload /></button>}
                                    {(Module !== "Sales") && can("Disable") && !isReadOnlyModule && <button className="dg-action-btn disable" title="Disable" onClick={() => handleDisable(row)}><IconDisable /></button>}
                                  </>
                                )}
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
                            <td key={colIdx} className="dg-td" title={displayValue}>
                              {displayValue || <span className="dg-td-empty">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            
            <div className="dg-pagination">
              <button className="dg-page-btn" onClick={() => setPage(0)} disabled={page === 0}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M7 2L3 5L7 8M4 2L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="dg-page-btn" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <div className="dg-page-indicator">
                <span className="dg-page-cur">{page + 1}</span>
                <span className="dg-page-sep">/</span>
                <span className="dg-page-tot">{totalPages}</span>
              </div>
              <button className="dg-page-btn" onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page + 1 >= totalPages}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="dg-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page + 1 >= totalPages}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 2L7 5L3 8M6 2L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <select className="dg-size-select" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>
                {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
              </select>
            </div>
          </div>
        )}

        
        {viewMode === "grid" && (
          <div className="dg-card-section">
            {filteredData.length === 0 ? (
              <div className="dg-card-empty">
                <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="12" stroke="rgba(139,92,246,0.25)" strokeWidth="1.5"/>
                  <path d="M10 14h8M14 10v8" stroke="rgba(34,211,238,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p>No records found</p>
              </div>
            ) : (
              <>
                <div className="dg-card-grid">
                  {pagedData.map((row, i) => (
                    <GridCard
                      key={i}
                      row={row}
                      columns={columns}
                      index={page * size + i}
                      selectedStatus={selectedStatus}
                      can={can}
                      Module={Module}
                      isReadOnlyModule={isReadOnlyModule}
                      onEdit={handleEdit}
                      onView={handleView}
                      onDisable={handleDisable}
                      onActivate={handleActivate}
                      onDownload={handleDownload}
                      onPaymentCollection={handlePaymentCollection}
                    />
                  ))}
                </div>

                
                <div className="dg-pagination dg-card-pagination">
                  <button className="dg-page-btn" onClick={() => setPage(0)} disabled={page === 0}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 2L3 5L7 8M4 2L4 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="dg-page-btn" onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <div className="dg-page-indicator">
                    <span className="dg-page-cur">{page + 1}</span>
                    <span className="dg-page-sep">/</span>
                    <span className="dg-page-tot">{totalPages}</span>
                  </div>
                  <button className="dg-page-btn" onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))} disabled={page + 1 >= totalPages}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="dg-page-btn" onClick={() => setPage(totalPages - 1)} disabled={page + 1 >= totalPages}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 2L7 5L3 8M6 2L6 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <select className="dg-size-select" value={size} onChange={e => { setSize(Number(e.target.value)); setPage(0); }}>
                    {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                  </select>
                </div>
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