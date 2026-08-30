import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { ReportEntity } from "../Enums/ReportEntity.js";
import { runReportByModule } from "./ReportService.js";
import "../../Styles/Report/OpenReport.css";
import LedgerCanvas from "./LedgerCanvas";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS — unchanged behaviour from the previous OpenReport
═══════════════════════════════════════════════════════════════════════ */
function toCamelCase(str) {
  return str
    .replace(/\s(.)/g, (_, g) => g.toUpperCase())
    .replace(/\s/g, "")
    .replace(/^(.)/, (_, g) => g.toLowerCase());
}

function getModuleIdByReportName(reportName) {
  if (!reportName) return null;
  const name = reportName.toLowerCase();

  if (name.includes("vendor"))         return ReportEntity.Vendor;
  if (name.includes("producttype"))    return ReportEntity.ProductType;
  if (name.includes("product"))        return ReportEntity.Product;
  if (name.includes("inventory"))      return ReportEntity.Inventory;
  if (name.includes("sales"))          return ReportEntity.Sales;
  if (name.includes("role"))           return ReportEntity.Roles;
  if (name.includes("revenue-profit")) return ReportEntity.Revenue;
  if (name.includes("stock"))          return ReportEntity.StockMovement;
  if (name.includes("outstanding"))    return ReportEntity.Outstanding;
  if (name.includes("customer"))       return ReportEntity.RetailerCustomer;
  if (name.includes("purchase"))       return ReportEntity.Purchase;
  if (name.includes("supplier"))       return ReportEntity.Supplier;
  if (name.includes("payment"))        return ReportEntity.PaymentCollection;
  if (name.includes("day"))            return ReportEntity.DayBook;
  if (name.includes("gst"))            return ReportEntity.GSTR1;
  if (name.includes("loss") || name.includes("profit")) return ReportEntity.ProfitLoss;
  if (name.includes("audit")) return ReportEntity.AuditLog;

  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   CUSTOM DROPDOWN — .lg-pick, unfolds like a flap
═══════════════════════════════════════════════════════════════════════ */
function Pick({ label, options, value, isOpen, pickKey, setOpenKey, onChange }) {
  const wrapRef = useRef(null);
  const faceRef = useRef(null);
  const drawerRef = useRef(null);
  const [seek, setSeek] = useState("");
  const [hi, setHi] = useState(-1);
  const [rect, setRect] = useState(null);

  /* Outside-click close. The drawer is portaled to document.body (see
     below), so it is no longer a DOM descendant of wrapRef — it must be
     checked separately or every click inside it would look "outside". */
  useEffect(() => {
    const close = (e) => {
      const inWrap = wrapRef.current && wrapRef.current.contains(e.target);
      const inDrawer = drawerRef.current && drawerRef.current.contains(e.target);
      if (!inWrap && !inDrawer) setOpenKey(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [setOpenKey]);

  useEffect(() => {
    if (!isOpen) { setSeek(""); setHi(-1); return; }
    /* Position the portaled drawer against the trigger's live viewport
       rect (fixed positioning), and keep it pinned while any ancestor
       scrolls — including the app's shared .layout-content wrapper,
       which otherwise would clip an absolutely-positioned drawer. */
    const update = () => {
      const r = faceRef.current?.getBoundingClientRect();
      if (r) setRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen]);

  const filtered = options.filter((opt) => opt.toLowerCase().includes(seek.toLowerCase()));

  const commit = (opt) => {
    onChange(opt);
    setSeek("");
    setOpenKey(null);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") { setOpenKey(null); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && hi >= 0 && filtered[hi]) { e.preventDefault(); commit(filtered[hi]); }
  };

  return (
    <div className="lg-pick" ref={wrapRef}>
      <div
        ref={faceRef}
        className={`lg-pick-face ${isOpen ? "is-open" : ""} ${value ? "is-filled" : ""}`}
        onClick={() => setOpenKey(isOpen ? null : pickKey)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setOpenKey(isOpen ? null : pickKey); }}
      >
        <span>{value || `Select ${label}`}</span>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {isOpen && rect && createPortal(
        <div
          className="lg-pick-drawer"
          ref={drawerRef}
          style={{ top: rect.top, left: rect.left, width: rect.width }}
        >
          <div className="lg-pick-seek">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7.5 7.5L9.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder={`Search ${label}...`}
              value={seek}
              autoFocus
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => { setSeek(e.target.value); setHi(-1); }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div className="lg-pick-scroll">
            <div
              className="lg-pick-item is-erase"
              onMouseDown={(e) => { e.stopPropagation(); commit(""); }}
            >
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Clear selection
            </div>
            {filtered.length === 0 ? (
              <div className="lg-pick-void">No results</div>
            ) : filtered.map((opt, i) => (
              <div
                key={i}
                className={`lg-pick-item ${value === opt ? "is-selected" : ""} ${hi === i ? "is-hi" : ""}`}
                onMouseDown={(e) => { e.stopPropagation(); commit(opt); }}
                onMouseEnter={() => setHi(i)}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════════════ */
export default function OpenReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const reportName = location.state?.reportName;

  const [filters, setFilters] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [openKey, setOpenKey] = useState(null);
  const [opened, setOpened] = useState(false);
  const [closing, setClosing] = useState(false);
  const bookRef = useRef(null);

  const moduleId = getModuleIdByReportName(reportName);

  /* Paint the closed pose first, then transition open — this is what
     plays the "book opens" motion (see .lg-leaf.is-opened in the CSS).
     Two rAFs guarantee the closed pose actually paints before we flip
     the class, otherwise the browser can coalesce both into one frame
     and skip the transition entirely. */
  useEffect(() => {
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpened(true));
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);

  const activeFilters = useMemo(
    () => Object.values(selectedFilters).filter(Boolean).length,
    [selectedFilters]
  );

  /* Pointer tilt on the whole book */
  const handleBookMove = (e) => {
    const el = bookRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty("--lg-tx", px.toFixed(3));
    el.style.setProperty("--lg-ty", py.toFixed(3));
  };
  const handleBookLeave = () => {
    const el = bookRef.current;
    if (!el) return;
    el.style.setProperty("--lg-tx", 0);
    el.style.setProperty("--lg-ty", 0);
  };

  /* Fetch filter definitions for this module */
  useEffect(() => {
    if (!moduleId) { setLoading(false); return; }
    apiClient(`${API_BASE_URL}/api/Filters/GetFiltersByModule/${moduleId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setFilters(d.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [moduleId]);

  /* Fetch dropdown option lists for the modules that have them */
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
      .then((d) => d.status === 200 && setFilterOptions(d.data))
      .catch(() => {});
  }, [moduleId]);

  const handleFilterChange = (name, val) => {
    const key = toCamelCase(name);
    setSelectedFilters((p) => {
      if (!val) { const copy = { ...p }; delete copy[key]; return copy; }
      return { ...p, [key]: val };
    });
  };

  const handleRunReport = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    try {
      const blob = await runReportByModule(moduleId, selectedFilters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Report download failed:", err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleClearAll = () => setSelectedFilters({});

  const closeThenGo = (go) => {
    if (closing) return;
    setClosing(true);
    setTimeout(go, 480);
  };

  const handlePreview = () => closeThenGo(() =>
    navigate("/master/reports/generate", { state: { moduleId, reportName, filters: selectedFilters } })
  );
  const handleBack = () => closeThenGo(() => navigate(-1));

  return (
    <div className="lg-spread">
      <LedgerCanvas variant="spread" />

      <div className="lg-frame">
        <div
          className={`lg-book ${closing ? "is-closing" : ""}`}
          ref={bookRef}
          onMouseMove={handleBookMove}
          onMouseLeave={handleBookLeave}
        >
          {/* ── LEFT LEAF — filters ── */}
          <section className={`lg-leaf is-verso ${opened && !closing ? "is-opened" : ""}`}>
            <div className="lg-leaf-head">
              <div>
                <div className="lg-leaf-stamp">
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                    <path d="M1 2.5h11M3 6.5h7M5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Filters
                </div>
                <h2>Set your parameters</h2>
              </div>
              {activeFilters > 0 && (
                <button className="lg-clear" onClick={handleClearAll}>
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  Clear ({activeFilters})
                </button>
              )}
            </div>

            <div className="lg-slots">
              {loading ? (
                <div className="lg-blank">
                  <div className="lg-quill-ring"><div /><div /><div /><div /></div>
                  <span>Loading filters...</span>
                </div>
              ) : filters.length === 0 ? (
                <div className="lg-blank"><span>No filters available for this report</span></div>
              ) : (
                filters.map((f, i) => {
                  const key = toCamelCase(f);
                  const isSet = Boolean(selectedFilters[key]);
                  return (
                    <div key={i} className={`lg-slot ${isSet ? "is-set" : ""}`} style={{ "--lg-i": i }}>
                      <label className="lg-slot-cap">
                        {isSet && <span className="lg-slot-ink" />}
                        {f}
                      </label>
                      {filterOptions[key] ? (
                        <Pick
                          label={f}
                          options={filterOptions[key]}
                          value={selectedFilters[key]}
                          isOpen={openKey === key}
                          pickKey={key}
                          setOpenKey={setOpenKey}
                          onChange={(v) => handleFilterChange(f, v)}
                        />
                      ) : (
                        <div className="lg-write">
                          <input
                            type={f.toLowerCase().includes("date") ? "date" : "text"}
                            value={selectedFilters[key] || ""}
                            onChange={(e) => handleFilterChange(f, e.target.value)}
                            placeholder={f.toLowerCase().includes("date") ? "" : `Enter ${f}...`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── GUTTER ── */}
          <div className="lg-crease"><div className="lg-stitch" /></div>

          {/* ── RIGHT LEAF — folio + live config + actions ── */}
          <section className={`lg-leaf is-recto ${opened && !closing ? "is-opened" : ""}`}>
            <div className="lg-folio-stamp"><span /> Report Configuration</div>
            <h1 className="lg-folio-heading">{reportName || "Untitled report"}</h1>

            <div className="lg-gauge">
              <div className="lg-gauge-item">
                <span className="lg-gauge-num">{filters.length}</span>
                <span className="lg-gauge-lbl">Parameters</span>
              </div>
              <div className="lg-gauge-item">
                <span className="lg-gauge-num" style={{ color: activeFilters > 0 ? "var(--lg-gild)" : undefined }}>{activeFilters}</span>
                <span className="lg-gauge-lbl">Active filters</span>
              </div>
              <div className="lg-gauge-item">
                <span className="lg-gauge-num lg-gauge-mark">READY</span>
                <span className="lg-gauge-lbl">Status</span>
              </div>
            </div>

            <div className="lg-ledger">
              <div className="lg-ledger-top">
                <span>report.config</span>
                <span>{reportName ? "bound" : "—"}</span>
              </div>
              <div className="lg-ledger-line">
                <span className="lg-ledger-key">module</span>
                <span className="lg-ledger-ink">"{reportName}"</span>
              </div>
              {Object.entries(selectedFilters).length === 0 ? (
                <div className="lg-ledger-empty">no filters applied</div>
              ) : (
                Object.entries(selectedFilters).map(([k, v]) => (
                  <div className="lg-ledger-line" key={k}>
                    <span className="lg-ledger-key">{k}</span>
                    <span className="lg-ledger-ink">"{v}"</span>
                  </div>
                ))
              )}
            </div>

            <div className="lg-acts">
              <button className="lg-go" onClick={handlePreview}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Preview
              </button>
              <button className={`lg-get ${reportLoading ? "is-busy" : ""}`} onClick={handleRunReport} disabled={reportLoading}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1v7M3.5 5l3 3 3-3M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {reportLoading ? "Downloading..." : "Download"}
                <span className="lg-get-sheet" />
              </button>
              <button className="lg-back" onClick={handleBack}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M8 2L3 6.5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Back
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
