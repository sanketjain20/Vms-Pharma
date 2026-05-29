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

/* ── Mini expandable alert list ── */
const AlertList = ({ items, renderRow, emptyText }) => {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return <span className="db-list-empty">{emptyText}</span>;
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

/* ── Collapsible Section ── */
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

/* ── Stat Card ── */
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

/* ── Chart Type Switcher ── */
const CHART_ICONS = {
  bar:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="7" width="2.5" height="5" rx=".5" fill="currentColor"/><rect x="5" y="4" width="2.5" height="8" rx=".5" fill="currentColor"/><rect x="9" y="1" width="2.5" height="11" rx=".5" fill="currentColor"/></svg>,
  line: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 10L4 6l3 2.5L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pie:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 6.5V1a5.5 5.5 0 010 11A5.5 5.5 0 016.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6.5 6.5L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
};

/* ── Chart Card with type switcher ── */
const ChartCard = ({ title, color, delay, defaultType = "bar", allowedTypes = ["bar", "line", "pie"], legend, children, data, xKey, yKey, barColor, lineColors, lineLabels }) => {
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

export default function Dashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  const canvasThemeKey = useCanvasThemeKey();
  const orbsRef = useRef(null);

  /* ── Canvas BG ── */
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
        horizonRatio: 0.5,
        gridCount: 14,
        radialCount: 18,
        speed: 0.22,
        gridWidthMult: 1.4,
        radialWidthMult: 0.7,
        orbs: orbsRef.current,
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(animRef.current); };
  }, [canvasThemeKey]);

  /* ── Fetch ── */
  useEffect(() => {
    apiClient(API, { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j?.status === 200) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const d = data || {};
  const growth = d.salesGrowthPercent || 0;

  /* Build merged sales vs purchase dataset */
  const salesVsPurchase = (() => {
    const s7 = d.last7DaysSales    || [];
    const p7 = d.last7DaysPurchase || [];
    const allLabels = [...new Set([...s7.map(x => x.label), ...p7.map(x => x.label)])].sort();
    return allLabels.map(label => ({
      label,
      sales:    s7.find(x => x.label === label)?.value || 0,
      purchase: p7.find(x => x.label === label)?.value || 0,
    }));
  })();

  /* Legend for dual-line chart */
  const SalesPurchaseLegend = (
    <div className="db-chart-legend">
      <span className="db-legend-item">
        <span className="db-legend-dot" style={{ background: "#3b82f6" }}/>
        Sales
      </span>
      <span className="db-legend-item">
        <span className="db-legend-dot" style={{ background: "#10b981" }}/>
        Purchase
      </span>
    </div>
  );

  return (
    <div className="db-root">
      <canvas ref={canvasRef} className="db-canvas" />
      <div className="db-noise" />
      <div className="db-beam" />

      <div className="db-content">

        
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
            
            <CollapsibleSection
              label="Today at a glance" color="#3b82f6" defaultOpen={false}
              summaryStats={[
                { label: "Sales",       value: fmt(d.todaySalesAmount),      color: "#60a5fa" },
                { label: "Purchases",   value: fmt(d.todayPurchaseAmount),   color: "#34d399" },
                { label: "Collections", value: fmt(d.todayCollectionAmount), color: "#818cf8" },
              ]}
            >
              <div className="db-cards-row db-cards-4">
                <StatCard label="Today's sales" value={fmt(d.todaySalesAmount)}
                  sub={`${fmtNum(d.todayInvoiceCount)} invoices`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3v14M5 7l5-4 5 4M5 13l5 4 5-4"/></svg>}
                  color="#3b82f6" delay={0}>
                  <span className={`db-growth ${growth >= 0 ? "db-up" : "db-down"}`}>
                    {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% vs yesterday
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
                  sub="Outgoing payments today"
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#f87171" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M2 9h16M6 9v8"/></svg>}
                  color="#ef4444" delay={0.18}/>
              </div>
            </CollapsibleSection>

            
            <CollapsibleSection
              label="This month" color="#8b5cf6" defaultOpen={false}
              summaryStats={[
                { label: "Sales",   value: fmt(d.monthSalesAmount),  color: "#a78bfa" },
                { label: "Profit",  value: fmt(d.monthGrossProfit),  color: "#fbbf24" },
                { label: "Margin",  value: `${d.grossMarginPercent || 0}%`, color: "#34d399" },
              ]}
            >
              <div className="db-cards-row db-cards-4">
                <StatCard label="Month sales" value={fmt(d.monthSalesAmount)}
                  sub={`${fmtNum(d.monthInvoiceCount)} invoices`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#a78bfa" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7"/><circle cx="15" cy="5" r="1.5" fill="#a78bfa"/></svg>}
                  color="#8b5cf6" delay={0}/>
                <StatCard label="Month purchases" value={fmt(d.monthPurchaseAmount)}
                  sub={`${fmtNum(d.monthPurchaseCount)} orders`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#6ee7b7" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3h10l2 4H3L5 3zM3 7v10a2 2 0 002 2h10a2 2 0 002-2V7"/><path d="M9 11v4M11 11v4"/></svg>}
                  color="#10b981" delay={0.06}/>
                <StatCard label="Gross profit" value={fmt(d.monthGrossProfit)}
                  sub={`${d.grossMarginPercent || 0}% margin`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.5l-5 2.7.9-5.5L2 7.8l5.6-.8z"/></svg>}
                  color="#f59e0b" delay={0.12}/>
                <StatCard label="Collections received" value={fmt(d.monthCollectionAmount)}
                  sub={`Supplier paid: ${fmt(d.monthSupplierPaidAmount)}`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round"><path d="M3 6h14l-1 9H4L3 6zM1 3h18M8 3V2M12 3V2"/></svg>}
                  color="#06b6d4" delay={0.18}/>
              </div>
            </CollapsibleSection>

            
            <CollapsibleSection
              label="Outstanding & dues" color="#ef4444" defaultOpen={false}
              summaryStats={[
                { label: "Retailers owe", value: fmt(d.totalRetailerOutstanding),  color: "#fca5a5" },
                { label: "We owe",        value: fmt(d.totalSupplierOutstanding),  color: "#fbbf24" },
                { label: "Overdue",       value: fmtNum(d.overdueInvoiceCount),    color: "#f87171" },
              ]}
            >
              <div className="db-cards-row db-cards-4">
                <StatCard label="Retailers owe us" value={fmt(d.totalRetailerOutstanding)}
                  sub={`${fmtNum(d.retailersWithDues)} retailers with dues`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="7" r="4"/><path d="M3 18a7 7 0 0114 0"/></svg>}
                  color="#ef4444" delay={0}>
                  <AlertList items={d.overdueRetailers} emptyText="No overdue retailers"
                    renderRow={r => (<><span className="db-row-name">{r.shopName} <span className="db-row-code">{r.retailerCode}</span></span><span className="db-row-danger">{fmt(r.overdueAmount)}</span></>)}
                  />
                </StatCard>
                <StatCard label="Overdue invoices" value={fmtNum(d.overdueInvoiceCount)}
                  sub={`${fmt(d.overdueAmount)} overdue total`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fca5a5" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4M10 15h3"/></svg>}
                  color="#ef4444" delay={0.06}/>
                <StatCard label="We owe suppliers" value={fmt(d.totalSupplierOutstanding)}
                  sub={`${fmtNum(d.suppliersWithDues)} suppliers pending`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M4 4h12l2 4H2l2-4zM2 8v9a1 1 0 001 1h14a1 1 0 001-1V8"/><path d="M8 12h4"/></svg>}
                  color="#f59e0b" delay={0.12}/>
                <StatCard label="Top product (month)"
                  value={d.topProductName ? (d.topProductName.length > 18 ? d.topProductName.slice(0, 16) + "…" : d.topProductName) : "—"}
                  sub={d.topProductRevenue ? `Revenue: ${fmt(d.topProductRevenue)}` : "No data yet"}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><path d="M10 2l2 6h6l-5 4 2 6-5-3-5 3 2-6-5-4h6z"/></svg>}
                  color="#f59e0b" delay={0.18}/>
              </div>
            </CollapsibleSection>

            
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
                  sub={`${fmtNum(d.expiringIn30Days)} batches in 30 days`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>}
                  color="#f59e0b" delay={0}>
                  {d.expiringIn7Days > 0 && (
                    <AlertList items={d.expiryAlerts?.filter(e => e.expiryStatus === "CRITICAL" || e.expiryStatus === "EXPIRED")}
                      emptyText=""
                      renderRow={r => (<><span className="db-row-name">{r.productName}<span className="db-row-code"> {r.batchNumber}</span></span><span className={r.expiryStatus === "EXPIRED" ? "db-row-danger" : "db-row-warn"}>{r.expiryDate}</span></>)}
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
                  <AlertList items={d.lowStockItems} emptyText="All stock levels OK"
                    renderRow={r => (<><span className="db-row-name">{r.productName}</span><span className="db-row-warn">{r.currentQuantity} / {r.reorderLevel}</span></>)}
                  />
                </StatCard>
                <StatCard label="Dead stock" value={fmtNum(d.deadStockCount)}
                  sub={`${fmtNum(d.totalActiveProducts)} active products total`}
                  icon={<svg viewBox="0 0 20 20" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 3-4"/><path d="M14 11v6M17 14h-6"/></svg>}
                  color="#6b7280" delay={0.18}/>
              </div>
            </CollapsibleSection>

            
            <div className="db-section-label" style={{ "--sl-color": "#3b82f6" }}>
              <span className="db-section-dot" />
              Analytics charts
            </div>

            
            <div className="db-charts-row db-charts-2">

              
              <ChartCard
                title="Sales vs purchase — last 7 days"
                color="#3b82f6"
                delay={0.05}
                defaultType="line"
                allowedTypes={["line", "bar"]}
                data={salesVsPurchase}
                xKey="label"
                yKey={["sales", "purchase"]}
                barColor="#3b82f6"
                lineColors={["#3b82f6", "#10b981"]}
                lineLabels={["Sales", "Purchase"]}
                legend={SalesPurchaseLegend}
              />

              <ChartCard
                title="Monthly overview — this year"
                color="#8b5cf6"
                delay={0.1}
                defaultType="bar"
                allowedTypes={["bar", "line", "pie"]}
                data={d.monthlySales || []}
                xKey="label"
                yKey="value"
                barColor="#8b5cf6"
              />
            </div>

            
            <div className="db-charts-row db-charts-3">

              <ChartCard
                title="Top products — this month"
                color="#f59e0b"
                delay={0.15}
                defaultType="pie"
                allowedTypes={["bar", "pie"]}
                data={d.topProducts || []}
                xKey="label"
                yKey="value"
                barColor="#f59e0b"
              />

              <ChartCard
                title="Payment mode breakdown"
                color="#06b6d4"
                delay={0.2}
                defaultType="pie"
                allowedTypes={["pie", "bar"]}
                data={d.paymentModeBreakdown || []}
                xKey="label"
                yKey="value"
                barColor="#06b6d4"
              />

              <ChartCard
                title="Expiry countdown — days remaining"
                color="#f43f5e"
                delay={0.25}
                defaultType="bar"
                allowedTypes={["bar", "line","pie"]}
                data={d.expiryAlertBatches || []}
                xKey="label"
                yKey="value"
                barColor="#f43f5e"
              />
            </div>

          </>
        )}
      </div>
    </div>
  );
}