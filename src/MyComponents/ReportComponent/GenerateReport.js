import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import "../../Styles/Report/GenerateReport.css";
import { ReportEntity } from "../Enums/ReportEntity.js";

export default function GenerateReport() {
  const location = useLocation();
  const { moduleId, reportName, filters: initialFilters } = location.state || {};

  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalInvoice, setModalInvoice] = useState(null);
  const [summary, setSummary] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const tableRef = useRef(null);
  const modalTableRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  /* TRACK MOUSE FOR PARALLAX */
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  /* 3D CANVAS BACKGROUND */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Floating orbs
    const orbs = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 80 + Math.random() * 220,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      hue: [210, 230, 200, 240, 220, 215][i],
      alpha: 0.03 + Math.random() * 0.04,
    }));

    // Grid lines (3D perspective grid)
    let tick = 0;

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep background
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Perspective grid
      const horizon = canvas.height * 0.55;
      const vanishX = canvas.width / 2;
      const gridCount = 18;
      const speed = (tick * 0.3) % (canvas.height / gridCount);

      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 0.5;

      // Horizontal grid lines (receding)
      for (let i = 0; i <= gridCount; i++) {
        const y = horizon + speed + (i * (canvas.height - horizon)) / gridCount;
        if (y > canvas.height) continue;
        const spread = ((y - horizon) / (canvas.height - horizon)) * canvas.width * 1.4;
        ctx.beginPath();
        ctx.moveTo(vanishX - spread / 2, y);
        ctx.lineTo(vanishX + spread / 2, y);
        ctx.stroke();
      }

      // Vertical grid lines (converging to vanish point)
      const vLineCount = 20;
      for (let i = 0; i <= vLineCount; i++) {
        const t = i / vLineCount;
        const bottomX = vanishX - canvas.width * 0.7 + t * canvas.width * 1.4;
        ctx.beginPath();
        ctx.moveTo(vanishX, horizon);
        ctx.lineTo(bottomX, canvas.height + 20);
        ctx.stroke();
      }

      ctx.restore();

      // Floating glow orbs
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, `hsla(${orb.hue}, 80%, 55%, ${orb.alpha})`);
        grad.addColorStop(1, `hsla(${orb.hue}, 80%, 55%, 0)`);
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Scanlines
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillStyle = "rgba(0,0,0,0.04)";
        ctx.fillRect(0, y, canvas.width, 1);
      }

      // Vignette
      const vignette = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.height * 0.2,
        canvas.width / 2, canvas.height / 2, canvas.height * 0.85
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  /* FETCH FIELD NAMES */
  useEffect(() => {
    if (!moduleId) return;
    fetch(`http://localhost:8080/api/Reports/GetFieldByModuleId/${moduleId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 200) setFields(d.data);
        setLoading(false);
      });
  }, [moduleId]);

  /* FETCH REPORT DATA */
  useEffect(() => {
    if (!moduleId || !initialFilters) return;

    const payload = {};
    Object.keys(initialFilters).forEach((key) => {
      payload[key] =
        initialFilters[key] && initialFilters[key].trim() !== ""
          ? initialFilters[key]
          : null;
    });

    payload.page = page;
    payload.pageSize = pageSize;

    const apiMap = {
      [ReportEntity.Vendor]:        "http://localhost:8080/api/Vendor/GetVendorReport",
      [ReportEntity.ProductType]:   "http://localhost:8080/api/ProductType/GetProductTypeReport",
      [ReportEntity.Product]:       "http://localhost:8080/api/Product/GetProductReport",
      [ReportEntity.Inventory]:     "http://localhost:8080/api/Inventory/GetInventoryReport",
      [ReportEntity.Sales]:         "http://localhost:8080/api/Sales/GetSaleReport",
      [ReportEntity.Roles]:         "http://localhost:8080/api/Roles/GetRoleReport",
      [ReportEntity.Reports]:       "http://localhost:8080/api/Reports/GetReportData",
      [ReportEntity.Revenue]:       "http://localhost:8080/api/Reports/RevenueReportData",
      [ReportEntity.StockMovement]: "http://localhost:8080/api/Inventory/GetInvMovementReport",
    };

    const apiUrl = apiMap[moduleId];
    if (!apiUrl) return;

    fetch(apiUrl, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status !== 200) return;
        if (moduleId === ReportEntity.Revenue) {
          setSummary(d.data.summaryDto);
          setReportData(d.data.revenueDto || []);
        } else {
          setReportData(d.data);
        }
      });
  }, [moduleId, initialFilters, page, pageSize]);

  /* RESIZER — MAIN TABLE */
  useEffect(() => {
    if (!tableRef.current) return;
    const headers = tableRef.current.querySelectorAll(".gen-table-header-cell");
    headers.forEach((header, index) => {
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      header.appendChild(resizer);
      let startX, startWidth;
      const onMouseMove = (e) => {
        const newWidth = Math.max(80, startWidth + (e.pageX - startX));
        header.style.width = newWidth + "px";
        tableRef.current
          .querySelectorAll(`.gen-table-body-cell:nth-child(${index + 1})`)
          .forEach((cell) => (cell.style.width = newWidth + "px"));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.pageX;
        startWidth = header.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }, [fields, reportData]);

  /* RESIZER — MODAL TABLE */
  useEffect(() => {
    if (!modalInvoice || !modalTableRef.current) return;
    const headers = modalTableRef.current.querySelectorAll(".gen-table-header-cell");
    headers.forEach((header, index) => {
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      header.appendChild(resizer);
      let startX, startWidth;
      const onMouseMove = (e) => {
        const newWidth = Math.max(80, startWidth + (e.pageX - startX));
        header.style.width = newWidth + "px";
        modalTableRef.current
          .querySelectorAll(`.gen-table-body-cell:nth-child(${index + 1})`)
          .forEach((cell) => (cell.style.width = newWidth + "px"));
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startX = e.pageX;
        startWidth = header.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  }, [modalInvoice, fields]);

  if (!moduleId) {
    return (
      <div className="r-container">
        <canvas ref={canvasRef} className="bg-canvas" />
        <div className="gen-error-text">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 5V8.5M8 11H8.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Module information missing. Please go back and generate the report again.
        </div>
      </div>
    );
  }

  const toCamelCase = (str) =>
    str
      .replace(/\s(.)/g, (_, g) => g.toUpperCase())
      .replace(/\s/g, "")
      .replace(/^(.)/, (_, g) => g.toLowerCase())
      .replace(/[()₹]/g, "");

  const invoiceMap = new Map();
  let lastInvoiceKey = null;
  reportData.forEach((row) => {
    let invoiceKey = row.invoiceNumber || lastInvoiceKey;
    if (!invoiceKey) invoiceKey = `null-${Math.random()}`;
    lastInvoiceKey = row.invoiceNumber || lastInvoiceKey;
    if (!invoiceMap.has(invoiceKey)) invoiceMap.set(invoiceKey, []);
    invoiceMap.get(invoiceKey).push(row);
  });

  const invoiceKeys = Array.from(invoiceMap.keys());
  const totalPages = Math.ceil(invoiceKeys.length / pageSize);
  const paginatedKeys = invoiceKeys.slice((page - 1) * pageSize, page * pageSize);

  const openModal = (items) => setModalInvoice(items);
  const closeModal = () => setModalInvoice(null);

  /* Summary label map */
  const summaryConfig = [
    { key: "totalRevenue",    label: "Revenue",       icon: "₹", color: "#3b82f6",  glow: "rgba(59,130,246,0.4)" },
    { key: "totalProfit",     label: "Profit",        icon: "↑", color: "#10b981",  glow: "rgba(16,185,129,0.4)" },
    { key: "totalDiscount",   label: "Discount",      icon: "%", color: "#f59e0b",  glow: "rgba(245,158,11,0.4)" },
    { key: "totalTax",        label: "Tax",           icon: "T", color: "#8b5cf6",  glow: "rgba(139,92,246,0.4)" },
    { key: "netProfit",       label: "Net Profit",    icon: "N", color: "#06b6d4",  glow: "rgba(6,182,212,0.4)" },
    { key: "profitMargin",    label: "Profit Margin", icon: "M", color: "#ec4899",  glow: "rgba(236,72,153,0.4)", suffix: "%" },
    { key: "netProfitMargin", label: "Net Margin",    icon: "M", color: "#f97316",  glow: "rgba(249,115,22,0.4)", suffix: "%" },
  ];

  const parallaxStyle = {
    transform: `translate(${mousePos.x * 4}px, ${mousePos.y * 4}px)`,
    transition: "transform 0.1s linear",
  };

  return (
    <div className="r-container">
      {/* 3D Animated Canvas Background */}
      <canvas ref={canvasRef} className="bg-canvas" />

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Top accent beam */}
      <div className="top-beam" />

      {/* Header */}
      <header className="report-header" style={parallaxStyle}>
        <div className="header-badge">
          <span className="badge-dot" />
          REPORT VIEWER
        </div>
        <h1 className="gen-report-title">
          <span className="title-accent">//</span>
          {reportName}
        </h1>
        <div className="header-meta">
          <span className="meta-chip">
            <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="currentColor"/></svg>
            LIVE
          </span>
          <span className="meta-divider" />
          <span className="meta-label">{fields.length} columns</span>
          <span className="meta-divider" />
          <span className="meta-label">{reportData.length} rows</span>
        </div>
        <div className="header-rule" />
      </header>

      {/* Revenue Summary */}
      {moduleId === ReportEntity.Revenue && summary && (
        <div className="rev-summary">
          {summaryConfig.map((cfg, i) => (
            <div
              key={cfg.key}
              className="rev-card"
              style={{ "--card-accent": cfg.color, "--card-glow": cfg.glow, animationDelay: `${i * 0.08}s` }}
            >
              <div className="rev-card-bg" />
              <div className="rev-card-corner tl" />
              <div className="rev-card-corner tr" />
              <div className="rev-card-corner bl" />
              <div className="rev-card-corner br" />
              <div className="rev-card-top-line" />
              <div className="rev-card-icon">{cfg.icon}</div>
              <div className="rev-card-label">{cfg.label}</div>
              <div className="rev-card-value">
                {summary[cfg.key]}{cfg.suffix || ""}
              </div>
              <div className="rev-card-ticker" />
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="gen-loading-text">
          <div className="loader-ring">
            <div /><div /><div /><div />
          </div>
          Initializing data stream…
        </div>
      ) : (
        <>
          {/* Table Shell */}
          <div className={`table-shell ${modalInvoice ? "blurred" : ""}`}>
            <div className="table-shell-header">
              <div className="shell-title-row">
                <div className="shell-icon">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
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
                    <div
                      key={i}
                      className="gen-table-header-cell"
                      style={{ width: "170px", animationDelay: `${i * 0.04}s` }}
                    >
                      <span className="col-index">{String(i + 1).padStart(2, "0")}</span>
                      {field}
                    </div>
                  ))}
                </div>

                {paginatedKeys.map((key, gIndex) => {
                  const items = invoiceMap.get(key);
                  const hasMultiple = items.length > 1;
                  return (
                    <div
                      key={gIndex}
                      className={`gen-table-body-row invoice-row ${hoveredRow === gIndex ? "row-hovered" : ""}`}
                      style={{
                        cursor: hasMultiple ? "pointer" : "default",
                        animationDelay: `${gIndex * 0.025}s`,
                      }}
                      onClick={() => hasMultiple && openModal(items)}
                      onMouseEnter={() => setHoveredRow(gIndex)}
                      onMouseLeave={() => setHoveredRow(null)}
                    >
                      {fields.map((field, fIndex) => {
                        const keyField = toCamelCase(field);
                        return (
                          <div
                            key={fIndex}
                            className="gen-table-body-cell"
                            style={{
                              width: "170px",
                              display: fIndex === 0 && hasMultiple ? "flex" : undefined,
                              justifyContent: fIndex === 0 && hasMultiple ? "space-between" : undefined,
                            }}
                          >
                            {items[0][keyField] ?? "—"}
                            {fIndex === 0 && hasMultiple && (
                              <span className="expand-indicator">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M7 2L3 5L7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Prev
            </button>

            <div className="page-indicator">
              <span className="page-num">{page}</span>
              <span className="page-sep">/</span>
              <span className="page-total">{totalPages || 1}</span>
            </div>

            <button
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 2L7 5L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>

          {/* Modal */}
          {modalInvoice && (
            <div className="gen-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
              <div className="gen-modal-content">
                <div className="modal-top-beam" />
                <div className="modal-corner-tl" />
                <div className="modal-corner-tr" />
                <div className="modal-corner-bl" />
                <div className="modal-corner-br" />

                <div className="modal-header">
                  <div className="modal-title-group">
                    <div className="modal-eyebrow">
                      <span className="eyebrow-dot" />
                      Invoice Details
                    </div>
                    <h3>{modalInvoice[0]?.invoiceNumber || "—"}</h3>
                    <span className="modal-count">{modalInvoice.length} line items</span>
                  </div>
                  <button className="gen-modal-close" onClick={closeModal}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
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
                      <div key={rIndex} className="gen-table-body-row" style={{ animationDelay: `${rIndex * 0.04}s` }}>
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
    </div>
  );
}
