import React, { useEffect, useState, useRef } from "react";
import CustomChart from "../CommonComponent/CustomChart";
import "../../Styles/Dashboard/Dashboard.css";
import {
  useCanvasThemeKey,
  getPerspectiveCanvasPalette,
  createOrbField,
  drawPerspectiveScene,
} from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const API = `${API_BASE_URL}/api/Dashboard/Summary`;

const fmt    = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = n => new Intl.NumberFormat("en-IN").format(n || 0);
const fmtL   = n => ((n || 0) / 100000).toFixed(2);   // value → lakhs string
const fmtPct = n => `${Number(n || 0).toFixed(1)}%`;

/* ════════════════════════════════════════════
   HORIZONTAL BAR LIST
   Used for top products / suppliers / retailers
════════════════════════════════════════════ */
const HBAR_COLORS = [
  "#3b82f6","#a78bfa","#4ade80","#fbbf24",
  "#f472b6","#22d3ee","#f87171","#fb923c",
];

const HBarList = ({ items = [], valFmt, colors = HBAR_COLORS, emptyText = "No data available" }) => {
  if (!items.length) {
    return <div className="db-hbar-empty">{emptyText}</div>;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ width: "100%" }}>
      {items.map((item, idx) => {
        const pct = ((item.value / max) * 100).toFixed(1);
        const col = colors[idx % colors.length];
        return (
          <div key={idx} className="db-hbar-item">
            <div className="db-hbar-row">
              <span className="db-hbar-label" title={item.label}>
                {item.label}
              </span>
              <span className="db-hbar-value">
                {valFmt ? valFmt(item.value) : fmtNum(item.value)}
              </span>
            </div>
            <div className="db-hbar-track">
              <div className="db-hbar-fill" style={{ width: `${pct}%`, background: col }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════════════════════════════
   STATUS PILL
════════════════════════════════════════════ */
const PILL_CLASS = {
  up:   "db-pill db-pill--up",
  down: "db-pill db-pill--down",
  warn: "db-pill db-pill--warn",
  exp:  "db-pill db-pill--exp",
  crit: "db-pill db-pill--crit",
  soon: "db-pill db-pill--soon",
};

const Pill = ({ type, children }) => (
  <span className={PILL_CLASS[type] || "db-pill"}>{children}</span>
);

/* ════════════════════════════════════════════
   MINI EXPANDABLE ALERT LIST  (unchanged API)
════════════════════════════════════════════ */
const AlertList = ({ items, renderRow, emptyText }) => {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0)
    return <span className="db-list-empty">{emptyText}</span>;
  return (
    <div className="db-alert-list">
      <button className="db-list-toggle" onClick={() => setOpen(p => !p)}>
        {open ? "Hide" : `View all ${items.length}`}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d={open ? "M2 7L5 4L8 7" : "M2 3L5 6L8 3"} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="db-list-body">
          {items.map((item, i) => (
            <div key={i} className="db-list-row">{renderRow(item)}</div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════
   COLLAPSIBLE SECTION  (unchanged API)
════════════════════════════════════════════ */
const CollapsibleSection = ({ label, color = "#3b82f6", defaultOpen = false, children, summaryStats }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="db-collapsible-section">
      <button
        className={`db-section-label db-section-label--btn ${open ? "db-section-label--open" : ""}`}
        style={{ "--sl-color": color }}
        onClick={() => setOpen(p => !p)}
      >
        <span className="db-section-dot" />
        <span className="db-section-text">{label}</span>
        {!open && summaryStats && (
          <span className="db-section-summary">
            {summaryStats.map((s, i) => (
              <span key={i} className="db-section-summary-item">
                <span className="db-section-summary-label">{s.label}</span>
                <span className="db-section-summary-value" style={{ color: s.color || color }}>{s.value}</span>
              </span>
            ))}
          </span>
        )}
        <span className="db-section-chevron">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d={open ? "M3 9L7 5L11 9" : "M3 5L7 9L11 5"}
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      <div className={`db-section-body ${open ? "db-section-body--open" : ""}`}>
        <div className="db-section-body-inner">{children}</div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   STAT CARD  (unchanged API)
════════════════════════════════════════════ */
const StatCard = ({ label, value, sub, icon, color, delay = 0, children }) => (
  <div className="db-stat-card" style={{ "--card-color": color, animationDelay: `${delay}s` }}>
    <div className="db-stat-beam" />
    <div className="db-stat-corner db-tl" /><div className="db-stat-corner db-tr" />
    <div className="db-stat-corner db-bl" /><div className="db-stat-corner db-br" />
    <div className="db-stat-icon">{icon}</div>
    <div className="db-stat-body">
      <span className="db-stat-label">{label}</span>
      <span className="db-stat-value">{value}</span>
      {sub && <span className="db-stat-sub">{sub}</span>}
      {children}
    </div>
  </div>
);

/* ════════════════════════════════════════════
   CHART ICONS
════════════════════════════════════════════ */
const CHART_ICONS = {
  bar:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1"  y="7" width="2.5" height="5"  rx=".5" fill="currentColor"/><rect x="5"  y="4" width="2.5" height="8"  rx=".5" fill="currentColor"/><rect x="9"  y="1" width="2.5" height="11" rx=".5" fill="currentColor"/></svg>,
  line: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 10L4 6l3 2.5L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pie:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 6.5V1a5.5 5.5 0 010 11A5.5 5.5 0 016.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6.5 6.5L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
};

/* ════════════════════════════════════════════
   CHART CARD WITH TYPE SWITCHER  (unchanged API)
════════════════════════════════════════════ */
const ChartCard = ({
  title, color, delay = 0,
  defaultType = "bar", allowedTypes = ["bar","line","pie"],
  legend, data, xKey, yKey, barColor, lineColors, lineLabels,
}) => {
  const [chartType, setChartType] = useState(defaultType);
  return (
    <div className="db-chart-card" style={{ animationDelay: `${delay}s` }}>
      <div className="db-chart-header">
        <div className="db-chart-header-left">
          <span className="db-chart-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span className="db-chart-title">{title}</span>
        </div>
        <div className="db-chart-header-right">
          {legend && <div className="db-chart-legend">{legend}</div>}
          <div className="db-chart-switcher">
            {allowedTypes.map(t => (
              <button
                key={t}
                className={`db-chart-switch-btn ${chartType === t ? "db-chart-switch-active" : ""}`}
                style={{ "--sw-color": color }}
                onClick={() => setChartType(t)}
                title={t.charAt(0).toUpperCase() + t.slice(1) + " chart"}
              >
                {CHART_ICONS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="db-chart-body">
        <CustomChart
          data={data}
          xKey={xKey}
          yKey={yKey}
          barColor={barColor || color}
          chartType={chartType}
          lineColors={lineColors}
          lineLabels={lineLabels}
        />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   INLINE CHART CARD (no CustomChart — just HBarList or table)
   Used for top-products / suppliers / retailers sections
════════════════════════════════════════════ */
const InlineCard = ({ title, color, badge, delay = 0, children }) => (
  <div className="db-chart-card" style={{ animationDelay: `${delay}s` }}>
    <div className="db-chart-header">
      <div className="db-chart-header-left">
        <span className="db-chart-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        <span className="db-chart-title">{title}</span>
      </div>
      {badge && (
        <div className="db-chart-header-right">
          <span className="db-inline-badge">{badge}</span>
        </div>
      )}
    </div>
    <div style={{ padding: "14px 16px", flex: 1 }}>{children}</div>
  </div>
);

/* ════════════════════════════════════════════
   ALERT TABLE  (expiry / low-stock / overdue)
════════════════════════════════════════════ */
const AlertTable = ({ headers, rows, maxHeight = 220 }) => (
  <div className="db-alert-table-wrap" style={{ maxHeight, overflowY: "auto" }}>
    <table className="db-alert-table">
      <thead>
        <tr>
          {headers.map(h => <th key={h}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => <td key={j}>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ════════════════════════════════════════════
   EXPIRY STATUS PILL HELPER
════════════════════════════════════════════ */
const expiryPill = (status) => {
  if (status === "EXPIRED")  return <Pill type="exp">EXPIRED</Pill>;
  if (status === "CRITICAL") return <Pill type="crit">CRITICAL</Pill>;
  return <Pill type="soon">EXPIRING SOON</Pill>;
};

/* ════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════ */
export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const canvasThemeKey = useCanvasThemeKey();
  const orbsRef   = useRef(null);

  /* ── Canvas BG (unchanged) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const palette = getPerspectiveCanvasPalette();
    orbsRef.current = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 120 + Math.random() * 200,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      hue: [215, 225, 205, 235, 210][i],
      alpha: (0.02 + Math.random() * 0.025) * palette.orbAlphaScale,
    }));
    let tick = 0;
    const draw = () => {
      tick++;
      drawPerspectiveScene(ctx, canvas, tick, {
        horizonRatio: 0.5, gridCount: 14, radialCount: 18,
        speed: 0.22, gridWidthMult: 1.4, radialWidthMult: 0.7,
        orbs: orbsRef.current,
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [canvasThemeKey]);

  /* ── Fetch ── */
  useEffect(() => {
    apiClient(API)
      .then(r => r.json())
      .then(j => { if (j?.status === 200) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const d      = data || {};
  const growth = d.salesGrowthPercent || 0;

  /* ── Derived datasets ── */

  /* Last 7 days: Sales + Purchase + Collection (3-series line) */
  const trend7 = (() => {
    const s7 = d.last7DaysSales      || [];
    const p7 = d.last7DaysPurchase   || [];
    const c7 = d.last7DaysCollection || [];
    const labels = [...new Set([
      ...s7.map(x => x.label),
      ...p7.map(x => x.label),
      ...c7.map(x => x.label),
    ])].sort();
    return labels.map(label => ({
      label,
      sales:      s7.find(x => x.label === label)?.value || 0,
      purchase:   p7.find(x => x.label === label)?.value || 0,
      collection: c7.find(x => x.label === label)?.value || 0,
    }));
  })();

  /* Monthly overview in LAKHS (filter Mar anomaly >5Cr) */
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const salesMap  = Object.fromEntries((d.monthlySales    || []).map(x => [x.label, x.value]));
  const purchMap  = Object.fromEntries((d.monthlyPurchase || []).map(x => [x.label, x.value]));
  const profitMap = Object.fromEntries((d.monthlyProfit   || []).map(x => [x.label, x.value]));

  const monthlyOverview = MONTHS
    .filter(m => (salesMap[m] || 0) > 0 || (purchMap[m] || 0) > 0)
    .filter(m => (salesMap[m] || 0) < 50_000_000)          // exclude extreme outlier
    .map(m => ({
      label:    m,
      sales:    parseFloat(fmtL(salesMap[m]  || 0)),
      purchase: parseFloat(fmtL(purchMap[m]  || 0)),
    }));

  const monthlyProfit = MONTHS
    .filter(m => profitMap[m] !== undefined)
    .map(m => ({
      label:  m,
      profit: parseFloat(fmtL(profitMap[m] || 0)),
    }));

  /* Legend nodes */
  const Trend7Legend = (
    <div className="db-chart-legend">
      {[["#3b82f6","Sales"],["#10b981","Purchase"],["#f59e0b","Collection"]].map(([c,l]) => (
        <span key={l} className="db-legend-item">
          <span className="db-legend-dot" style={{ background: c }} />{l}
        </span>
      ))}
    </div>
  );

  const MonthlyLegend = (
    <div className="db-chart-legend">
      {[["#8b5cf6","Sales (₹L)"],["#10b981","Purchase (₹L)"]].map(([c,l]) => (
        <span key={l} className="db-legend-item">
          <span className="db-legend-dot" style={{ background: c }} />{l}
        </span>
      ))}
    </div>
  );

  return (
    <div className="db-root">
      <canvas ref={canvasRef} className="db-canvas" />
      <div className="db-noise" />
      <div className="db-beam" />

      <div className="db-content">

        {/* ── HEADER ── */}
        <div className="db-header">
          <div className="db-header-left">
            <div className="db-badge"><span className="db-badge-dot" />Analytics Overview</div>
            <h1 className="db-title"><span className="db-title-acc"></span> Dashboard</h1>
          </div>
          <div className="db-header-rule" />
        </div>

        {loading && (
          <div className="db-loading">
            <div className="db-loader"><div/><div/><div/><div/></div>
            Loading dashboard data…
          </div>
        )}

        {!loading && (
          <>

            {/* ══════════════════════════════════
                TODAY AT A GLANCE
            ══════════════════════════════════ */}
            <CollapsibleSection
              label="Today at a glance" color="#3b82f6" defaultOpen={false}
              summaryStats={[
                { label: "Sales",       value: fmt(d.todaySalesAmount),      color: "#60a5fa" },
                { label: "Purchases",   value: fmt(d.todayPurchaseAmount),   color: "#34d399" },
                { label: "Collections", value: fmt(d.todayCollectionAmount), color: "#818cf8" },
                { label: "Avg Bill",    value: fmt(d.avgSaleValueToday),     color: "#fbbf24" },
              ]}
            >
              <div className="db-cards-row db-cards-4">

                <StatCard label="Today's sales" value={fmt(d.todaySalesAmount)}
                  sub={`${fmtNum(d.todayInvoiceCount)} invoices · Avg ${fmt(d.avgSaleValueToday)}`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3v14M5 7l5-4 5 4M5 13l5 4 5-4"/></svg>}
                  color="#3b82f6" delay={0}>
                  <span className={`db-growth ${growth >= 0 ? "db-up" : "db-down"}`}>
                    {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}% vs yesterday
                  </span>
                </StatCard>

                <StatCard label="Today's purchases" value={fmt(d.todayPurchaseAmount)}
                  sub={`${fmtNum(d.todayPurchaseCount)} purchase orders`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="5" width="14" height="12" rx="2"/><path d="M7 5V4a3 3 0 016 0v1"/></svg>}
                  color="#10b981" delay={0.06}/>

                <StatCard label="Today's collections" value={fmt(d.todayCollectionAmount)}
                  sub="Received from retailers"
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#818cf8" strokeWidth="1.4" strokeLinecap="round"><path d="M3 10h14M3 6h14M3 14h7"/><circle cx="15" cy="14" r="3"/><path d="M15 12.5v1.5l1 1"/></svg>}
                  color="#6366f1" delay={0.12}/>

                <StatCard label="Paid to suppliers" value={fmt(d.todaySupplierPaidAmount)}
                  sub={`${fmtNum(d.newRetailersToday)} new retailers today`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#f87171" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M2 9h16M6 9v8"/></svg>}
                  color="#ef4444" delay={0.18}>
                  {/* Top product today */}
                  {d.topProductNameToday && (
                    <span className="db-stat-sub" style={{ color: "#fbbf24", marginTop: 4 }}>
                      🏆 {d.topProductNameToday} · {fmt(d.topProductRevenueToday)}
                    </span>
                  )}
                </StatCard>

              </div>
            </CollapsibleSection>

            {/* ══════════════════════════════════
                THIS MONTH
            ══════════════════════════════════ */}
            <CollapsibleSection
              label="This month" color="#8b5cf6" defaultOpen={false}
              summaryStats={[
                { label: "Sales",    value: fmt(d.monthSalesAmount),          color: "#a78bfa" },
                { label: "Profit",   value: fmt(d.monthItemLevelProfit),      color: "#fbbf24" },
                { label: "Margin",   value: fmtPct(d.monthItemMarginPercent), color: "#34d399" },
                { label: "Retailers",value: fmtNum(d.newRetailersMonth),      color: "#60a5fa" },
              ]}
            >
              <div className="db-cards-row db-cards-4">

                <StatCard label="Month sales" value={fmt(d.monthSalesAmount)}
                  sub={`${fmtNum(d.monthInvoiceCount)} invoices · ${fmtNum(d.newRetailersMonth)} new retailers`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7"/><circle cx="15" cy="5" r="1.5" fill="#a78bfa"/></svg>}
                  color="#8b5cf6" delay={0}/>

                <StatCard label="Month purchases" value={fmt(d.monthPurchaseAmount)}
                  sub={`${fmtNum(d.monthPurchaseCount)} orders`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#6ee7b7" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3h10l2 4H3L5 3zM3 7v10a2 2 0 002 2h10a2 2 0 002-2V7"/><path d="M9 11v4M11 11v4"/></svg>}
                  color="#10b981" delay={0.06}/>

                <StatCard label="Item-level profit" value={fmt(d.monthItemLevelProfit)}
                  sub={`${fmtPct(d.monthItemMarginPercent)} actual margin · Header: ${fmtPct(d.grossMarginPercent)}`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.5l-5 2.7.9-5.5L2 7.8l5.6-.8z"/></svg>}
                  color="#f59e0b" delay={0.12}>
                  <span className={`db-growth db-up`}>
                    ▲ {fmtPct(d.monthItemMarginPercent)} margin
                  </span>
                </StatCard>

                <StatCard label="Collections received" value={fmt(d.monthCollectionAmount)}
                  sub={`Supplier paid: ${fmt(d.monthSupplierPaidAmount)}`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round"><path d="M3 6h14l-1 9H4L3 6zM1 3h18M8 3V2M12 3V2"/></svg>}
                  color="#06b6d4" delay={0.18}/>

              </div>
            </CollapsibleSection>

            {/* ══════════════════════════════════
                OUTSTANDING & DUES
            ══════════════════════════════════ */}
            <CollapsibleSection
              label="Outstanding & dues" color="#ef4444" defaultOpen={false}
              summaryStats={[
                { label: "Retailers owe", value: fmt(d.totalRetailerOutstanding), color: "#fca5a5" },
                { label: "We owe",        value: fmt(d.totalSupplierOutstanding), color: "#fbbf24" },
                { label: "Overdue",       value: fmtNum(d.overdueInvoiceCount),   color: "#f87171" },
                { label: "Due 7 days",    value: fmt(d.upcomingDueAmount),        color: "#fbbf24" },
              ]}
            >
              <div className="db-cards-row db-cards-4">

                <StatCard label="Retailers owe us" value={fmt(d.totalRetailerOutstanding)}
                  sub={`${fmtNum(d.retailersWithDues)} retailers with dues`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="7" r="4"/><path d="M3 18a7 7 0 0114 0"/></svg>}
                  color="#ef4444" delay={0}>
                  <AlertList items={d.overdueRetailers} emptyText="No overdue retailers"
                    renderRow={r => (
                      <>
                        <span className="db-row-name">{r.shopName}<span className="db-row-code"> {r.retailerCode}</span></span>
                        <span className="db-row-danger">{fmt(r.overdueAmount)}</span>
                      </>
                    )}
                  />
                </StatCard>

                <StatCard label="Overdue invoices" value={fmtNum(d.overdueInvoiceCount)}
                  sub={`${fmt(d.overdueAmount)} overdue total`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4M10 15h3"/></svg>}
                  color="#ef4444" delay={0.06}/>

                <StatCard label="Due in 7 days" value={fmt(d.upcomingDueAmount)}
                  sub={`${fmtNum(d.upcomingDueInvoiceCount)} invoices expiring soon`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>}
                  color="#f59e0b" delay={0.12}>
                  <Pill type="warn">⏰ Upcoming</Pill>
                </StatCard>

                <StatCard label="We owe suppliers" value={fmt(d.totalSupplierOutstanding)}
                  sub={`${fmtNum(d.suppliersWithDues)} suppliers pending`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M4 4h12l2 4H2l2-4zM2 8v9a1 1 0 001 1h14a1 1 0 001-1V8"/><path d="M8 12h4"/></svg>}
                  color="#f59e0b" delay={0.18}/>

              </div>
            </CollapsibleSection>

            {/* ══════════════════════════════════
                P&L SNAPSHOT
            ══════════════════════════════════ */}
            <CollapsibleSection
              label="Profit & loss" color="#4ade80" defaultOpen={false}
              summaryStats={[
                { label: "Header profit", value: fmt(d.monthGrossProfit),         color: "#4ade80" },
                { label: "Item profit",   value: fmt(d.monthItemLevelProfit),     color: "#22d3ee" },
                { label: "Today profit",  value: fmt(d.todayGrossProfit),         color: "#fbbf24" },
                { label: "Inv Value",     value: fmt(d.totalInventoryValue),      color: "#a78bfa" },
              ]}
            >
              <div className="db-cards-row db-cards-4">

                <StatCard label="Month gross profit" value={fmt(d.monthGrossProfit)}
                  sub={`Header margin: ${fmtPct(d.grossMarginPercent)} (sales − purchase)`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7"/></svg>}
                  color="#22c55e" delay={0}>
                  <Pill type="up">▲ {fmtPct(d.grossMarginPercent)} margin</Pill>
                </StatCard>

                <StatCard label="Item-level profit" value={fmt(d.monthItemLevelProfit)}
                  sub={`Actual margin: ${fmtPct(d.monthItemMarginPercent)} (sell − cost)`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 7v3l2 2"/></svg>}
                  color="#06b6d4" delay={0.06}/>

                <StatCard label="Today's profit" value={fmt(d.todayGrossProfit)}
                  sub={`Today margin: ${fmtPct(d.todayMarginPercent)}`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3v14M5 7l5-4 5 4"/></svg>}
                  color="#f59e0b" delay={0.12}/>

                <StatCard label="Total inventory value" value={fmt(d.totalInventoryValue)}
                  sub={`${fmtNum(d.totalActiveProducts)} active products`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="16" height="4" rx="1"/><rect x="2" y="8" width="16" height="4" rx="1"/><rect x="2" y="14" width="9" height="4" rx="1"/></svg>}
                  color="#8b5cf6" delay={0.18}/>

              </div>
            </CollapsibleSection>

            {/* ══════════════════════════════════
                INVENTORY HEALTH
            ══════════════════════════════════ */}
            <CollapsibleSection
              label="Inventory health" color="#10b981" defaultOpen={false}
              summaryStats={[
                { label: "Expiring 7d", value: fmtNum(d.expiringIn7Days),   color: "#fbbf24" },
                { label: "Expired",     value: fmtNum(d.expiredBatchCount), color: "#fca5a5" },
                { label: "Low stock",   value: fmtNum(d.lowStockCount),     color: "#f59e0b" },
                { label: "Dead stock",  value: fmtNum(d.deadStockCount),    color: "#9ca3af" },
              ]}
            >
              <div className="db-cards-row db-cards-4">

                <StatCard label="Expiring in 7 days" value={fmtNum(d.expiringIn7Days)}
                  sub={`${fmtNum(d.expiringIn30Days)} batches within 30 days`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>}
                  color="#f59e0b" delay={0}>
                  {(d.expiryAlerts?.length || 0) > 0 && (
                    <AlertList
                      items={d.expiryAlerts?.filter(e => e.expiryStatus === "CRITICAL" || e.expiryStatus === "EXPIRED") || []}
                      emptyText=""
                      renderRow={r => (
                        <>
                          <span className="db-row-name">{r.productName}<span className="db-row-code"> {r.batchNumber}</span></span>
                          <span className={r.expiryStatus === "EXPIRED" ? "db-row-danger" : "db-row-warn"}>{r.expiryDate}</span>
                        </>
                      )}
                    />
                  )}
                </StatCard>

                <StatCard label="Expired stock" value={fmtNum(d.expiredBatchCount)}
                  sub="Batches with qty > 0"
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3L3 17h14L10 3z"/><path d="M10 9v4M10 14.5h.01"/></svg>}
                  color="#ef4444" delay={0.06}/>

                <StatCard label="Low stock items" value={fmtNum(d.lowStockCount)}
                  sub={`${fmtNum(d.zeroStockCount)} products at zero`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="16" height="4" rx="1"/><rect x="2" y="8" width="16" height="4" rx="1"/><rect x="2" y="14" width="9" height="4" rx="1"/></svg>}
                  color="#f59e0b" delay={0.12}>
                  <AlertList items={d.lowStockItems || []} emptyText="All stock levels OK"
                    renderRow={r => (
                      <>
                        <span className="db-row-name">{r.productName}</span>
                        <span className="db-row-warn">{r.currentQuantity} / {r.reorderLevel}</span>
                      </>
                    )}
                  />
                </StatCard>

                <StatCard label="Dead stock" value={fmtNum(d.deadStockCount)}
                  sub={`${fmtNum(d.totalActiveProducts)} active products total`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 3-4"/><path d="M14 11v6M17 14h-6"/></svg>}
                  color="#6b7280" delay={0.18}/>

              </div>
            </CollapsibleSection>

            {/* ══════════════════════════════════
                ANALYTICS CHARTS — SECTION LABEL
            ══════════════════════════════════ */}
            <div className="db-section-label" style={{ "--sl-color": "#3b82f6" }}>
              <span className="db-section-dot" />
              Analytics charts
            </div>

            {/* ── Row 1: 7-day trend + Monthly overview ── */}
            <div className="db-charts-row db-charts-2">
              <ChartCard
                title="Sales · Purchase · Collection — last 7 days"
                color="#3b82f6"
                delay={0.05}
                defaultType="line"
                allowedTypes={["line","bar"]}
                data={trend7}
                xKey="label"
                yKey={["sales","purchase","collection"]}
                barColor="#3b82f6"
                lineColors={["#3b82f6","#10b981","#f59e0b"]}
                lineLabels={["Sales","Purchase","Collection"]}
                legend={Trend7Legend}
              />

              <ChartCard
                title="Monthly overview — this year (₹ lakhs)"
                color="#8b5cf6"
                delay={0.1}
                defaultType="bar"
                allowedTypes={["bar","line"]}
                data={monthlyOverview}
                xKey="label"
                yKey={["sales","purchase"]}
                barColor="#8b5cf6"
                lineColors={["#8b5cf6","#10b981"]}
                lineLabels={["Sales (₹L)","Purchase (₹L)"]}
                legend={MonthlyLegend}
              />
            </div>

            {/* ── Row 2: Top products by revenue + by units ── */}
            <div className="db-section-label" style={{ "--sl-color": "#f472b6" }}>
              <span className="db-section-dot" />
              Top products
            </div>
            <div className="db-charts-row db-charts-2">
              <InlineCard
                title="Top products by revenue — this month"
                color="#f472b6"
                badge="₹ Revenue"
                delay={0.12}
              >
                <HBarList
                  items={d.topProducts || []}
                  valFmt={fmt}
                  colors={["#f472b6","#a78bfa","#3b82f6","#22d3ee","#4ade80"]}
                />
              </InlineCard>

              <InlineCard
                title="Top products by units — this month"
                color="#22d3ee"
                badge="Units Sold"
                delay={0.15}
              >
                <HBarList
                  items={d.topProductsByUnitsMonth || []}
                  valFmt={v => fmtNum(v) + " u"}
                  colors={["#22d3ee","#3b82f6","#a78bfa","#4ade80","#fbbf24"]}
                />
              </InlineCard>
            </div>

            {/* ── Row 3: Top suppliers + Top retailers ── */}
            <div className="db-section-label" style={{ "--sl-color": "#fbbf24" }}>
              <span className="db-section-dot" />
              Top suppliers &amp; retailers
            </div>
            <div className="db-charts-row db-charts-2">
              <InlineCard title="Top suppliers by purchase — this month" color="#fbbf24" delay={0.17}>
                <HBarList
                  items={d.topSuppliersMonth || []}
                  valFmt={fmt}
                  colors={["#fbbf24","#fb923c","#f87171","#a78bfa"]}
                />
              </InlineCard>

              <InlineCard title="Top retailers by revenue — this month" color="#4ade80" delay={0.19}>
                <HBarList
                  items={d.topRetailersMonth || []}
                  valFmt={fmt}
                  colors={["#4ade80","#22d3ee","#3b82f6","#a78bfa"]}
                />
              </InlineCard>
            </div>

            {/* ── Row 4: Payment mode + Profit trend ── */}
            <div className="db-charts-row db-charts-2">
              <ChartCard
                title="Payment mode breakdown — this month"
                color="#06b6d4"
                delay={0.2}
                defaultType="pie"
                allowedTypes={["pie","bar"]}
                data={d.paymentModeBreakdown || []}
                xKey="label"
                yKey="value"
                barColor="#06b6d4"
              />

              <ChartCard
                title="Monthly profit trend — this year (₹ lakhs)"
                color="#4ade80"
                delay={0.22}
                defaultType="bar"
                allowedTypes={["bar","line"]}
                data={monthlyProfit}
                xKey="label"
                yKey="profit"
                barColor="#4ade80"
              />
            </div>

            {/* ── Row 5: Expiry countdown + Top products pie ── */}
            <div className="db-charts-row db-charts-3">
              <ChartCard
                title="Top products — this month (revenue)"
                color="#f59e0b"
                delay={0.24}
                defaultType="pie"
                allowedTypes={["bar","pie"]}
                data={d.topProducts || []}
                xKey="label"
                yKey="value"
                barColor="#f59e0b"
              />

              <ChartCard
                title="Top products — units sold"
                color="#a78bfa"
                delay={0.26}
                defaultType="bar"
                allowedTypes={["bar","pie"]}
                data={d.topProductsByUnitsMonth || []}
                xKey="label"
                yKey="value"
                barColor="#a78bfa"
              />

              <ChartCard
                title="Expiry countdown — days remaining"
                color="#f43f5e"
                delay={0.28}
                defaultType="bar"
                allowedTypes={["bar","line","pie"]}
                data={d.expiryAlertBatches || []}
                xKey="label"
                yKey="value"
                barColor="#f43f5e"
              />
            </div>

            {/* ══════════════════════════════════
                FULL ALERT TABLES
            ══════════════════════════════════ */}
            <div className="db-section-label" style={{ "--sl-color": "#f87171" }}>
              <span className="db-section-dot" />
              Alert details
            </div>

            <div className="db-charts-row db-charts-2">

              {/* Expiry table */}
              <InlineCard
                title={`Expiry alerts · ${(d.expiryAlerts || []).length} items`}
                color="#f87171"
                delay={0.3}
              >
                <AlertTable
                  headers={["Product","Batch","Expiry","Qty","Status"]}
                  rows={(d.expiryAlerts || []).map(e => [
                    <span className="db-cell-primary">{e.productName}</span>,
                    <span className="db-cell-muted">{e.batchNumber}</span>,
                    <span className="db-cell-secondary">{e.expiryDate}</span>,
                    <span className="db-cell-secondary">{e.quantity}</span>,
                    expiryPill(e.expiryStatus),
                  ])}
                />
              </InlineCard>

              {/* Low stock + Overdue stacked */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <InlineCard
                  title={`Low stock · ${(d.lowStockItems || []).length} products`}
                  color="#fbbf24"
                  delay={0.32}
                >
                  <AlertTable
                    maxHeight={160}
                    headers={["Product","Current","Reorder","Gap"]}
                    rows={(d.lowStockItems || []).map(i => {
                      const gap = i.reorderLevel - i.currentQuantity;
                      return [
                        <span className="db-cell-primary">{i.productName}</span>,
                        <span className="db-cell-warn">{i.currentQuantity}</span>,
                        <span className="db-cell-secondary">{i.reorderLevel}</span>,
                        <span className="db-cell-danger">−{gap}</span>,
                      ];
                    })}
                  />
                </InlineCard>

                <InlineCard
                  title={`Overdue retailers · ${(d.overdueRetailers || []).length}`}
                  color="#f87171"
                  delay={0.34}
                >
                  <AlertTable
                    maxHeight={160}
                    headers={["Shop","Code","Overdue","Since"]}
                    rows={(d.overdueRetailers || []).map(r => [
                      <span className="db-cell-primary">{r.shopName}</span>,
                      <span className="db-cell-muted">{r.retailerCode}</span>,
                      <span className="db-cell-danger">{fmt(r.overdueAmount)}</span>,
                      <span className="db-cell-muted">{r.oldestDueSince}</span>,
                    ])}
                  />
                </InlineCard>
              </div>

            </div>

          </>
        )}
      </div>
    </div>
  );
}