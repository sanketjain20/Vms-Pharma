import React, { useCallback, useEffect, useRef, useState } from "react";
import "../../Styles/Intelligence/Intelligence.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const DASHBOARD_API = `${API_BASE_URL}/api/Intelligence/GetDashboard`;

const DEFAULT_SETTINGS = {
  targetCoverageDays: "",
  safetyStockDays: "",
  leadTimeDays: "",
  minOrderQty: "",
  deadStockThresholdDays: "",
  stockoutRedDays: "",
  stockoutOrangeDays: "",
  overdueRedDays: "",
  lowMarginThresholdPercent: "",
};

const fmtCurrency = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(n || 0);
const fmtPercent = (n) => `${Number(n || 0).toFixed(1)}%`;
const fmtSigned = (n) => `${Number(n || 0) >= 0 ? "+" : ""}${Number(n || 0).toFixed(1)}%`;

function buildQuery(settings) {
  const params = new URLSearchParams();
  Object.entries(settings).forEach(([key, value]) => {
    if (value !== "" && value != null) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/* ════════════════════════════════════════════
   ODOMETER — rolling digit strip, same motif as the main Dashboard so this
   page reads as part of the same product rather than a bolted-on report.
════════════════════════════════════════════ */
function useSettle(dep) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setSettled(true));
      return () => cancelAnimationFrame(raf2);
    });
    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return settled;
}

function Odometer({ text }) {
  const settled = useSettle(text);
  const chars = String(text).split("");
  return (
    <span className="vint-odometer" aria-label={text}>
      <span aria-hidden="true">
        {chars.map((ch, i) => {
          if (/[0-9]/.test(ch)) {
            const d = Number(ch);
            return (
              <span className="vint-odometer-digit" key={i}>
                <span className="vint-odometer-col" style={{ transform: `translateY(${settled ? -d * 10 : 0}%)` }}>
                  {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
                </span>
              </span>
            );
          }
          return <span className="vint-odometer-static" key={i}>{ch}</span>;
        })}
      </span>
    </span>
  );
}

/* ════════════════════════════════════════════
   PLAIN-LANGUAGE "WHY?" — every reason string from the backend is a
   "• label: value" bullet list; render it as a real list instead of a
   monospace text dump so a non-technical user can actually read it.
════════════════════════════════════════════ */
function ReasonList({ reason }) {
  if (!reason) return null;
  const lines = reason
    .split("\n")
    .map((l) => l.replace(/^•\s*/, "").trim())
    .filter(Boolean);
  return (
    <ul className="vint-reason-list">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function WhyButton({ open, onClick }) {
  return (
    <button className="vint-why-btn" onClick={onClick}>
      {open ? "Hide" : "Why?"}
    </button>
  );
}

function ReasonRow({ colSpan, reason }) {
  return (
    <tr className="vint-reason-row">
      <td colSpan={colSpan}>
        <ReasonList reason={reason} />
      </td>
    </tr>
  );
}

/* ════════════════════════════════════════════
   PILL — short color-coded tag with a full explanation on hover, so the
   badge itself stays scannable but the meaning is never hidden.
════════════════════════════════════════════ */
const PILL_META = {
  RED: { cls: "vint-pill-red", label: "High risk" },
  ORANGE: { cls: "vint-pill-orange", label: "Watch" },
  RISING: { cls: "vint-pill-red", label: "Rising" },
  FALLING: { cls: "vint-pill-green", label: "Falling" },
  STABLE: { cls: "vint-pill-muted", label: "Stable" },
  HIGH: { cls: "vint-pill-blue", label: "Strong pattern" },
  LOW: { cls: "vint-pill-muted", label: "Weak signal" },
};
function Pill({ code, title }) {
  const meta = PILL_META[code] || { cls: "vint-pill-muted", label: code };
  return (
    <span className={`vint-pill ${meta.cls}`} title={title}>
      {meta.label}
    </span>
  );
}

function EmptyState({ label }) {
  return <div className="vint-empty">{label}</div>;
}

/* ════════════════════════════════════════════
   RING GAUGE — reused for stock health and overall margin
════════════════════════════════════════════ */
function Ring({ percent, label }) {
  const value = Math.max(0, Math.min(100, percent ?? 0));
  const tone = value >= 75 ? "good" : value >= 50 ? "warn" : "bad";
  return (
    <div className={`vint-ring-card vint-ring-${tone}`}>
      <div className="vint-ring" style={{ "--vint-pct": value }}>
        <span className="vint-ring-value">{value.toFixed(0)}%</span>
      </div>
      <div className="vint-ring-label">{label}</div>
    </div>
  );
}

/* ════════════════════════════════════════════
   HERO / TILE — same "big number up top, supporting metrics below" pattern
   as the main Dashboard's stat cards.
════════════════════════════════════════════ */
const HERO_ICONS = {
  restock: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="7" width="14" height="10" rx="2" /><path d="M7 7V6a3 3 0 016 0v1" /></svg>,
  clearance: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 3h4" /></svg>,
  collections: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="7" /><path d="M10 6v8M7.5 8h4a1.6 1.6 0 010 3.2h-3a1.6 1.6 0 000 3.2h4.5" /></svg>,
  suppliers: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="16" height="12" rx="2" /><path d="M2 9h16M6 9v8" /></svg>,
  profit: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7" /></svg>,
  forecast: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="3" width="16" height="14" rx="2" /><path d="M2 7.5h16M6 2v3M14 2v3M6.5 12l2 -2 2 2 3 -3" /></svg>,
};

function Hero({ iconKey, label, valueText, sub, color, children }) {
  return (
    <div className="vint-hero" style={{ "--card-color": color }}>
      <div className="vint-hero-top">
        <div className="vint-hero-icon">{HERO_ICONS[iconKey]}</div>
        <span className="vint-hero-label">{label}</span>
      </div>
      <div className="vint-hero-value">
        <Odometer text={valueText} />
      </div>
      {sub && <div className="vint-hero-sub">{sub}</div>}
      {children}
    </div>
  );
}

function Tile({ label, valueText, sub, color, clickable, onClick }) {
  return (
    <div
      className={`vint-tile ${clickable ? "vint-tile-clickable" : ""}`}
      style={{ "--card-color": color }}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <span className="vint-tile-label">{label}</span>
      <span className="vint-tile-value">
        <Odometer text={valueText} />
      </span>
      {sub && <span className="vint-tile-sub">{sub}</span>}
    </div>
  );
}

/* ════════════════════════════════════════════
   PANEL — header + body shell shared by every table/list section
════════════════════════════════════════════ */
function Panel({ title, subtitle, color, badge, children }) {
  return (
    <section className="vint-panel">
      <div className="vint-panel-header">
        <div className="vint-panel-header-left">
          <span className="vint-panel-dot" style={{ background: color }} />
          <span className="vint-panel-title">{title}</span>
        </div>
        {badge != null && <span className="vint-inline-badge">{badge}</span>}
      </div>
      {subtitle && <p className="vint-panel-subtitle">{subtitle}</p>}
      <div className="vint-panel-body">{children}</div>
    </section>
  );
}

/* ════════════════════════════════════════════
   RANKED BAR LIST — top profit products
════════════════════════════════════════════ */
const RANK_COLORS = ["#22c55e", "#34d399", "#6366f1", "#a78bfa", "#f59e0b", "#22d3ee", "#f472b6", "#fb923c"];
function RankedList({ items = [], emptyText = "No data available" }) {
  if (!items.length) return <div className="vint-empty">{emptyText}</div>;
  const max = Math.max(...items.map((i) => Number(i.itemProfit) || 0), 1);
  return (
    <div>
      {items.map((item, idx) => {
        const pct = (((Number(item.itemProfit) || 0) / max) * 100).toFixed(1);
        return (
          <div key={item.productUKey || idx} className="vint-hbar-item">
            <span className="vint-hbar-rank">{idx + 1}</span>
            <div className="vint-hbar-main">
              <div className="vint-hbar-row">
                <span className="vint-hbar-label" title={item.productName}>
                  {item.productName}
                </span>
                <span className="vint-hbar-value">{fmtCurrency(item.itemProfit)}</span>
              </div>
              <div className="vint-hbar-track">
                <div
                  className="vint-hbar-fill"
                  style={{ width: `${pct}%`, background: RANK_COLORS[idx % RANK_COLORS.length] }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════
   VIEW SWITCHER — sliding-pill segmented control, same motif as Dashboard
════════════════════════════════════════════ */
const VIEWS = [
  { id: "overview", label: "Overview", color: "#6366f1" },
  { id: "restock", label: "Restock", color: "#10b981" },
  { id: "clearance", label: "Slow-moving & Expiry", color: "#f59e0b" },
  { id: "collections", label: "Collections", color: "#ef4444" },
  { id: "suppliers", label: "Suppliers", color: "#06b6d4" },
  { id: "profit", label: "Profit", color: "#22c55e" },
  { id: "forecast", label: "Forecast", color: "#a78bfa" },
];

const VIEW_ICONS = {
  overview: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="6" height="6" rx="1" /><rect x="8.5" y="1.5" width="6" height="6" rx="1" /><rect x="1.5" y="8.5" width="6" height="6" rx="1" /><rect x="8.5" y="8.5" width="6" height="6" rx="1" /></svg>,
  restock: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="12" height="9" rx="1.5" /><path d="M5.5 5V4a2.5 2.5 0 015 0v1" /></svg>,
  clearance: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h10l-.8 8.5a1 1 0 01-1 .9H4.8a1 1 0 01-1-.9L3 5z" /><path d="M1.5 5h13M6.5 2.5h3" /></svg>,
  collections: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M8 5v6M6 6.5h2.6a1.1 1.1 0 010 2.2H6.5M9.6 9.5h-3" /></svg>,
  suppliers: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="4" width="13" height="9.5" rx="1.5" /><path d="M1.5 7.2h13" /></svg>,
  profit: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 13.5L6 8l3 2.5 5-6" /></svg>,
  forecast: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="2.5" width="13" height="11.5" rx="1.5" /><path d="M1.5 6h13M5 1v3M11 1v3" /></svg>,
};

function ViewSwitcher({ active, onChange }) {
  const railRef = useRef(null);
  const btnRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const btn = btnRefs.current[active];
    const rail = railRef.current;
    if (btn && rail) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [active]);

  useEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const activeColor = VIEWS.find((v) => v.id === active)?.color || "#6366f1";

  return (
    <nav className="vint-viewbar" ref={railRef} aria-label="VMS Intelligence views">
      <span
        className="vint-viewbar-indicator"
        style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width, "--vb-color": activeColor }}
      />
      {VIEWS.map((v) => (
        <button
          key={v.id}
          ref={(el) => {
            btnRefs.current[v.id] = el;
          }}
          className={`vint-viewtab ${active === v.id ? "vint-viewtab-active" : ""}`}
          style={{ "--vt-color": v.color }}
          onClick={() => onChange(v.id)}
        >
          {VIEW_ICONS[v.id]}
          <span>{v.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ════════════════════════════════════════════
   SETTINGS BAR — page-wide, since Phase 4's threshold overrides now affect
   Restock, Clearance, Collections and Profit, not just Smart Purchase.
   Advanced thresholds are tucked behind a collapsible <details> so the
   common Smart Purchase knobs stay the primary, uncluttered row.
════════════════════════════════════════════ */
function SettingsBar({ settings, onChange, onApply, onReset, disabled }) {
  const field = (key, label, placeholder, hint) => (
    <label className="vint-setting-field" title={hint}>
      <span>{label}</span>
      <input
        type="number"
        min="1"
        inputMode="numeric"
        placeholder={placeholder}
        value={settings[key]}
        onChange={(e) => onChange(key, e.target.value)}
      />
    </label>
  );

  return (
    <div className="vint-settings-bar">
      {field("targetCoverageDays", "Target coverage (days)", "30", "How many days of stock you want on hand after restocking")}
      {field("safetyStockDays", "Safety stock (days)", "4", "Extra buffer stock in case sales spike or a delivery is late")}
      {field("leadTimeDays", "Supplier lead time (days)", "5", "Manual override — leave blank to use each product's own supplier's lead time")}
      {field("minOrderQty", "Min order quantity", "1", "Never recommend buying fewer than this many units")}
      <button className="vint-refresh" onClick={onApply} disabled={disabled}>
        Apply
      </button>
      <button className="vint-why-btn" onClick={onReset} disabled={disabled}>
        Reset to defaults
      </button>
      <details className="vint-settings-advanced">
        <summary>Advanced thresholds</summary>
        <div className="vint-settings-advanced-grid">
          {field("stockoutRedDays", "Stockout — high risk (days)", "3", "At or below this many days of stock left, a product is flagged RED")}
          {field("stockoutOrangeDays", "Stockout — watch (days)", "7", "At or below this many days of stock left, a product is flagged for attention")}
          {field("deadStockThresholdDays", "Dead stock (days)", "60", "Flag stock as dead/slow-moving after this many days with no sale")}
          {field("overdueRedDays", "Overdue — high risk (days)", "30", "Retailers overdue by more than this many days are flagged RED")}
          {field("lowMarginThresholdPercent", "Low margin (%)", "15", "Flag a product as low-margin below this margin percentage")}
        </div>
      </details>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function Intelligence() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [expandedKey, setExpandedKey] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [appliedSettings, setAppliedSettings] = useState(DEFAULT_SETTINGS);

  const load = useCallback((settingsToUse) => {
    setLoading(true);
    setError("");
    apiClient(`${DASHBOARD_API}${buildQuery(settingsToUse)}`, { method: "GET", globalLoader: false })
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 200) {
          setData(json.data);
        } else {
          setError(json.message || "Failed to load VMS Intelligence.");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(appliedSettings);
  }, [load, appliedSettings]);

  const handleSettingChange = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
  const handleApply = () => setAppliedSettings(settings);
  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setAppliedSettings(DEFAULT_SETTINGS);
  };

  const toggle = (key) => setExpandedKey((prev) => (prev === key ? null : key));

  const summary = data?.summary;
  const stockoutRisks = data?.topStockoutRisks || [];
  const deadStock = data?.topDeadStock || [];
  const expiryAlerts = data?.topExpiryAlerts || [];
  const purchaseRecommendations = data?.topPurchaseRecommendations || [];
  const collectionRisks = data?.topCollectionRisks || [];
  const priceTrends = data?.topSupplierPriceTrends || [];
  const profitIntel = data?.profitIntelligence;
  const demandForecasts = data?.topDemandForecasts || [];

  const renderOverview = () => (
    <div className="vint-metricview">
      <div className="vint-top-grid">
        <Ring percent={summary?.stockHealthPercent} label="Stock health" />
        <div className="vint-action-card">
          <div className="vint-card-title">What needs your attention today</div>
          {summary &&
          (summary.stockoutRiskCount ||
            summary.deadStockCount ||
            summary.expiringSoonCount ||
            summary.recommendedPurchaseCount ||
            summary.highRiskRetailerCount ||
            summary.risingCostAlertCount ||
            summary.lowMarginProductCount ||
            summary.seasonalDemandAlertCount) ? (
            <p className="vint-panel-subtitle" style={{ margin: 0 }}>
              Tap any card below to see the details and the exact reasoning behind each number.
            </p>
          ) : (
            <EmptyState label="Nothing urgent right now — everything looks healthy." />
          )}
        </div>
      </div>

      <div className="vint-tilerow">
        <Tile
          label="Worth restocking"
          valueText={fmtNum(summary?.recommendedPurchaseCount)}
          sub={`${fmtCurrency(summary?.recommendedPurchaseValue)} recommended`}
          color="#10b981"
          clickable
          onClick={() => setActiveView("restock")}
        />
        <Tile
          label="Could run out soon"
          valueText={fmtNum(summary?.stockoutRiskCount)}
          sub="Selling faster than it's being restocked"
          color="#f87171"
          clickable
          onClick={() => setActiveView("restock")}
        />
        <Tile
          label="Slow-moving or expiring"
          valueText={fmtNum((summary?.deadStockCount || 0) + (summary?.expiringSoonCount || 0))}
          sub={`${fmtCurrency(summary?.deadStockValue)} tied up in stock`}
          color="#f59e0b"
          clickable
          onClick={() => setActiveView("clearance")}
        />
      </div>
      <div className="vint-tilerow">
        <Tile
          label="Retailers at risk"
          valueText={fmtNum(summary?.highRiskRetailerCount)}
          sub={`${fmtCurrency(summary?.totalOverdueFromRetailers)} overdue`}
          color="#ef4444"
          clickable
          onClick={() => setActiveView("collections")}
        />
        <Tile
          label="Rising supplier costs"
          valueText={fmtNum(summary?.risingCostAlertCount)}
          sub="Products worth re-quoting"
          color="#06b6d4"
          clickable
          onClick={() => setActiveView("suppliers")}
        />
        <Tile
          label="Low-margin products"
          valueText={fmtNum(summary?.lowMarginProductCount)}
          sub="Selling well but barely profitable"
          color="#22c55e"
          clickable
          onClick={() => setActiveView("profit")}
        />
        <Tile
          label="Seasonal patterns"
          valueText={fmtNum(summary?.seasonalDemandAlertCount)}
          sub="Products with a strong weekday pattern"
          color="#a78bfa"
          clickable
          onClick={() => setActiveView("forecast")}
        />
      </div>
    </div>
  );

  const renderRestock = () => (
    <>
      <Hero
        iconKey="restock"
        label="Recommended purchase"
        valueText={fmtCurrency(summary?.recommendedPurchaseValue)}
        sub={`Across ${fmtNum(summary?.recommendedPurchaseCount)} product${summary?.recommendedPurchaseCount === 1 ? "" : "s"}`}
        color="#10b981"
      />
      <Panel title="What to buy" subtitle="How much to order, and the math behind every number." color="#10b981">
        {purchaseRecommendations.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current stock</th>
                  <th>Buy this many</th>
                  <th>Estimated cost</th>
                  <th title="Days of stock this purchase should cover">Coverage after buying</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {purchaseRecommendations.map((r) => {
                  const key = `restock-${r.productUKey}`;
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td>
                          {r.productName} <span className="vint-muted">({r.unit})</span>
                          {r.buyBeforePriceIncrease && (
                            <span
                              className="vint-pill vint-pill-red"
                              style={{ marginLeft: 8 }}
                              title={`Supplier cost is RISING (${fmtSigned(r.priceTrendUpliftPercent)}) — buying now locks in today's price`}
                            >
                              Buy before price rises
                            </span>
                          )}
                        </td>
                        <td>{fmtNum(r.currentStock)}</td>
                        <td className="vint-qty">{fmtNum(r.recommendedQty)}</td>
                        <td>{fmtCurrency(r.estimatedCost)}</td>
                        <td>{r.expectedCoverageAfterPurchaseDays?.toFixed(1)}d</td>
                        <td>
                          <WhyButton open={expandedKey === key} onClick={() => toggle(key)} />
                        </td>
                      </tr>
                      {expandedKey === key && <ReasonRow colSpan={6} reason={r.reason} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No purchases recommended right now — stock levels look healthy against recent sales." />
        )}
      </Panel>

      <Panel title="Could run out soon" subtitle="Selling faster than current stock will cover." color="#f87171">
        {stockoutRisks.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Days remaining</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stockoutRisks.map((r) => (
                  <tr key={r.productUKey}>
                    <td>{r.productName}</td>
                    <td>
                      {fmtNum(r.currentStock)} {r.unit}
                    </td>
                    <td>{r.daysOfStockRemaining?.toFixed(1)} days</td>
                    <td>
                      <Pill code={r.riskLevel} title={r.reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No products at risk of stocking out." />
        )}
      </Panel>
    </>
  );

  const renderClearance = () => (
    <div className="vint-two-col">
      <Panel title="Slow-moving stock" subtitle="Money tied up in stock that isn't selling." color="#f59e0b" badge={fmtCurrency(summary?.deadStockValue)}>
        {deadStock.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock value</th>
                  <th>Last sale</th>
                </tr>
              </thead>
              <tbody>
                {deadStock.map((r) => (
                  <tr key={r.productUKey}>
                    <td>{r.productName}</td>
                    <td>{fmtCurrency(r.stockValue)}</td>
                    <td>{r.daysSinceLastSale == null ? "Never sold" : `${r.daysSinceLastSale} days ago`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No dead stock detected." />
        )}
      </Panel>

      <Panel title="Approaching expiry" subtitle="Batches expiring within 30 days." color="#f87171">
        {expiryAlerts.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch</th>
                  <th>Expiry date</th>
                  <th>Days left</th>
                  <th>Qty</th>
                  <th>Value at risk</th>
                </tr>
              </thead>
              <tbody>
                {expiryAlerts.map((r, idx) => (
                  <tr key={`${r.batchNumber}-${idx}`}>
                    <td>{r.productName}</td>
                    <td>{r.batchNumber}</td>
                    <td>{r.expiryDate}</td>
                    <td className={r.daysToExpiry <= 7 ? "vint-tone-red-text" : ""}>{r.daysToExpiry}</td>
                    <td>{fmtNum(r.quantity)}</td>
                    <td>{fmtCurrency(r.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="Nothing expiring in the next 30 days." />
        )}
      </Panel>
    </div>
  );

  const renderCollections = () => (
    <>
      <Hero
        iconKey="collections"
        label="Overdue from retailers"
        valueText={fmtCurrency(summary?.totalOverdueFromRetailers)}
        sub={`${fmtNum(summary?.highRiskRetailerCount)} retailer${summary?.highRiskRetailerCount === 1 ? "" : "s"} at high risk`}
        color="#ef4444"
      />
      <Panel title="Who owes you money" subtitle="Ranked by how much is overdue — the redder the tag, the more urgent." color="#ef4444">
        {collectionRisks.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>Outstanding</th>
                  <th>Overdue</th>
                  <th>Days overdue</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {collectionRisks.map((r) => {
                  const key = `col-${r.retailerUKey}`;
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td>
                          {r.shopName} <span className="vint-muted">({r.retailerCode})</span>
                        </td>
                        <td>{fmtCurrency(r.outstandingBalance)}</td>
                        <td className="vint-tone-red-text">{fmtCurrency(r.overdueAmount)}</td>
                        <td>{fmtNum(r.daysPastDueOldest)}</td>
                        <td>
                          <Pill code={r.riskLevel} title={r.reason} />
                        </td>
                        <td>
                          <WhyButton open={expandedKey === key} onClick={() => toggle(key)} />
                        </td>
                      </tr>
                      {expandedKey === key && <ReasonRow colSpan={6} reason={r.reason} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No retailers with overdue payments right now." />
        )}
      </Panel>
    </>
  );

  const renderSuppliers = () => (
    <>
      <Hero
        iconKey="suppliers"
        label="Products worth re-quoting"
        valueText={fmtNum(priceTrends.length)}
        sub="Rising cost, or a cheaper supplier is available"
        color="#06b6d4"
      />
      <Panel title="Supplier cost trends" subtitle="Are your suppliers getting more expensive, and could you buy cheaper elsewhere?" color="#06b6d4">
        {priceTrends.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Trend</th>
                  <th>Cost now</th>
                  <th>Current supplier</th>
                  <th>Cheapest supplier</th>
                  <th>Potential savings</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {priceTrends.map((r) => {
                  const key = `sup-${r.productUKey}`;
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td>{r.productName}</td>
                        <td>
                          <Pill code={r.trend} title={`${fmtSigned(r.percentChange)} vs. earlier purchases`} />
                        </td>
                        <td>{fmtCurrency(r.currentAvgCost)}/unit</td>
                        <td>{r.currentSupplierName}</td>
                        <td>
                          {r.bestSupplierName && r.bestSupplierName !== r.currentSupplierName
                            ? `${r.bestSupplierName} (${fmtCurrency(r.bestSupplierAvgCost)}/unit)`
                            : <span className="vint-muted">Already cheapest</span>}
                        </td>
                        <td>
                          {r.potentialSavingsPercent > 0 ? (
                            <span className="vint-tone-red-text">{fmtPercent(r.potentialSavingsPercent)}</span>
                          ) : (
                            <span className="vint-muted">—</span>
                          )}
                        </td>
                        <td>
                          <WhyButton open={expandedKey === key} onClick={() => toggle(key)} />
                        </td>
                      </tr>
                      {expandedKey === key && <ReasonRow colSpan={7} reason={r.reason} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No notable supplier cost changes in the last 6 months." />
        )}
      </Panel>
    </>
  );

  const renderProfit = () => (
    <>
      <div className="vint-top-grid">
        <Ring percent={profitIntel?.overallMarginPercent} label="Overall margin" />
        <Hero
          iconKey="profit"
          label="Item-level profit (last 30 days)"
          valueText={fmtCurrency(profitIntel?.totalProfit)}
          sub={`${fmtCurrency(profitIntel?.totalRevenue)} in revenue`}
          color="#22c55e"
        />
      </div>

      <div className="vint-two-col">
        <Panel title="Your top earners" subtitle="Products contributing the most actual profit, not just revenue." color="#22c55e">
          <RankedList items={profitIntel?.topProfitProducts} emptyText="Not enough sales data yet." />
        </Panel>

        <Panel
          title="Low-margin alerts"
          subtitle="Selling well, but the margin is thin — worth a price or cost review."
          color="#f59e0b"
          badge={`${fmtNum(profitIntel?.lowMarginProductCount)} product${profitIntel?.lowMarginProductCount === 1 ? "" : "s"}`}
        >
          {profitIntel?.lowMarginAlerts?.length ? (
            <div className="vint-table-wrap">
              <table className="vint-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Margin</th>
                    <th>Revenue</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profitIntel.lowMarginAlerts.map((r) => {
                    const key = `margin-${r.productUKey}`;
                    return (
                      <React.Fragment key={key}>
                        <tr>
                          <td>{r.productName}</td>
                          <td className="vint-tone-red-text">{fmtPercent(r.marginPercent)}</td>
                          <td>{fmtCurrency(r.revenue)}</td>
                          <td>
                            <WhyButton open={expandedKey === key} onClick={() => toggle(key)} />
                          </td>
                        </tr>
                        {expandedKey === key && <ReasonRow colSpan={4} reason={r.reason} />}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label="No low-margin products flagged right now." />
          )}
        </Panel>
      </div>

      <Panel title="Profit by category" subtitle="Which product categories actually make you money." color="#a78bfa">
        {profitIntel?.categoryBreakdown?.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Revenue</th>
                  <th>Profit</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {profitIntel.categoryBreakdown.map((c) => (
                  <tr key={c.categoryName}>
                    <td>{c.categoryName}</td>
                    <td>{fmtNum(c.productCount)}</td>
                    <td>{fmtCurrency(c.revenue)}</td>
                    <td>{fmtCurrency(c.profit)}</td>
                    <td>{fmtPercent(c.marginPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="Not enough sales data yet." />
        )}
      </Panel>
    </>
  );

  const renderForecast = () => (
    <>
      <Hero
        iconKey="forecast"
        label="Products with a strong weekday or seasonal pattern"
        valueText={fmtNum(demandForecasts.length)}
        sub="Restocking closer to their peak day or month avoids running short"
        color="#a78bfa"
      />
      <Panel
        title="Weekday & seasonal demand patterns"
        subtitle="Smart Purchase currently sizes orders off a flat daily average — these products sell noticeably more on one particular weekday, one particular month, or both."
        color="#a78bfa"
      >
        {demandForecasts.length ? (
          <div className="vint-table-wrap">
            <table className="vint-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Busiest day</th>
                  <th>Busiest month</th>
                  <th>Pattern strength</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {demandForecasts.map((r) => {
                  const key = `fc-${r.productUKey}`;
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td>{r.productName}</td>
                        <td>
                          {r.peakDayOfWeek ? (
                            <span className={r.peakDayUpliftPercent >= 0 ? "" : "vint-tone-red-text"}>
                              {r.peakDayOfWeek} ({fmtSigned(r.peakDayUpliftPercent)})
                            </span>
                          ) : (
                            <span className="vint-muted">—</span>
                          )}
                        </td>
                        <td>
                          {r.peakMonth ? (
                            <span className={r.monthlyUpliftPercent >= 0 ? "" : "vint-tone-red-text"}>
                              {r.peakMonth} ({fmtSigned(r.monthlyUpliftPercent)})
                            </span>
                          ) : (
                            <span className="vint-muted">—</span>
                          )}
                        </td>
                        <td>
                          <Pill code={r.confidence} title={r.reason} />
                        </td>
                        <td>
                          <WhyButton open={expandedKey === key} onClick={() => toggle(key)} />
                        </td>
                      </tr>
                      {expandedKey === key && <ReasonRow colSpan={5} reason={r.reason} />}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No strong weekday patterns detected yet — need more sales history." />
        )}
      </Panel>
    </>
  );

  const renderView = () => {
    switch (activeView) {
      case "overview":
        return renderOverview();
      case "restock":
        return renderRestock();
      case "clearance":
        return renderClearance();
      case "collections":
        return renderCollections();
      case "suppliers":
        return renderSuppliers();
      case "profit":
        return renderProfit();
      case "forecast":
        return renderForecast();
      default:
        return null;
    }
  };

  return (
    <div className="vint-root">
      <div className="vint-header">
        <div>
          <h1 className="vint-title">VMS Intelligence</h1>
          <p className="vint-subtitle">Your Business Decision Center — know what to buy, what to sell, what to collect and what to avoid.</p>
        </div>
        <button className="vint-refresh" onClick={() => load(appliedSettings)} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {!loading && <ViewSwitcher active={activeView} onChange={setActiveView} />}

      {!loading && activeView !== "overview" && activeView !== "suppliers" && activeView !== "forecast" && (
        <SettingsBar settings={settings} onChange={handleSettingChange} onApply={handleApply} onReset={handleReset} disabled={loading} />
      )}

      {error && <div className="vint-error">{error}</div>}

      {loading && !data ? (
        <div className="vint-loading">
          <div className="vint-loader">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
          Loading VMS Intelligence…
        </div>
      ) : (
        !error && <div className="vint-view" key={activeView}>{renderView()}</div>
      )}
    </div>
  );
}
