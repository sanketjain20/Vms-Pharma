import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../../Styles/Report/GenerateReport.css";
import { ReportEntity } from "../Enums/ReportEntity.js";
import {
  useCanvasThemeKey,
  getPerspectiveCanvasPalette,
  drawPerspectiveScene,
  isLightTheme,
} from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ═══════════════════════════════════════════════════════════════
   SHARED FORMAT HELPER
═══════════════════════════════════════════════════════════════ */
const fmt = (n) =>
  parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

/* ═══════════════════════════════════════════════════════════════
   GSTR PAGINATION  (defined outside — stable identity)
═══════════════════════════════════════════════════════════════ */
const GstrPagination = React.memo(
  ({ page, totalPages, pageSize, onPageChange, onPageSizeChange }) => (
    <div className="gstr-pagination">
      <button
        className="gstr-page-btn"
        disabled={page === 1}
        onClick={() => onPageChange(Math.max(page - 1, 1))}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Prev
      </button>
      <div className="gstr-page-indicator">
        <span className="page-num">{page}</span>
        <span className="page-sep">/</span>
        <span className="page-total">{totalPages || 1}</span>
      </div>
      <button
        className="gstr-page-btn"
        disabled={page === totalPages || totalPages === 0}
        onClick={() => onPageChange(Math.min(page + 1, totalPages))}
      >
        Next
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <select
        className="gstr-page-select"
        value={pageSize}
        onChange={(e) => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }}
      >
        {[10, 20, 50, 100].map((s) => (
          <option key={s} value={s}>{s} / page</option>
        ))}
      </select>
    </div>
  )
);
GstrPagination.displayName = "GstrPagination";

/* ═══════════════════════════════════════════════════════════════
   GSTR B2B TABLE
═══════════════════════════════════════════════════════════════ */
const GstrB2BTable = React.memo(({ data }) => {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(data.length / pageSize);
  const paged      = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="gstr-table-section">
      <div className="gstr-table-wrap">
        <table className="gstr-table">
          <thead>
            <tr>
              {["GSTIN","Receiver Name","Phone","Invoice No","Date","Type",
                "Place of Supply","Taxable (₹)","IGST (₹)","CGST (₹)",
                "SGST (₹)","Total (₹)"].map((h, i) => (
                <th key={i}>
                  <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={12} className="gstr-empty">No B2B entries for this period</td></tr>
            ) : paged.map((r, i) => (
              <tr key={i}>
                <td className="gstr-td-mono gstr-accent">{r.receiverGstin}</td>
                <td>{r.receiverName}</td>
                <td className="gstr-td-mono">{r.receiverPhone || "—"}</td>
                <td className="gstr-td-mono">{r.invoiceNumber}</td>
                <td className="gstr-td-dim">{r.invoiceDate || "—"}</td>
                <td><span className="gstr-type-tag">{r.invoiceType}</span></td>
                <td className="gstr-td-dim">{r.placeOfSupply}</td>
                <td className="gstr-td-amount">₹{fmt(r.taxableValue)}</td>
                <td className="gstr-td-tax">{r.igst > 0 ? `₹${fmt(r.igst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.cgst > 0 ? `₹${fmt(r.cgst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.sgst > 0 ? `₹${fmt(r.sgst)}` : "—"}</td>
                <td className="gstr-td-total">₹{fmt(r.totalInvoiceValue)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7} className="gstr-tf-label">Totals ({data.length} invoices)</td>
                <td className="gstr-td-amount">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.taxableValue||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.igst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.cgst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.sgst||0),0))}</td>
                <td className="gstr-td-total">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.totalInvoiceValue||0),0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.length > pageSize && (
        <GstrPagination page={page} totalPages={totalPages} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
});
GstrB2BTable.displayName = "GstrB2BTable";

/* ═══════════════════════════════════════════════════════════════
   GSTR B2C TABLE
═══════════════════════════════════════════════════════════════ */
const GstrB2CTable = React.memo(({ data }) => {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(data.length / pageSize);
  const paged      = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="gstr-table-section">
      <div className="gstr-table-wrap">
        <table className="gstr-table">
          <thead>
            <tr>
              {["Invoice No","Date","Customer Name","Place of Supply",
                "Taxable (₹)","IGST (₹)","CGST (₹)","SGST (₹)","Total (₹)"].map((h, i) => (
                <th key={i}>
                  <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={9} className="gstr-empty">No B2C entries for this period</td></tr>
            ) : paged.map((r, i) => (
              <tr key={i}>
                <td className="gstr-td-mono">{r.invoiceNumber}</td>
                <td className="gstr-td-dim">{r.invoiceDate || "—"}</td>
                <td>{r.customerName || "Walk-in"}</td>
                <td className="gstr-td-dim">{r.placeOfSupply}</td>
                <td className="gstr-td-amount">₹{fmt(r.taxableValue)}</td>
                <td className="gstr-td-tax">{r.igst > 0 ? `₹${fmt(r.igst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.cgst > 0 ? `₹${fmt(r.cgst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.sgst > 0 ? `₹${fmt(r.sgst)}` : "—"}</td>
                <td className="gstr-td-total">₹{fmt(r.totalInvoiceValue)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="gstr-tf-label">Totals ({data.length} invoices)</td>
                <td className="gstr-td-amount">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.taxableValue||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.igst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.cgst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.sgst||0),0))}</td>
                <td className="gstr-td-total">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.totalInvoiceValue||0),0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.length > pageSize && (
        <GstrPagination page={page} totalPages={totalPages} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
});
GstrB2CTable.displayName = "GstrB2CTable";

/* ═══════════════════════════════════════════════════════════════
   GSTR HSN TABLE
═══════════════════════════════════════════════════════════════ */
const GstrHsnTable = React.memo(({ data }) => {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(data.length / pageSize);
  const paged      = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="gstr-table-section">
      <div className="gstr-table-wrap">
        <table className="gstr-table">
          <thead>
            <tr>
              {["HSN Code","Description","UOM","Qty","Taxable (₹)","Tax Rate %",
                "IGST (₹)","CGST (₹)","SGST (₹)","Total Tax (₹)","Total Value (₹)"].map((h, i) => (
                <th key={i}>
                  <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={11} className="gstr-empty">No HSN entries for this period</td></tr>
            ) : paged.map((r, i) => (
              <tr key={i}>
                <td className="gstr-td-mono gstr-accent">{r.hsnCode}</td>
                <td>{r.description}</td>
                <td className="gstr-td-dim">{r.uom}</td>
                <td className="gstr-td-mono">{r.totalQuantity}</td>
                <td className="gstr-td-amount">₹{fmt(r.taxableValue)}</td>
                <td><span className="gstr-rate-tag">{r.taxRate}%</span></td>
                <td className="gstr-td-tax">{r.igst > 0 ? `₹${fmt(r.igst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.cgst > 0 ? `₹${fmt(r.cgst)}` : "—"}</td>
                <td className="gstr-td-tax">{r.sgst > 0 ? `₹${fmt(r.sgst)}` : "—"}</td>
                <td className="gstr-td-tax">₹{fmt(r.totalTax)}</td>
                <td className="gstr-td-total">₹{fmt(r.totalValue)}</td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className="gstr-tf-label">Totals ({data.length} HSN codes)</td>
                <td className="gstr-td-mono">{data.reduce((s,r)=>s+(r.totalQuantity||0),0)}</td>
                <td className="gstr-td-amount">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.taxableValue||0),0))}</td>
                <td />
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.igst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.cgst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.sgst||0),0))}</td>
                <td className="gstr-td-tax">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.totalTax||0),0))}</td>
                <td className="gstr-td-total">₹{fmt(data.reduce((s,r)=>s+parseFloat(r.totalValue||0),0))}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {data.length > pageSize && (
        <GstrPagination page={page} totalPages={totalPages} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
});
GstrHsnTable.displayName = "GstrHsnTable";

/* ═══════════════════════════════════════════════════════════════
   P&L STATEMENT COMPONENT  (outside — stable identity)
═══════════════════════════════════════════════════════════════ */
const PnlStatement = React.memo(({ data }) => {
  const isProfit = parseFloat(data.netProfit || 0) >= 0;

  const kpiConfig = [
    { key: "grossSales",        label: "Gross Sales",   icon: "₹", color: "#3b82f6", glow: "rgba(59,130,246,0.4)"  },
    { key: "netRevenue",        label: "Net Revenue",   icon: "→", color: "#06b6d4", glow: "rgba(6,182,212,0.4)"   },
    { key: "cogs",              label: "COGS",          icon: "C", color: "#f59e0b", glow: "rgba(245,158,11,0.4)"  },
    { key: "grossProfit",       label: "Gross Profit",  icon: "↑",
      color: parseFloat(data.grossProfit||0) >= 0 ? "#10b981" : "#ef4444",
      glow:  parseFloat(data.grossProfit||0) >= 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)" },
    { key: "grossProfitMargin", label: "Gross Margin",  icon: "%", color: "#8b5cf6", glow: "rgba(139,92,246,0.4)", suffix: "%" },
    { key: "netProfit",         label: "Net Profit",    icon: "N",
      color: isProfit ? "#10b981" : "#ef4444",
      glow:  isProfit ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)" },
    { key: "netProfitMargin",   label: "Net Margin",    icon: "%", color: "#ec4899", glow: "rgba(236,72,153,0.4)", suffix: "%" },
    { key: "taxCollected",      label: "GST Collected", icon: "G", color: "#f97316", glow: "rgba(249,115,22,0.4)"  },
  ];

  return (
    <>
      {/* ── KPI Cards — reuses rev-card + rev-summary ── */}
      <div className="rev-summary gstr-summary-grid">
        {kpiConfig.map((cfg, i) => {
          const val = data[cfg.key];
          return (
            <div key={cfg.key} className="rev-card"
              style={{
                "--card-accent": cfg.color,
                "--card-glow":   cfg.glow,
                animationDelay: `${i * 0.06}s`,
              }}>
              <div className="rev-card-bg" />
              <div className="rev-card-corner tl" /><div className="rev-card-corner tr" />
              <div className="rev-card-corner bl" /><div className="rev-card-corner br" />
              <div className="rev-card-top-line" />
              <div className="rev-card-icon">{cfg.icon}</div>
              <div className="rev-card-label">{cfg.label}</div>
              <div className="rev-card-value">
                {cfg.suffix
                  ? `${val}${cfg.suffix}`
                  : `₹${fmt(val)}`}
              </div>
              <div className="rev-card-ticker" />
            </div>
          );
        })}
      </div>

      {/* ── Period / meta bar — reuses gstr-period-bar ── */}
      <div className="gstr-period-bar">
        <div className="gstr-period-info">
          <span className="gstr-period-label">Period</span>
          <span className="gstr-period-val">{data.period}</span>
        </div>
        <div className="gstr-period-info">
          <span className="gstr-period-label">From</span>
          <span className="gstr-period-val">{data.fromDate}</span>
        </div>
        <div className="gstr-period-info">
          <span className="gstr-period-label">To</span>
          <span className="gstr-period-val">{data.toDate}</span>
        </div>
        <div className="gstr-period-info">
          <span className="gstr-period-label">Total Invoices</span>
          <span className="gstr-period-val">{data.totalInvoices}</span>
        </div>
        <div className="gstr-period-info">
          <span className="gstr-period-label">Items Sold</span>
          <span className="gstr-period-val">{data.totalItemsSold}</span>
        </div>
        <div className="gstr-period-info">
          <span className="gstr-period-label">Result</span>
          <span className={`gstr-period-val ${isProfit ? "gstr-badge-green" : "gstr-badge-red"}`}>
            {isProfit ? "PROFIT" : "LOSS"}
          </span>
        </div>
      </div>

      {/* ── P&L Statement table ── */}
      <div className="table-shell">
        <div className="table-shell-header">
          <div className="shell-title-row">
            <div className="shell-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M2 7h7M2 10h5" stroke="currentColor"
                  strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <span>Profit &amp; Loss Statement</span>
          </div>
          <div className="shell-status">
            <span className={`pnl-result-indicator ${isProfit ? "pnl-profit" : "pnl-loss"}`}>
              {isProfit ? "↑" : "↓"}
              {isProfit ? " PROFIT" : " LOSS"}
            </span>
          </div>
        </div>

        <div className="pnl-table-wrap">
          <table className="pnl-table">
            <thead>
              <tr>
                <th className="pnl-th-particulars">Particulars</th>
                <th className="pnl-th-sign"></th>
                <th className="pnl-th-amount">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {(data.lines || []).map((line, idx) => {

                // Separator row
                if (line.isSeparator) {
                  return (
                    <tr key={idx} className="pnl-sep-row">
                      <td colSpan={3} />
                    </tr>
                  );
                }

                // Section header row
                if (line.isSubtotal && line.type === "HEADER") {
                  return (
                    <tr key={idx} className="pnl-section-row">
                      <td colSpan={3} className="pnl-td-section">{line.label}</td>
                    </tr>
                  );
                }

                // Determine row class
                const isNetTotal   = line.isTotal && line.type === "NET";
                const isNetNeg     = isNetTotal && parseFloat(line.amount || 0) < 0;
                const isNetPos     = isNetTotal && parseFloat(line.amount || 0) >= 0;
                const isGrossTotal = line.isTotal && line.type === "GROSS";
                const isGrossNeg   = isGrossTotal && parseFloat(line.amount || 0) < 0;

                const rowClass = [
                  line.isTotal    && !isNetTotal && !isGrossTotal ? "pnl-total-row"   : "",
                  isGrossTotal && !isGrossNeg                     ? "pnl-gross-row"   : "",
                  isGrossNeg                                      ? "pnl-loss-row"    : "",
                  isNetPos                                        ? "pnl-profit-row"  : "",
                  isNetNeg                                        ? "pnl-loss-row"    : "",
                  line.isDeduction                                ? "pnl-deduct-row"  : "",
                ].filter(Boolean).join(" ");

                return (
                  <tr key={idx} className={rowClass}>
                    <td className="pnl-td-label">{line.label}</td>
                    <td className="pnl-td-sign">{line.sign}</td>
                    <td className="pnl-td-amount">
                      {line.amount != null
                        ? `₹${fmt(line.amount)}`
                        : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
});
PnlStatement.displayName = "PnlStatement";

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function GenerateReport() {
  const location = useLocation();
  const { moduleId, reportName, filters: initialFilters } = location.state || {};

  const [fields,          setFields]          = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [reportData,      setReportData]      = useState([]);
  const [page,            setPage]            = useState(1);
  const [pageSize,        setPageSize]        = useState(10);
  const [modalInvoice,    setModalInvoice]    = useState(null);
  const [summary,         setSummary]         = useState(null);
  const [gstrData,        setGstrData]        = useState(null);
  const [gstrLoaded,      setGstrLoaded]      = useState(false);
  const [gstrTab,         setGstrTab]         = useState("b2b");
  const [pnlData,         setPnlData]         = useState(null);
  const [pnlLoaded,       setPnlLoaded]       = useState(false);
  const [hoveredRow,      setHoveredRow]      = useState(null);
  const [mousePos,        setMousePos]        = useState({ x: 0, y: 0 });
  const [downloading,     setDownloading]     = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const tableRef      = useRef(null);
  const modalTableRef = useRef(null);
  const canvasRef     = useRef(null);
  const animFrameRef  = useRef(null);
  const orbsRef       = useRef(null);

  /* ── Mouse parallax ── */
  useEffect(() => {
    const h = (e) => setMousePos({
      x: (e.clientX / window.innerWidth  - 0.5) * 2,
      y: (e.clientY / window.innerHeight - 0.5) * 2,
    });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  const canvasThemeKey = useCanvasThemeKey();

  /* ── Canvas background ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx     = canvas.getContext("2d");
    const palette = getPerspectiveCanvasPalette();
    const light   = isLightTheme();
    const resize  = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    orbsRef.current = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r:   80 + Math.random() * 220,
      vx:  (Math.random() - 0.5) * 0.3,
      vy:  (Math.random() - 0.5) * 0.3,
      hue: [210, 230, 200, 240, 220, 215][i],
      alpha: (0.03 + Math.random() * 0.04) * palette.orbAlphaScale,
    }));

    let tick = 0;
    const draw = () => {
      tick++;
      drawPerspectiveScene(ctx, canvas, tick, {
        horizonRatio: 0.55, gridCount: 18, radialCount: 20,
        speed: 0.3, gridWidthMult: 1.4, radialWidthMult: 0.7,
        orbs: orbsRef.current,
      });
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillStyle = light ? "rgba(59,130,246,0.02)" : "rgba(0,0,0,0.04)";
        ctx.fillRect(0, y, canvas.width, 1);
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [canvasThemeKey]);

/* ── Fetch fields ── */
useEffect(() => {
  if (!moduleId) return;

  setLoading(true);

  apiClient(`${API_BASE_URL}/api/Reports/GetFieldByModuleId/${moduleId}`, {})
    .then((r) => r.json())
    .then((d) => {
      if (d?.status === 200 && Array.isArray(d?.data)) {
        setFields(d.data);
      } else {
        setFields([]); // fallback if data is null
      }
    })
    .catch((err) => {
      console.error("Failed to fetch fields:", err);
      setFields([]);
    })
    .finally(() => {
      setLoading(false);
    });
}, [moduleId]);

  /* ── API maps ── */
  const apiMap = {
    [ReportEntity.Vendor]:            `${API_BASE_URL}/api/Vendor/GetVendorReport`,
    [ReportEntity.ProductType]:       `${API_BASE_URL}/api/ProductType/GetProductTypeReport`,
    [ReportEntity.Product]:           `${API_BASE_URL}/api/Product/GetProductReport`,
    [ReportEntity.Inventory]:         `${API_BASE_URL}/api/Inventory/GetInventoryReport`,
    [ReportEntity.Sales]:             `${API_BASE_URL}/api/Sales/GetSaleReport`,
    [ReportEntity.Roles]:             `${API_BASE_URL}/api/Roles/GetRoleReport`,
    [ReportEntity.Reports]:           `${API_BASE_URL}/api/Reports/GetReportData`,
    [ReportEntity.Revenue]:           `${API_BASE_URL}/api/Reports/RevenueReportData`,
    [ReportEntity.StockMovement]:     `${API_BASE_URL}/api/Inventory/GetInvMovementReport`,
    [ReportEntity.Outstanding]:       `${API_BASE_URL}/api/Reports/OutstandingReportData`,
    [ReportEntity.RetailerCustomer]:  `${API_BASE_URL}/api/Reports/CustomerReportData`,
    [ReportEntity.Purchase]:          `${API_BASE_URL}/api/Purchase/PurchaseReportData`,
    [ReportEntity.Supplier]:          `${API_BASE_URL}/api/Supplier/SupplierReportData`,
    [ReportEntity.PaymentCollection]: `${API_BASE_URL}/api/PaymentCollection/PaymentCollectionReportData`,
    [ReportEntity.DayBook]:           `${API_BASE_URL}/api/Reports/DayBookReportData`,
    [ReportEntity.GSTR1]:             `${API_BASE_URL}/api/Reports/GstReportData`,
    [ReportEntity.ProfitLoss]:        `${API_BASE_URL}/api/Reports/PnlReportData`,
  };

  const downloadApiMap = {
    [ReportEntity.Vendor]:            `${API_BASE_URL}/api/Vendor/report`,
    [ReportEntity.ProductType]:       `${API_BASE_URL}/api/ProductType/Report`,
    [ReportEntity.Product]:           `${API_BASE_URL}/api/Product/Report`,
    [ReportEntity.Inventory]:         `${API_BASE_URL}/api/Inventory/Report`,
    [ReportEntity.Sales]:             `${API_BASE_URL}/api/Sales/Report`,
    [ReportEntity.Roles]:             `${API_BASE_URL}/api/Roles/GenerateReport`,
    [ReportEntity.Reports]:           `${API_BASE_URL}/api/Reports/GenerateReport`,
    [ReportEntity.Revenue]:           `${API_BASE_URL}/api/Reports/RevenueReport`,
    [ReportEntity.StockMovement]:     `${API_BASE_URL}/api/Inventory/InvMovementFileReport`,
    [ReportEntity.Outstanding]:       `${API_BASE_URL}/api/Reports/OutstandingReport`,
    [ReportEntity.RetailerCustomer]:  `${API_BASE_URL}/api/Reports/CustomerReport`,
    [ReportEntity.Purchase]:          `${API_BASE_URL}/api/Purchase/PurchaseReport`,
    [ReportEntity.Supplier]:          `${API_BASE_URL}/api/Supplier/SupplierReport`,
    [ReportEntity.PaymentCollection]: `${API_BASE_URL}/api/PaymentCollection/PaymentCollectionReport`,
    [ReportEntity.DayBook]:           `${API_BASE_URL}/api/Reports/DayBookReport`,
    [ReportEntity.GSTR1]:             `${API_BASE_URL}/api/Reports/GstReport`,
    [ReportEntity.ProfitLoss]:        `${API_BASE_URL}/api/Reports/PnlReport`,
  };

  /* ── Fetch report data ── */
  useEffect(() => {
    if (!moduleId || !initialFilters) return;

    const payload = {};
    Object.keys(initialFilters).forEach((k) => {
      payload[k] = initialFilters[k]?.trim() !== "" ? initialFilters[k] : null;
    });
    payload.page     = page;
    payload.pageSize = pageSize;

    const apiUrl = apiMap[moduleId];
    if (!apiUrl) return;

    setLoading(true);

    // Reset loaded flags so we never show "no data" during fetch
    if (moduleId === ReportEntity.GSTR1)     setGstrLoaded(false);
    if (moduleId === ReportEntity.ProfitLoss) setPnlLoaded(false);

    apiClient(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);

        if (d.status !== 200) {
          if (moduleId === ReportEntity.GSTR1)     { setGstrData(null); setGstrLoaded(true); }
          if (moduleId === ReportEntity.ProfitLoss) { setPnlData(null);  setPnlLoaded(true);  }
          return;
        }

        // ── GSTR-1 ──────────────────────────────────────────────────────
        if (moduleId === ReportEntity.GSTR1) {
          setGstrData(d.data);
          setGstrLoaded(true);
          setReportData([]);
          return;
        }

        // ── P&L ──────────────────────────────────────────────────────────
        if (moduleId === ReportEntity.ProfitLoss) {
          setPnlData(d.data);
          setPnlLoaded(true);
          setReportData([]);
          return;
        }

        // ── Revenue ──────────────────────────────────────────────────────
        if (moduleId === ReportEntity.Revenue) {
          setSummary(d.data.summaryDto);
          setReportData(d.data.revenueDto || []);
          return;
        }

        // ── Generic ──────────────────────────────────────────────────────
        setReportData(d.data);
      })
      .catch(() => {
        setLoading(false);
        if (moduleId === ReportEntity.GSTR1)     { setGstrData(null); setGstrLoaded(true); }
        if (moduleId === ReportEntity.ProfitLoss) { setPnlData(null);  setPnlLoaded(true);  }
      });
  }, [moduleId, initialFilters, page, pageSize]);

  /* ── Download ── */
  const handleDownload = async () => {
    if (!moduleId || !initialFilters || downloading) return;
    const apiUrl = downloadApiMap[moduleId];
    if (!apiUrl) return;

    setDownloading(true); setDownloadSuccess(false);
    try {
      const payload = {};
      Object.keys(initialFilters).forEach((k) => {
        payload[k] = initialFilters[k]?.trim() !== "" ? initialFilters[k] : null;
      });

      const response = await apiClient(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const cd   = response.headers.get("Content-Disposition");
      let fileName = `${reportName || "Report"}.xlsx`;
      if (cd) {
        const m = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (m?.[1]) fileName = m[1].replace(/['"]/g, "");
      }

      const url  = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href  = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  /* ── Column resizer ── */
  const attachResizer = (tableEl) => {
    if (!tableEl) return;
    const headers = tableEl.querySelectorAll(".gen-table-header-cell");
    headers.forEach((header, index) => {
      if (header.querySelector(".resizer")) return;
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      header.appendChild(resizer);
      let startX, startWidth;
      const onMove = (e) => {
        const w = Math.max(80, startWidth + (e.pageX - startX));
        header.style.width = w + "px";
        tableEl.querySelectorAll(`.gen-table-body-cell:nth-child(${index + 1})`)
               .forEach((cell) => (cell.style.width = w + "px"));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX     = e.pageX;
        startWidth = header.offsetWidth;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  };

  useEffect(() => { attachResizer(tableRef.current); },      [fields, reportData]);
  useEffect(() => { attachResizer(modalTableRef.current); }, [modalInvoice, fields]);

  /* ── Helpers ── */
  const toCamelCase = (str) =>
    str.replace(/\s(.)/g, (_, g) => g.toUpperCase())
       .replace(/\s/g, "")
       .replace(/^(.)/, (_, g) => g.toLowerCase())
       .replace(/[()₹]/g, "");

  if (!moduleId) {
    return (
      <div className="r-container">
        <canvas ref={canvasRef} className="bg-canvas" />
        <div className="gen-error-text">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
            <path d="M8 5V8.5M8 11H8.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Module information missing. Please go back and generate the report again.
        </div>
      </div>
    );
  }

  /* ── Invoice grouping ── */
  const invoiceMap   = new Map();
  let lastInvoiceKey = null;
  reportData.forEach((row) => {
    let key = row.invoiceNumber || lastInvoiceKey;
    if (!key) key = `null-${Math.random()}`;
    lastInvoiceKey = row.invoiceNumber || lastInvoiceKey;
    if (!invoiceMap.has(key)) invoiceMap.set(key, []);
    invoiceMap.get(key).push(row);
  });

  const invoiceKeys   = Array.from(invoiceMap.keys());
  const totalPages    = Math.ceil(invoiceKeys.length / pageSize);
  const paginatedKeys = invoiceKeys.slice((page - 1) * pageSize, page * pageSize);

  /* ── Revenue summary config ── */
  const summaryConfig = [
    { key: "totalRevenue",    label: "Revenue",       icon: "₹", color: "#3b82f6", glow: "rgba(59,130,246,0.4)"  },
    { key: "totalProfit",     label: "Profit",        icon: "↑", color: "#10b981", glow: "rgba(16,185,129,0.4)"  },
    { key: "totalDiscount",   label: "Discount",      icon: "₹", color: "#f59e0b", glow: "rgba(245,158,11,0.4)"  },
    { key: "totalTax",        label: "Tax",           icon: "T", color: "#8b5cf6", glow: "rgba(139,92,246,0.4)"  },
    { key: "netProfit",       label: "Net Profit",    icon: "N", color: "#06b6d4", glow: "rgba(6,182,212,0.4)"   },
    { key: "profitMargin",    label: "Profit Margin", icon: "M", color: "#ec4899", glow: "rgba(236,72,153,0.4)", suffix: "%" },
    { key: "netProfitMargin", label: "Net Margin",    icon: "M", color: "#f97316", glow: "rgba(249,115,22,0.4)", suffix: "%" },
  ];

  /* ── GSTR summary config ── */
  const gstrSummaryConfig = [
    { key: "totalTaxableValue", label: "Taxable Value",  icon: "₹", color: "#3b82f6", glow: "rgba(59,130,246,0.4)"  },
    { key: "totalCgst",         label: "CGST",           icon: "C", color: "#10b981", glow: "rgba(16,185,129,0.4)"  },
    { key: "totalSgst",         label: "SGST",           icon: "S", color: "#10b981", glow: "rgba(16,185,129,0.4)"  },
    { key: "totalIgst",         label: "IGST",           icon: "I", color: "#8b5cf6", glow: "rgba(139,92,246,0.4)"  },
    { key: "totalTax",          label: "Total GST",      icon: "G", color: "#f59e0b", glow: "rgba(245,158,11,0.4)"  },
    { key: "totalInvoiceValue", label: "Invoice Value",  icon: "V", color: "#06b6d4", glow: "rgba(6,182,212,0.4)"   },
    { key: "b2bCount",          label: "B2B Invoices",   icon: "#", color: "#ec4899", glow: "rgba(236,72,153,0.4)", raw: true },
    { key: "b2cCount",          label: "B2C Invoices",   icon: "#", color: "#f97316", glow: "rgba(249,115,22,0.4)", raw: true },
  ];

  /* ── Header badge label ── */
  const headerBadgeLabel =
    moduleId === ReportEntity.GSTR1     ? "GST COMPLIANCE"  :
    moduleId === ReportEntity.ProfitLoss ? "FINANCIAL REPORT" :
    "REPORT VIEWER";

  const parallaxStyle = {
    transform:  `translate(${mousePos.x * 4}px, ${mousePos.y * 4}px)`,
    transition: "transform 0.1s linear",
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="r-container">
      <canvas ref={canvasRef} className="bg-canvas" />
      <div className="noise-overlay" />
      <div className="top-beam" />

      {/* ══ HEADER ══ */}
      <header className="report-header" style={parallaxStyle}>
        <div className="header-top-row">
          <div className="header-left">
            <div className="header-badge">
              <span className="badge-dot" />
              {headerBadgeLabel}
            </div>
            <h1 className="gen-report-title">
              <span className="title-accent">//</span>
              {reportName}
            </h1>
            <div className="header-meta">
              <span className="meta-chip">
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="3" fill="currentColor" />
                </svg>
                LIVE
              </span>
              <span className="meta-divider" />
              {moduleId === ReportEntity.GSTR1 && gstrData ? (
                <>
                  <span className="meta-label">{gstrData.period}</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{gstrData.b2bCount} B2B</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{gstrData.b2cCount} B2C</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{gstrData.hsnCount} HSN codes</span>
                </>
              ) : moduleId === ReportEntity.ProfitLoss && pnlData ? (
                <>
                  <span className="meta-label">{pnlData.period}</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{pnlData.totalInvoices} invoices</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{pnlData.totalItemsSold} items sold</span>
                  <span className="meta-divider" />
                  <span className="meta-label"
                    style={{ color: parseFloat(pnlData.netProfit||0) >= 0 ? "#6ee7b7" : "#fca5a5" }}>
                    Net: ₹{fmt(pnlData.netProfit)}
                  </span>
                </>
              ) : (
                <>
                  <span className="meta-label">{fields.length} columns</span>
                  <span className="meta-divider" />
                  <span className="meta-label">{reportData.length} rows</span>
                </>
              )}
            </div>
          </div>

          <div className="header-actions">
            <button
              className={`download-btn ${downloading ? "downloading" : ""} ${downloadSuccess ? "success" : ""}`}
              onClick={handleDownload}
              disabled={downloading || loading}
              title="Download Report as Excel"
            >
              {downloading ? (
                <>
                  <span className="download-spinner">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"
                        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>Exporting…</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor"
                      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2V9M7 9L4.5 6.5M7 9L9.5 6.5" stroke="currentColor"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 11H12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>Export Excel</span>
                </>
              )}
              <span className="download-btn-glow" />
            </button>
          </div>
        </div>
        <div className="header-rule" />
      </header>

      {/* ══ REVENUE SUMMARY CARDS ══ */}
      {moduleId === ReportEntity.Revenue && summary && (
        <div className="rev-summary">
          {summaryConfig.map((cfg, i) => (
            <div key={cfg.key} className="rev-card"
              style={{ "--card-accent": cfg.color, "--card-glow": cfg.glow, animationDelay: `${i * 0.08}s` }}>
              <div className="rev-card-bg" />
              <div className="rev-card-corner tl" /><div className="rev-card-corner tr" />
              <div className="rev-card-corner bl" /><div className="rev-card-corner br" />
              <div className="rev-card-top-line" />
              <div className="rev-card-icon">{cfg.icon}</div>
              <div className="rev-card-label">{cfg.label}</div>
              <div className="rev-card-value">{summary[cfg.key]}{cfg.suffix || ""}</div>
              <div className="rev-card-ticker" />
            </div>
          ))}
        </div>
      )}

      {/* ══ GSTR-1 LAYOUT ══ */}
      {moduleId === ReportEntity.GSTR1 && (
        <>
          {loading ? (
            <div className="gen-loading-text">
              <div className="loader-ring"><div /><div /><div /><div /></div>
              Generating GSTR-1…
            </div>
          ) : gstrData ? (
            <>
              {/* GSTR KPI Cards */}
              <div className="rev-summary gstr-summary-grid">
                {gstrSummaryConfig.map((cfg, i) => (
                  <div key={cfg.key} className="rev-card"
                    style={{ "--card-accent": cfg.color, "--card-glow": cfg.glow, animationDelay: `${i * 0.06}s` }}>
                    <div className="rev-card-bg" />
                    <div className="rev-card-corner tl" /><div className="rev-card-corner tr" />
                    <div className="rev-card-corner bl" /><div className="rev-card-corner br" />
                    <div className="rev-card-top-line" />
                    <div className="rev-card-icon">{cfg.icon}</div>
                    <div className="rev-card-label">{cfg.label}</div>
                    <div className="rev-card-value">
                      {cfg.raw ? gstrData[cfg.key] : `₹${fmt(gstrData[cfg.key])}`}
                    </div>
                    <div className="rev-card-ticker" />
                  </div>
                ))}
              </div>

              {/* Period bar */}
              <div className="gstr-period-bar">
                <div className="gstr-period-info">
                  <span className="gstr-period-label">Period</span>
                  <span className="gstr-period-val">{gstrData.period}</span>
                </div>
                <div className="gstr-period-info">
                  <span className="gstr-period-label">From</span>
                  <span className="gstr-period-val">{gstrData.fromDate}</span>
                </div>
                <div className="gstr-period-info">
                  <span className="gstr-period-label">To</span>
                  <span className="gstr-period-val">{gstrData.toDate}</span>
                </div>
                <div className="gstr-period-info">
                  <span className="gstr-period-label">Filing Type</span>
                  <span className="gstr-period-val gstr-badge-blue">GSTR-1</span>
                </div>
                <div className="gstr-period-info">
                  <span className="gstr-period-label">Tax Treatment</span>
                  <span className="gstr-period-val gstr-badge-green">Intra-State</span>
                </div>
              </div>

              {/* Tabbed tables */}
              <div className="table-shell" style={{ marginTop: 0 }}>
                <div className="table-shell-header">
                  <div className="gstr-tabs">
                    {[
                      { key: "b2b", label: "B2B Invoices", count: gstrData.b2bCount, color: "#3b82f6" },
                      { key: "b2c", label: "B2C Invoices", count: gstrData.b2cCount, color: "#10b981" },
                      { key: "hsn", label: "HSN Summary",  count: gstrData.hsnCount,  color: "#f59e0b" },
                    ].map((t) => (
                      <button key={t.key}
                        className={`gstr-tab ${gstrTab === t.key ? "active" : ""}`}
                        onClick={() => setGstrTab(t.key)}
                        style={{ "--tab-color": t.color }}>
                        {t.label}
                        <span className="gstr-tab-count">{t.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="shell-status">
                    <span className="status-pulse" />
                    {gstrTab === "b2b" ? gstrData.b2bCount
                     : gstrTab === "b2c" ? gstrData.b2cCount
                     : gstrData.hsnCount} entries
                  </div>
                </div>
                <div className="gstr-tab-content">
                  {gstrTab === "b2b" && <GstrB2BTable data={gstrData.b2b || []} />}
                  {gstrTab === "b2c" && <GstrB2CTable data={gstrData.b2c || []} />}
                  {gstrTab === "hsn" && <GstrHsnTable data={gstrData.hsnSummary || []} />}
                </div>
              </div>
            </>
          ) : (
            gstrLoaded && (
              <div className="gen-error-text">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5V8.5M8 11H8.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                No GSTR-1 data found for this period.
              </div>
            )
          )}
        </>
      )}

      {/* ══ P&L LAYOUT ══ */}
      {moduleId === ReportEntity.ProfitLoss && (
        <>
          {loading ? (
            <div className="gen-loading-text">
              <div className="loader-ring"><div /><div /><div /><div /></div>
              Generating P&amp;L Statement…
            </div>
          ) : pnlData ? (
            <PnlStatement data={pnlData} />
          ) : (
            pnlLoaded && (
              <div className="gen-error-text">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5V8.5M8 11H8.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                No P&amp;L data found for this period.
              </div>
            )
          )}
        </>
      )}

      {/* ══ GENERIC TABLE LAYOUT (all other reports) ══ */}
      {moduleId !== ReportEntity.GSTR1 && moduleId !== ReportEntity.ProfitLoss && (
        <>
          {loading ? (
            <div className="gen-loading-text">
              <div className="loader-ring"><div /><div /><div /><div /></div>
              Initializing data stream…
            </div>
          ) : (
            <>
              <div className={`table-shell ${modalInvoice ? "blurred" : ""}`}>
                <div className="table-shell-header">
                  <div className="shell-title-row">
                    <div className="shell-icon">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                        <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                    </div>
                    <span>Data Matrix</span>
                  </div>
                  <div className="shell-status">
                    <span className="status-pulse" />
                    {paginatedKeys.length} entries
                  </div>
                </div>

                <div className="gen-table-wrapper" ref={tableRef}>
                  <div className="gen-table">
                    <div className="gen-table-header-row">
                      {fields.map((field, i) => (
                        <div key={i} className="gen-table-header-cell"
                          style={{ width: "170px", animationDelay: `${i * 0.04}s` }}>
                          <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                          {field}
                        </div>
                      ))}
                    </div>
                    {paginatedKeys.map((key, gIndex) => {
                      const items       = invoiceMap.get(key);
                      const hasMultiple = items.length > 1;
                      return (
                        <div key={gIndex}
                          className={`gen-table-body-row invoice-row ${hoveredRow === gIndex ? "row-hovered" : ""}`}
                          style={{ cursor: hasMultiple ? "pointer" : "default", animationDelay: `${gIndex * 0.025}s` }}
                          onClick={() => hasMultiple && setModalInvoice(items)}
                          onMouseEnter={() => setHoveredRow(gIndex)}
                          onMouseLeave={() => setHoveredRow(null)}>
                          {fields.map((field, fIndex) => {
                            const keyField = toCamelCase(field);
                            return (
                              <div key={fIndex} className="gen-table-body-cell"
                                style={{
                                  width: "170px",
                                  display: fIndex === 0 && hasMultiple ? "flex" : undefined,
                                  justifyContent: fIndex === 0 && hasMultiple ? "space-between" : undefined,
                                }}>
                                {items[0][keyField] ?? "—"}
                                {fIndex === 0 && hasMultiple && (
                                  <span className="expand-indicator">
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor"
                                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Pagination */}
              <div className="gen-pagination">
                <button disabled={page === 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Prev
                </button>
                <div className="page-indicator">
                  <span className="page-num">{page}</span>
                  <span className="page-sep">/</span>
                  <span className="page-total">{totalPages || 1}</span>
                </div>
                <button disabled={page === totalPages || totalPages === 0}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}>
                  Next
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <select value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {[5, 10, 20, 50].map((s) => (
                    <option key={s} value={s}>{s} / page</option>
                  ))}
                </select>
              </div>

              {/* Modal */}
              {modalInvoice && (
                <div className="gen-modal-overlay"
                  onClick={(e) => e.target === e.currentTarget && setModalInvoice(null)}>
                  <div className="gen-modal-content">
                    <div className="modal-top-beam" />
                    <div className="modal-corner-tl" /><div className="modal-corner-tr" />
                    <div className="modal-corner-bl" /><div className="modal-corner-br" />
                    <div className="modal-header">
                      <div className="modal-title-group">
                        <div className="modal-eyebrow">
                          <span className="eyebrow-dot" />Invoice Details
                        </div>
                        <h3>{modalInvoice[0]?.invoiceNumber || "—"}</h3>
                        <span className="modal-count">{modalInvoice.length} line items</span>
                      </div>
                      <button className="gen-modal-close" onClick={() => setModalInvoice(null)}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor"
                            strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        CLOSE
                      </button>
                    </div>
                    <div className="gen-table-wrapper" ref={modalTableRef}>
                      <div className="gen-table">
                        <div className="gen-table-header-row">
                          {fields.map((field, i) => (
                            <div key={i} className="gen-table-header-cell" style={{ width: "170px" }}>
                              <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                              {field}
                            </div>
                          ))}
                        </div>
                        {modalInvoice.map((row, rIndex) => (
                          <div key={rIndex} className="gen-table-body-row"
                            style={{ animationDelay: `${rIndex * 0.04}s` }}>
                            {fields.map((field, cIndex) => {
                              const keyField = toCamelCase(field);
                              return (
                                <div key={cIndex} className="gen-table-body-cell" style={{ width: "170px" }}>
                                  {row[keyField] ?? "—"}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}