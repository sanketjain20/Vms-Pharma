import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ReportEntity } from "../Enums/ReportEntity.js";
import { runReportByModule } from "./ReportService.js";
import "../../Styles/Report/OpenReport.css";
import {
  useCanvasThemeKey,
  getPerspectiveCanvasPalette,
  drawPerspectiveScene,
  isLightTheme,
} from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
/* =========================
   UTILS
========================= */
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
  if (name.includes("day"))        return ReportEntity.DayBook;
  if (name.includes("gst"))        return ReportEntity.GSTR1;

  return null;
}

/* =========================
   CUSTOM DROPDOWN
========================= */
function Dropdown({ label, options, value, isOpen, dropdownKey, setOpenKey, onChange }) {
  const ref = useRef();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenKey(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [setOpenKey]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="custom-dropdown" ref={ref}>
      <div
        className={`dropdown-selected ${isOpen ? "open" : ""} ${value ? "has-value" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpenKey(isOpen ? null : dropdownKey);
        }}
      >
        <span className="dropdown-value">{value || `Select ${label}`}</span>
        <svg
          className={`dropdown-chevron ${isOpen ? "flipped" : ""}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-search-wrap">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7.5 7.5L9.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder={`Search ${label}…`}
              value={searchTerm}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="dropdown-search"
              autoFocus
            />
          </div>

          <div
            className="dropdown-item clear-item"
            onMouseDown={(e) => {
              e.stopPropagation();
              onChange("");
              setSearchTerm("");
              setOpenKey(null);
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Clear selection
          </div>

          <div className="dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="dropdown-empty">No results</div>
            ) : filteredOptions.map((opt, i) => (
              <div
                key={i}
                className={`dropdown-item ${value === opt ? "selected" : ""}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onChange(opt);
                  setSearchTerm("");
                  setOpenKey(null);
                }}
              >
                {value === opt && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function OpenReport() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const reportName = location.state?.reportName;

  const [filters, setFilters]               = useState([]);
  const [filterOptions, setFilterOptions]   = useState({});
  const [selectedFilters, setSelectedFilters] = useState({});
  const [loading, setLoading]               = useState(true);
  const [reportLoading, setReportLoading]   = useState(false);
  const [openKey, setOpenKey]               = useState(null);
  const [activeFilters, setActiveFilters]   = useState(0);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  const moduleId = getModuleIdByReportName(reportName);

  /* Count active filters */
  useEffect(() => {
    setActiveFilters(Object.values(selectedFilters).filter(Boolean).length);
  }, [selectedFilters]);

  const canvasThemeKey = useCanvasThemeKey();
  const orbsRef = useRef(null);

  /* 3D CANVAS BACKGROUND */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const palette = getPerspectiveCanvasPalette();
    const light = isLightTheme();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    orbsRef.current = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 100 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      hue: [215, 225, 205, 235, 210][i],
      alpha: (0.025 + Math.random() * 0.035) * palette.orbAlphaScale,
    }));

    let tick = 0;

    const draw = () => {
      tick++;
      drawPerspectiveScene(ctx, canvas, tick, {
        horizonRatio: 0.52,
        gridCount: 16,
        radialCount: 18,
        speed: 0.28,
        gridWidthMult: 1.5,
        radialWidthMult: 0.75,
        orbs: orbsRef.current,
      });

      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillStyle = light ? "rgba(59,130,246,0.02)" : "rgba(0,0,0,0.035)";
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

  /* FETCH FILTERS */
  useEffect(() => {
    if (!moduleId) return;
    fetch(`${API_BASE_URL}/api/Filters/GetFiltersByModule/${moduleId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setFilters(d.data);
        setLoading(false);
      });
  }, [moduleId]);

  /* FETCH OPTIONS */
  useEffect(() => {
    const map = {
      [ReportEntity.Product]:     `${API_BASE_URL}/api/Product/GetFilterData`,
      [ReportEntity.ProductType]: `${API_BASE_URL}/api/ProductType/GetFilterData`,
      [ReportEntity.Inventory]:   `${API_BASE_URL}/api/Inventory/InvReportFilterData`,
      [ReportEntity.Sales]:       `${API_BASE_URL}/api/Sales/SalesReportFilterData`,
      [ReportEntity.Revenue]:     `${API_BASE_URL}/api/Reports/RevenueReportFilterData`,
      [ReportEntity.StockMovement]: `${API_BASE_URL}/api/Inventory/StockMovReportFilterData`,
    };
    if (!map[moduleId]) return;
    fetch(map[moduleId], { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.status === 200 && setFilterOptions(d.data));
  }, [moduleId]);

  const handleFilterChange = (name, val) => {
    const key = toCamelCase(name);
    setSelectedFilters((p) => {
      if (!val) { const copy = { ...p }; delete copy[key]; return copy; }
      return { ...p, [key]: val };
    });
  };

  const handleRunReport = async () => {
    setReportLoading(true);
    const blob = await runReportByModule(moduleId, selectedFilters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    setReportLoading(false);
  };

  const handleClearAll = () => setSelectedFilters({});

  return (
    <div className="or-container">
      
      <canvas ref={canvasRef} className="or-bg-canvas" />
      <div className="or-noise" />
      <div className="or-top-beam" />

      
      <div className="or-layout">

        
        <aside className="or-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title-row">
              <div className="sidebar-icon">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1 2.5h11M3 6.5h7M5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              </div>
              <span>Filters</span>
            </div>
            {activeFilters > 0 && (
              <button className="clear-all-btn" onClick={handleClearAll}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Clear all ({activeFilters})
              </button>
            )}
          </div>

          <div className="sidebar-body">
            {loading ? (
              <div className="or-loading">
                <div className="or-loader">
                  <div /><div /><div /><div />
                </div>
                Loading filters…
              </div>
            ) : filters.length === 0 ? (
              <div className="or-empty-filters">No filters available</div>
            ) : (
              filters.map((f, i) => {
                const key = toCamelCase(f);
                const isActive = Boolean(selectedFilters[key]);

                return (
                  <div
                    key={i}
                    className={`filter-row ${openKey === key ? "z-top" : ""} ${isActive ? "filter-active" : ""}`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <label className="filter-label">
                      {isActive && <span className="filter-active-dot" />}
                      {f}
                    </label>

                    {filterOptions[key] ? (
                      <Dropdown
                        label={f}
                        options={filterOptions[key]}
                        value={selectedFilters[key]}
                        isOpen={openKey === key}
                        dropdownKey={key}
                        setOpenKey={setOpenKey}
                        onChange={(v) => handleFilterChange(f, v)}
                      />
                    ) : (
                      <div className="input-wrap">
                        <input
                          type={f.toLowerCase().includes("date") ? "date" : "text"}
                          value={selectedFilters[key] || ""}
                          onChange={(e) => handleFilterChange(f, e.target.value)}
                          className={`or-input ${f.toLowerCase().includes("date") ? "or-date" : ""}`}
                          placeholder={f.toLowerCase().includes("date") ? "" : `Enter ${f}…`}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        
        <main className="or-main">
          
          <div className="or-main-header">
            <div className="or-badge">
              <span className="or-badge-dot" />
              REPORT CONFIGURATION
            </div>
            <h1 className="or-title">
              <span className="or-title-accent"></span>
              {reportName}
            </h1>
            <div className="or-title-rule" />

            
            <div className="or-stats-row">
              <div className="or-stat">
                <span className="or-stat-val">{filters.length}</span>
                <span className="or-stat-label">parameters</span>
              </div>
              <div className="or-stat-divider" />
              <div className="or-stat">
                <span className="or-stat-val" style={{ color: activeFilters > 0 ? "var(--accent)" : undefined }}>
                  {activeFilters}
                </span>
                <span className="or-stat-label">active filters</span>
              </div>
              <div className="or-stat-divider" />
              <div className="or-stat">
                <span className="or-stat-val" style={{ color: "var(--success)" }}>READY</span>
                <span className="or-stat-label">status</span>
              </div>
            </div>
          </div>

          
          <div className="or-preview-box">
            <div className="preview-topbar">
              <div className="preview-dots">
                <span /><span /><span />
              </div>
              <span className="preview-label">report.config</span>
            </div>
            <div className="preview-body">
              <div className="preview-line">
                <span className="pk">module</span>
                <span className="ps">:</span>
                <span className="pv">"{reportName}"</span>
              </div>
              <div className="preview-line">
                <span className="pk">filters</span>
                <span className="ps">:</span>
                <span className="pv">{`{`}</span>
              </div>
              {Object.entries(selectedFilters).map(([k, v], i) => (
                <div className="preview-line indent" key={i} style={{ animationDelay: `${i * 0.06}s` }}>
                  <span className="pk">{k}</span>
                  <span className="ps">:</span>
                  <span className="pv-string">"{v}"</span>
                  <span className="ps">,</span>
                </div>
              ))}
              {Object.keys(selectedFilters).length === 0 && (
                <div className="preview-line indent">
                  <span className="pv-muted">{"no filters applied"}</span>
                </div>
              )}
              <div className="preview-line"><span className="pv">{`}`}</span></div>
            </div>
          </div>

          
          {reportLoading && (
            <div className="or-generating">
              <div className="or-loader">
                <div /><div /><div /><div />
              </div>
              <span>Generating report…</span>
            </div>
          )}

          
          <div className="or-actions">
            <button
              className="or-btn or-btn-primary"
              onClick={() =>
                navigate("/master/reports/generate", {
                  state: { moduleId, reportName, filters: selectedFilters },
                })
              }
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Preview
            </button>

            <button
              className="or-btn or-btn-secondary"
              onClick={handleRunReport}
              disabled={reportLoading}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v7M3.5 5l3 3 3-3M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download
            </button>

            <button
              className="or-btn or-btn-ghost"
              onClick={() => navigate(-1)}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M8 2L3 6.5L8 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
