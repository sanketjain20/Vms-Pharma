import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import CustomChart from "../CommonComponent/CustomChart";
import "../../Styles/Dashboard/Dashboard.css";
import { useCanvasThemeKey, isLightTheme } from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const API = `${API_BASE_URL}/api/Dashboard/Summary`;

const fmt    = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = n => new Intl.NumberFormat("en-IN").format(n || 0);
const fmtL   = n => ((n || 0) / 100000).toFixed(2);
const fmtPct = n => `${Number(n || 0).toFixed(1)}%`;

/* ════════════════════════════════════════════
   SIGNAL FIELD — ambient canvas backdrop
   A quiet grid of nodes with light pulses travelling between
   neighbours at random, like requests moving through a live system.
   Not used anywhere else in the app: Home uses a radiating ray-fan
   + blurred aurora blobs; this is a flat network of nodes instead.
════════════════════════════════════════════ */
const SIGNAL_HUES_DARK  = ["#6366f1", "#06b6d4", "#22c55e"];
const SIGNAL_HUES_LIGHT = ["#4338ca", "#0891b2", "#15803d"];

function SignalField() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const themeKey = useCanvasThemeKey();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const STEP = 74;
    let W = 0, H = 0, cols = 0, rows = 0, dpr = 1;
    let pulses = [];
    let spawnAcc = 0;
    let last = performance.now();

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / STEP) + 1;
      rows = Math.ceil(H / STEP) + 1;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawnPulse = () => {
      const cx = Math.floor(Math.random() * cols);
      const cy = Math.floor(Math.random() * rows);
      const horizontal = Math.random() < 0.5;
      const nx = horizontal ? cx + (Math.random() < 0.5 ? -1 : 1) : cx;
      const ny = horizontal ? cy : cy + (Math.random() < 0.5 ? -1 : 1);
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
      const hues = isLightTheme() ? SIGNAL_HUES_LIGHT : SIGNAL_HUES_DARK;
      pulses.push({
        x0: cx * STEP, y0: cy * STEP, x1: nx * STEP, y1: ny * STEP,
        t: 0, dur: 900 + Math.random() * 700,
        color: hues[(Math.random() * hues.length) | 0],
        arrived: false, flash: 0,
      });
      if (pulses.length > 26) pulses.shift();
    };

    const draw = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      spawnAcc += dt;
      while (spawnAcc > 260) { spawnAcc -= 260; spawnPulse(); }

      const light = isLightTheme();
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = light ? "rgba(15,23,42,0.065)" : "rgba(255,255,255,0.05)";
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          ctx.beginPath();
          ctx.arc(gx * STEP, gy * STEP, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.lineCap = "round";
      pulses.forEach(p => {
        p.t += dt;
        const prog = Math.min(1, p.t / p.dur);
        const eased = 1 - Math.pow(1 - prog, 2);
        const hx = p.x0 + (p.x1 - p.x0) * eased;
        const hy = p.y0 + (p.y1 - p.y0) * eased;
        const tailEased = Math.max(0, eased - 0.22);
        const tx = p.x0 + (p.x1 - p.x0) * tailEased;
        const ty = p.y0 + (p.y1 - p.y0) * tailEased;

        const grad = ctx.createLinearGradient(tx, ty, hx, hy);
        grad.addColorStop(0, `${p.color}00`);
        grad.addColorStop(1, `${p.color}bb`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(hx, hy);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = `${p.color}dd`;
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();

        if (prog >= 1 && !p.arrived) { p.arrived = true; p.flash = 1; }
        if (p.arrived) {
          p.flash *= 0.9;
          if (p.flash > 0.02) {
            ctx.beginPath();
            ctx.fillStyle = `${p.color}${Math.round(p.flash * 90).toString(16).padStart(2, "0")}`;
            ctx.arc(p.x1, p.y1, 2 + (1 - p.flash) * 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
      pulses = pulses.filter(p => !p.arrived || p.flash > 0.02);

      if (!reduce.matches) rafRef.current = requestAnimationFrame(draw);
    };

    if (reduce.matches) draw(performance.now());
    else rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [themeKey]);

  return <canvas ref={canvasRef} className="db-canvas" aria-hidden="true" />;
}

/* ════════════════════════════════════════════
   ODOMETER — rolling digit strip, settles in on mount/update.
   Distinct from Home's plain numeric count-up: each character with
   a digit gets its own 0–9 column that slides into place.
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
    <span className="db-odometer" aria-label={text}>
      <span aria-hidden="true">
        {chars.map((ch, i) => {
          if (/[0-9]/.test(ch)) {
            const d = Number(ch);
            return (
              <span className="db-odometer-digit" key={i}>
                <span className="db-odometer-col" style={{ transform: `translateY(${settled ? -d * 10 : 0}%)` }}>
                  {"0123456789".split("").map(n => <span key={n}>{n}</span>)}
                </span>
              </span>
            );
          }
          return <span className="db-odometer-static" key={i}>{ch}</span>;
        })}
      </span>
    </span>
  );
}

/* ════════════════════════════════════════════
   SPARKLINE — tiny inline trend line
════════════════════════════════════════════ */
const Sparkline = ({ points = [], color = "#6366f1", className = "db-sparkline" }) => {
  const vals = points.map(p => Number(p) || 0);
  if (vals.length < 2 || vals.every(v => v === vals[0])) return null;
  const w = 100, h = 32, pad = 2;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const step = (w - pad * 2) / (vals.length - 1);
  const coords = vals.map((v, i) => [pad + i * step, h - pad - ((v - min) / span) * (h - pad * 2)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
  const last = coords[coords.length - 1];
  const gid = `dbspk-${color.replace(/[^a-z0-9]/gi, "")}-${className.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
};

/* ════════════════════════════════════════════
   STATUS PILL
════════════════════════════════════════════ */
const PILL_CLASS = {
  up: "db-pill db-pill--up", down: "db-pill db-pill--down", warn: "db-pill db-pill--warn",
  exp: "db-pill db-pill--exp", crit: "db-pill db-pill--crit", soon: "db-pill db-pill--soon",
};
const Pill = ({ type, children }) => <span className={PILL_CLASS[type] || "db-pill"}>{children}</span>;

/* ════════════════════════════════════════════
   MINI EXPANDABLE ALERT LIST  (unchanged API)
════════════════════════════════════════════ */
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
          {items.map((item, i) => <div key={i} className="db-list-row">{renderRow(item)}</div>)}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════
   HERO METRIC + TILE — the Stripe-style "big number up top,
   supporting metrics below" pattern used by every KPI view.
════════════════════════════════════════════ */
const StatHero = ({ label, valueText, sub, icon, color, trend, children }) => (
  <div className="db-hero db-stat-card" style={{ "--card-color": color }}>
    <div className="db-halo" />
    <div className="db-hero-top">
      <div className="db-hero-icon">{icon}</div>
      <span className="db-hero-label">{label}</span>
    </div>
    <div className="db-hero-body">
      <div>
        <div className="db-hero-value"><Odometer text={valueText} /></div>
        {sub && <div className="db-hero-sub">{sub}</div>}
      </div>
      {trend && trend.length > 1 && (
        <div className="db-hero-chart"><Sparkline points={trend} color={color} className="db-sparkline db-sparkline--lg" /></div>
      )}
    </div>
    {children && <div className="db-hero-extra">{children}</div>}
  </div>
);

const StatTile = ({ label, valueText, sub, icon, color, trend, children }) => (
  <div className="db-stat-card" style={{ "--card-color": color }}>
    <div className="db-stat-top">
      <div className="db-stat-icon">{icon}</div>
      {trend && trend.length > 1 && <Sparkline points={trend} color={color} />}
    </div>
    <div className="db-stat-body">
      <span className="db-stat-label">{label}</span>
      <span className="db-stat-value"><Odometer text={valueText} /></span>
      {sub && <span className="db-stat-sub">{sub}</span>}
      {children}
    </div>
  </div>
);

/* ════════════════════════════════════════════
   PANEL — generic header + body shell, shared by chart cards,
   ranked lists and alert panels
════════════════════════════════════════════ */
const Panel = ({ title, color, badge, right, delay = 0, children }) => (
  <div className="db-chart-card" style={{ animationDelay: `${delay}s` }}>
    <div className="db-chart-header">
      <div className="db-chart-header-left">
        <span className="db-chart-dot" style={{ background: color }} />
        <span className="db-chart-title">{title}</span>
      </div>
      {(badge || right) && (
        <div className="db-chart-header-right">
          {badge && <span className="db-inline-badge">{badge}</span>}
          {right}
        </div>
      )}
    </div>
    <div className="db-chart-body" style={{ padding: "14px 16px" }}>{children}</div>
  </div>
);

/* ════════════════════════════════════════════
   CHART ICONS + CHART CARD (type switcher, unchanged API)
════════════════════════════════════════════ */
const CHART_ICONS = {
  bar:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1"  y="7" width="2.5" height="5"  rx=".5" fill="currentColor"/><rect x="5"  y="4" width="2.5" height="8"  rx=".5" fill="currentColor"/><rect x="9"  y="1" width="2.5" height="11" rx=".5" fill="currentColor"/></svg>,
  line: <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1 10L4 6l3 2.5L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pie:  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 6.5V1a5.5 5.5 0 010 11A5.5 5.5 0 016.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M6.5 6.5L11.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
};

const ChartCard = ({ title, color, delay = 0, defaultType = "bar", allowedTypes = ["bar","line","pie"], legend, data, xKey, yKey, barColor, lineColors, lineLabels }) => {
  const [chartType, setChartType] = useState(defaultType);
  const switcher = (
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
  );
  return (
    <div className="db-chart-card" style={{ animationDelay: `${delay}s` }}>
      <div className="db-chart-header">
        <div className="db-chart-header-left">
          <span className="db-chart-dot" style={{ background: color }} />
          <span className="db-chart-title">{title}</span>
        </div>
        <div className="db-chart-header-right">
          {legend}
          {switcher}
        </div>
      </div>
      <div className="db-chart-body">
        <CustomChart data={data} xKey={xKey} yKey={yKey} barColor={barColor || color} chartType={chartType} lineColors={lineColors} lineLabels={lineLabels} />
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════
   RANKED LIST — top products / suppliers / retailers
════════════════════════════════════════════ */
const RANK_COLORS = ["#6366f1","#a78bfa","#34d399","#fbbf24","#f472b6","#22d3ee","#f87171","#fb923c"];

const RankedList = ({ items = [], valFmt, colors = RANK_COLORS, emptyText = "No data available" }) => {
  if (!items.length) return <div className="db-hbar-empty">{emptyText}</div>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div>
      {items.map((item, idx) => {
        const pct = ((item.value / max) * 100).toFixed(1);
        const col = colors[idx % colors.length];
        return (
          <div key={idx} className="db-hbar-item">
            <span className="db-hbar-rank">{idx + 1}</span>
            <div className="db-hbar-main">
              <div className="db-hbar-row">
                <span className="db-hbar-label" title={item.label}>{item.label}</span>
                <span className="db-hbar-value">{valFmt ? valFmt(item.value) : fmtNum(item.value)}</span>
              </div>
              <div className="db-hbar-track">
                <div className="db-hbar-fill" style={{ width: `${pct}%`, background: col }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ════════════════════════════════════════════
   ALERT ROW — clean list row (expiry / low-stock / overdue)
════════════════════════════════════════════ */
const AlertRow = ({ primary, secondary, value, valueColor, pill, progress, progressColor }) => (
  <div className="db-arow">
    <div className="db-arow-main">
      <span className="db-arow-primary">{primary}</span>
      {secondary && <span className="db-arow-secondary">{secondary}</span>}
      {progress != null && (
        <div className="db-arow-progress db-hbar-track">
          <div className="db-hbar-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%`, background: progressColor }} />
        </div>
      )}
    </div>
    <div className="db-arow-end">
      {value && <span className="db-arow-value" style={{ color: valueColor }}>{value}</span>}
      {pill}
    </div>
  </div>
);

const expiryPill = (status) => {
  if (status === "EXPIRED")  return <Pill type="exp">EXPIRED</Pill>;
  if (status === "CRITICAL") return <Pill type="crit">CRITICAL</Pill>;
  return <Pill type="soon">SOON</Pill>;
};

/* ════════════════════════════════════════════
   VIEW SWITCHER — sliding-pill segmented control
════════════════════════════════════════════ */
const VIEW_ICONS = {
  today: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3.4"/><path d="M8 1v1.4M8 13.6V15M15 8h-1.4M2.4 8H1M12.9 3.1l-1 1M4.1 11.9l-1 1M12.9 12.9l-1-1M4.1 4.1l-1-1"/></svg>,
  month: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/></svg>,
  outstanding: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.6l7 12.3H1L8 1.6z"/><path d="M8 6.4v3.4M8 11.8h.01"/></svg>,
  pnl: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 13.5L6 8l3 2.5 5.5-6.5"/><path d="M10.5 4h4v4"/></svg>,
  inventory: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l6-3.2L14 5v6l-6 3.2L2 11V5z"/><path d="M2 5l6 3.2M8 8.2L14 5M8 8.2v6"/></svg>,
  analytics: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="8.5" width="3" height="6" rx=".5"/><rect x="6.5" y="4.5" width="3" height="10" rx=".5"/><rect x="11.5" y="1.5" width="3" height="13" rx=".5"/></svg>,
  toplists: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 2h6v4.2a3 3 0 01-6 0V2z"/><path d="M5 3H2.5a1 1 0 000 5.5M11 3h2.5a1 1 0 010 5.5M8 9.2V13M5.5 14.5h5"/></svg>,
  alerts: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.8a4 4 0 00-4 4v2.6L2.5 10.8h11L12 8.4V5.8a4 4 0 00-4-4z"/><path d="M6.3 13.2a1.8 1.8 0 003.4 0"/></svg>,
};

const VIEWS = [
  { id: "today",       label: "Today",       color: "#6366f1" },
  { id: "month",       label: "This month",  color: "#8b5cf6" },
  { id: "outstanding", label: "Outstanding", color: "#ef4444" },
  { id: "pnl",         label: "P&L",         color: "#22c55e" },
  { id: "inventory",   label: "Inventory",   color: "#10b981" },
  { id: "analytics",   label: "Analytics",   color: "#3b82f6" },
  { id: "toplists",    label: "Top lists",   color: "#f59e0b" },
  { id: "alerts",      label: "Alerts",      color: "#f87171" },
];

const ViewSwitcher = ({ active, onChange }) => {
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

  useEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const activeColor = VIEWS.find(v => v.id === active)?.color || "#6366f1";

  return (
    <nav className="db-viewbar db-panel" ref={railRef} aria-label="Dashboard views">
      <span className="db-viewbar-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width, "--vb-color": activeColor }} />
      {VIEWS.map(v => (
        <button
          key={v.id}
          ref={el => { btnRefs.current[v.id] = el; }}
          className={`db-viewtab ${active === v.id ? "db-viewtab--active" : ""}`}
          style={{ "--vt-color": v.color }}
          onClick={() => onChange(v.id)}
        >
          {VIEW_ICONS[v.id]}
          <span>{v.label}</span>
        </button>
      ))}
    </nav>
  );
};

/* ════════════════════════════════════════════
   ICONS for hero/tile metrics
════════════════════════════════════════════ */
const ICN = {
  sales:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3v14M5 7l5-4 5 4M5 13l5 4 5-4"/></svg>,
  purchase:   <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="5" width="14" height="12" rx="2"/><path d="M7 5V4a3 3 0 016 0v1"/></svg>,
  collection: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 10h14M3 6h14M3 14h7"/><circle cx="15" cy="14" r="3"/><path d="M15 12.5v1.5l1 1"/></svg>,
  supplier:   <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="16" height="12" rx="2"/><path d="M2 9h16M6 9v8"/></svg>,
  monthsales: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/></svg>,
  crate:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3h10l2 4H3L5 3zM3 7v10a2 2 0 002 2h10a2 2 0 002-2V7"/><path d="M9 11v4M11 11v4"/></svg>,
  medal:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M10 2l2.4 5 5.6.8-4 3.9.9 5.5L10 14.5l-5 2.7.9-5.5L2 7.8l5.6-.8z"/></svg>,
  invoice:    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 6h14l-1 9H4L3 6zM1 3h18M8 3V2M12 3V2"/></svg>,
  people:     <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="7" r="4"/><path d="M3 18a7 7 0 0114 0"/></svg>,
  doc:        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="3" y="2" width="14" height="16" rx="2"/><path d="M7 7h6M7 11h4M10 15h3"/></svg>,
  clock:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2.5 2.5"/></svg>,
  owe:        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M4 4h12l2 4H2l2-4zM2 8v9a1 1 0 001 1h14a1 1 0 001-1V8"/><path d="M8 12h4"/></svg>,
  trend:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 4-7"/></svg>,
  target:     <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="10" cy="10" r="8"/><path d="M10 7v3l2 2"/></svg>,
  bolt:       <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3v14M5 7l5-4 5 4"/></svg>,
  stack:      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="16" height="4" rx="1"/><rect x="2" y="8" width="16" height="4" rx="1"/><rect x="2" y="14" width="9" height="4" rx="1"/></svg>,
  warnTri:    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M10 3L3 17h14L10 3z"/><path d="M10 9v4M10 14.5h.01"/></svg>,
  down:       <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 17l4-5 4 3 3-4"/><path d="M14 11v6M17 14h-6"/></svg>,
};

/* ════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════ */
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("today");

  useEffect(() => {
    apiClient(API)
      .then(r => r.json())
      .then(j => { if (j?.status === 200) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const d = data || {};
  const growth = d.salesGrowthPercent || 0;

  const trend7 = useMemo(() => {
    const s7 = d.last7DaysSales || [];
    const p7 = d.last7DaysPurchase || [];
    const c7 = d.last7DaysCollection || [];
    const labels = [...new Set([...s7.map(x => x.label), ...p7.map(x => x.label), ...c7.map(x => x.label)])].sort();
    return labels.map(label => ({
      label,
      sales: s7.find(x => x.label === label)?.value || 0,
      purchase: p7.find(x => x.label === label)?.value || 0,
      collection: c7.find(x => x.label === label)?.value || 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const salesMap  = Object.fromEntries((d.monthlySales    || []).map(x => [x.label, x.value]));
  const purchMap  = Object.fromEntries((d.monthlyPurchase || []).map(x => [x.label, x.value]));
  const profitMap = Object.fromEntries((d.monthlyProfit   || []).map(x => [x.label, x.value]));

  const monthlyOverview = MONTHS
    .filter(m => (salesMap[m] || 0) > 0 || (purchMap[m] || 0) > 0)
    .filter(m => (salesMap[m] || 0) < 50_000_000)
    .map(m => ({ label: m, sales: parseFloat(fmtL(salesMap[m] || 0)), purchase: parseFloat(fmtL(purchMap[m] || 0)) }));

  const monthlyProfit = MONTHS
    .filter(m => profitMap[m] !== undefined)
    .map(m => ({ label: m, profit: parseFloat(fmtL(profitMap[m] || 0)) }));

  const salesTrend      = trend7.map(x => x.sales);
  const purchaseTrend   = trend7.map(x => x.purchase);
  const collectionTrend = trend7.map(x => x.collection);
  const monthSalesTrend  = monthlyOverview.map(x => x.sales);
  const monthPurchTrend  = monthlyOverview.map(x => x.purchase);
  const monthProfitTrend = monthlyProfit.map(x => x.profit);

  const Trend7Legend = (
    <div className="db-chart-legend">
      {[["#6366f1","Sales"],["#10b981","Purchase"],["#f59e0b","Collection"]].map(([c,l]) => (
        <span key={l} className="db-legend-item"><span className="db-legend-dot" style={{ background: c }} />{l}</span>
      ))}
    </div>
  );
  const MonthlyLegend = (
    <div className="db-chart-legend">
      {[["#8b5cf6","Sales (₹L)"],["#10b981","Purchase (₹L)"]].map(([c,l]) => (
        <span key={l} className="db-legend-item"><span className="db-legend-dot" style={{ background: c }} />{l}</span>
      ))}
    </div>
  );

  /* ── per-view content ── */
  const renderView = () => {
    switch (activeView) {

      case "today": return (
        <div className="db-metricview">
          <StatHero label="Today's sales" valueText={fmt(d.todaySalesAmount)} color="#6366f1" icon={ICN.sales}
            sub={`${fmtNum(d.todayInvoiceCount)} invoices · Avg ${fmt(d.avgSaleValueToday)}`} trend={salesTrend}>
            <span className={`db-growth ${growth >= 0 ? "db-up" : "db-down"}`}>
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth).toFixed(1)}% vs yesterday
            </span>
          </StatHero>
          <div className="db-tilerow">
            <StatTile label="Today's purchases" valueText={fmt(d.todayPurchaseAmount)} color="#10b981" icon={ICN.purchase}
              sub={`${fmtNum(d.todayPurchaseCount)} purchase orders`} trend={purchaseTrend} />
            <StatTile label="Today's collections" valueText={fmt(d.todayCollectionAmount)} color="#8b5cf6" icon={ICN.collection}
              sub="Received from retailers" trend={collectionTrend} />
            <StatTile label="Paid to suppliers" valueText={fmt(d.todaySupplierPaidAmount)} color="#ef4444" icon={ICN.supplier}
              sub={`${fmtNum(d.newRetailersToday)} new retailers today`}>
              {d.topProductNameToday && (
                <span className="db-stat-sub db-stat-highlight">🏆 {d.topProductNameToday} · {fmt(d.topProductRevenueToday)}</span>
              )}
            </StatTile>
          </div>
        </div>
      );

      case "month": return (
        <div className="db-metricview">
          <StatHero label="Month sales" valueText={fmt(d.monthSalesAmount)} color="#8b5cf6" icon={ICN.monthsales}
            sub={`${fmtNum(d.monthInvoiceCount)} invoices · ${fmtNum(d.newRetailersMonth)} new retailers`} trend={monthSalesTrend} />
          <div className="db-tilerow">
            <StatTile label="Month purchases" valueText={fmt(d.monthPurchaseAmount)} color="#10b981" icon={ICN.crate}
              sub={`${fmtNum(d.monthPurchaseCount)} orders`} trend={monthPurchTrend} />
            <StatTile label="Item-level profit" valueText={fmt(d.monthItemLevelProfit)} color="#f59e0b" icon={ICN.medal}
              sub={`${fmtPct(d.monthItemMarginPercent)} actual margin · Header: ${fmtPct(d.grossMarginPercent)}`}>
              <span className="db-growth db-up">▲ {fmtPct(d.monthItemMarginPercent)} margin</span>
            </StatTile>
            <StatTile label="Collections received" valueText={fmt(d.monthCollectionAmount)} color="#06b6d4" icon={ICN.invoice}
              sub={`Supplier paid: ${fmt(d.monthSupplierPaidAmount)}`} />
          </div>
        </div>
      );

      case "outstanding": return (
        <div className="db-metricview">
          <StatHero label="Retailers owe us" valueText={fmt(d.totalRetailerOutstanding)} color="#ef4444" icon={ICN.people}
            sub={`${fmtNum(d.retailersWithDues)} retailers with dues`}>
            <AlertList items={d.overdueRetailers} emptyText="No overdue retailers"
              renderRow={r => (
                <>
                  <span className="db-row-name">{r.shopName}<span className="db-row-code"> {r.retailerCode}</span></span>
                  <span className="db-row-danger">{fmt(r.overdueAmount)}</span>
                </>
              )}
            />
          </StatHero>
          <div className="db-tilerow">
            <StatTile label="Overdue invoices" valueText={fmtNum(d.overdueInvoiceCount)} color="#ef4444" icon={ICN.doc}
              sub={`${fmt(d.overdueAmount)} overdue total`} />
            <StatTile label="Due in 7 days" valueText={fmt(d.upcomingDueAmount)} color="#f59e0b" icon={ICN.clock}
              sub={`${fmtNum(d.upcomingDueInvoiceCount)} invoices expiring soon`}>
              <Pill type="warn">⏰ Upcoming</Pill>
            </StatTile>
            <StatTile label="We owe suppliers" valueText={fmt(d.totalSupplierOutstanding)} color="#f59e0b" icon={ICN.owe}
              sub={`${fmtNum(d.suppliersWithDues)} suppliers pending`} />
          </div>
        </div>
      );

      case "pnl": return (
        <div className="db-metricview">
          <StatHero label="Month gross profit" valueText={fmt(d.monthGrossProfit)} color="#22c55e" icon={ICN.trend}
            sub={`Header margin: ${fmtPct(d.grossMarginPercent)} (sales − purchase)`} trend={monthProfitTrend}>
            <Pill type="up">▲ {fmtPct(d.grossMarginPercent)} margin</Pill>
          </StatHero>
          <div className="db-tilerow">
            <StatTile label="Item-level profit" valueText={fmt(d.monthItemLevelProfit)} color="#06b6d4" icon={ICN.target}
              sub={`Actual margin: ${fmtPct(d.monthItemMarginPercent)} (sell − cost)`} />
            <StatTile label="Today's profit" valueText={fmt(d.todayGrossProfit)} color="#f59e0b" icon={ICN.bolt}
              sub={`Today margin: ${fmtPct(d.todayMarginPercent)}`} />
            <StatTile label="Total inventory value" valueText={fmt(d.totalInventoryValue)} color="#8b5cf6" icon={ICN.stack}
              sub={`${fmtNum(d.totalActiveProducts)} active products`} />
          </div>
        </div>
      );

      case "inventory": return (
        <div className="db-metricview">
          <StatHero label="Expiring in 7 days" valueText={fmtNum(d.expiringIn7Days)} color="#f59e0b" icon={ICN.clock}
            sub={`${fmtNum(d.expiringIn30Days)} batches within 30 days`}>
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
          </StatHero>
          <div className="db-tilerow">
            <StatTile label="Expired stock" valueText={fmtNum(d.expiredBatchCount)} color="#ef4444" icon={ICN.warnTri}
              sub="Batches with qty > 0" />
            <StatTile label="Low stock items" valueText={fmtNum(d.lowStockCount)} color="#f59e0b" icon={ICN.stack}
              sub={`${fmtNum(d.zeroStockCount)} products at zero`}>
              <AlertList items={d.lowStockItems || []} emptyText="All stock levels OK"
                renderRow={r => (
                  <>
                    <span className="db-row-name">{r.productName}</span>
                    <span className="db-row-warn">{r.currentQuantity} / {r.reorderLevel}</span>
                  </>
                )}
              />
            </StatTile>
            <StatTile label="Dead stock" valueText={fmtNum(d.deadStockCount)} color="#6b7280" icon={ICN.down}
              sub={`${fmtNum(d.totalActiveProducts)} active products total`} />
          </div>
        </div>
      );

      case "analytics": return (
        <>
          <div className="db-charts-row db-charts-2">
            <ChartCard title="Sales · Purchase · Collection — last 7 days" color="#6366f1" delay={0.02}
              defaultType="line" allowedTypes={["line","bar"]} data={trend7} xKey="label"
              yKey={["sales","purchase","collection"]} barColor="#6366f1"
              lineColors={["#6366f1","#10b981","#f59e0b"]} lineLabels={["Sales","Purchase","Collection"]} legend={Trend7Legend} />
            <ChartCard title="Monthly overview — this year (₹ lakhs)" color="#8b5cf6" delay={0.06}
              defaultType="bar" allowedTypes={["bar","line"]} data={monthlyOverview} xKey="label"
              yKey={["sales","purchase"]} barColor="#8b5cf6" lineColors={["#8b5cf6","#10b981"]}
              lineLabels={["Sales (₹L)","Purchase (₹L)"]} legend={MonthlyLegend} />
          </div>
          <div className="db-charts-row db-charts-2">
            <ChartCard title="Payment mode breakdown — this month" color="#06b6d4" delay={0.1}
              defaultType="pie" allowedTypes={["pie","bar"]} data={d.paymentModeBreakdown || []} xKey="label" yKey="value" barColor="#06b6d4" />
            <ChartCard title="Monthly profit trend — this year (₹ lakhs)" color="#22c55e" delay={0.14}
              defaultType="bar" allowedTypes={["bar","line"]} data={monthlyProfit} xKey="label" yKey="profit" barColor="#22c55e" />
          </div>
          <div className="db-charts-row db-charts-3">
            <ChartCard title="Top products — revenue" color="#f59e0b" delay={0.18}
              defaultType="pie" allowedTypes={["bar","pie"]} data={d.topProducts || []} xKey="label" yKey="value" barColor="#f59e0b" />
            <ChartCard title="Top products — units sold" color="#a78bfa" delay={0.22}
              defaultType="bar" allowedTypes={["bar","pie"]} data={d.topProductsByUnitsMonth || []} xKey="label" yKey="value" barColor="#a78bfa" />
            <ChartCard title="Expiry countdown — days remaining" color="#f43f5e" delay={0.26}
              defaultType="bar" allowedTypes={["bar","line","pie"]} data={d.expiryAlertBatches || []} xKey="label" yKey="value" barColor="#f43f5e" />
          </div>
        </>
      );

      case "toplists": return (
        <div className="db-charts-row db-charts-2">
          <Panel title="Top products by revenue — this month" color="#f472b6" badge="₹ Revenue" delay={0.02}>
            <RankedList items={d.topProducts || []} valFmt={fmt} colors={["#f472b6","#a78bfa","#6366f1","#22d3ee","#34d399"]} />
          </Panel>
          <Panel title="Top products by units — this month" color="#22d3ee" badge="Units sold" delay={0.06}>
            <RankedList items={d.topProductsByUnitsMonth || []} valFmt={v => fmtNum(v) + " u"} colors={["#22d3ee","#6366f1","#a78bfa","#34d399","#fbbf24"]} />
          </Panel>
          <Panel title="Top suppliers by purchase — this month" color="#fbbf24" delay={0.1}>
            <RankedList items={d.topSuppliersMonth || []} valFmt={fmt} colors={["#fbbf24","#fb923c","#f87171","#a78bfa"]} />
          </Panel>
          <Panel title="Top retailers by revenue — this month" color="#34d399" delay={0.14}>
            <RankedList items={d.topRetailersMonth || []} valFmt={fmt} colors={["#34d399","#22d3ee","#6366f1","#a78bfa"]} />
          </Panel>
        </div>
      );

      case "alerts": return (
        <div className="db-charts-row db-charts-2">
          <Panel title="Expiry alerts" color="#f87171" badge={`${(d.expiryAlerts || []).length} items`} delay={0.02}>
            <div className="db-alertpanel-list">
              {(d.expiryAlerts || []).length === 0 && <span className="db-list-empty">No expiry alerts</span>}
              {(d.expiryAlerts || []).map((e, i) => (
                <AlertRow key={i} primary={e.productName} secondary={`${e.batchNumber} · Qty ${e.quantity}`}
                  value={e.expiryDate} pill={expiryPill(e.expiryStatus)} />
              ))}
            </div>
          </Panel>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Panel title="Low stock" color="#fbbf24" badge={`${(d.lowStockItems || []).length} products`} delay={0.06}>
              <div className="db-alertpanel-list" style={{ maxHeight: 160 }}>
                {(d.lowStockItems || []).length === 0 && <span className="db-list-empty">All stock levels OK</span>}
                {(d.lowStockItems || []).map((i, idx) => {
                  const pct = i.reorderLevel ? (i.currentQuantity / i.reorderLevel) * 100 : 0;
                  return (
                    <AlertRow key={idx} primary={i.productName} secondary={`${i.currentQuantity} of ${i.reorderLevel} reorder level`}
                      value={`−${i.reorderLevel - i.currentQuantity}`} valueColor="var(--db-danger)"
                      progress={pct} progressColor="var(--db-warn)" />
                  );
                })}
              </div>
            </Panel>
            <Panel title="Overdue retailers" color="#f87171" badge={`${(d.overdueRetailers || []).length}`} delay={0.1}>
              <div className="db-alertpanel-list" style={{ maxHeight: 160 }}>
                {(d.overdueRetailers || []).length === 0 && <span className="db-list-empty">No overdue retailers</span>}
                {(d.overdueRetailers || []).map((r, i) => (
                  <AlertRow key={i} primary={r.shopName} secondary={`${r.retailerCode} · since ${r.oldestDueSince}`}
                    value={fmt(r.overdueAmount)} valueColor="var(--db-danger)" />
                ))}
              </div>
            </Panel>
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <div className="db-root db-dashboard">
      <SignalField />
      <div className="db-noise" />

      <div className="db-content">
        <div className="db-header">
          <div className="db-header-left">
            <div className="db-badge"><span className="db-badge-dot" />Live analytics</div>
            <h1 className="db-title">Dashboard</h1>
          </div>
        </div>

        {!loading && <ViewSwitcher active={activeView} onChange={setActiveView} />}

        {loading && (
          <div className="db-loading">
            <div className="db-loader"><div/><div/><div/><div/></div>
            Loading dashboard data…
          </div>
        )}

        {!loading && <div className="db-view" key={activeView}>{renderView()}</div>}
      </div>
    </div>
  );
}
