import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";
import API_BASE_URL from "../Config/api.config";
import apiClient from "../Config/apiClient";

/* ── Animated count-up number ── */
function CountUp({ target, prefix = "", suffix = "", duration = 1100 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const start = performance.now();
    const numeric = parseFloat(String(target).replace(/[^0-9.]/g, "")) || 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(numeric * eased);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  const isDecimal = String(target).includes(".");
  const display = isDecimal ? val.toFixed(1) : Math.round(val).toLocaleString("en-IN");

  return <>{prefix}{display}{suffix}</>;
}

/* ── Analog watch — smooth, real-time, neon-glow ──
   Hands are rotated with CSS custom properties + a `transform: rotate(var(--deg))`
   rule (see Home.css), driven every animation frame. Using a CSS var instead of
   setAttribute("transform", ...) avoids any risk of React re-render fighting the
   imperative DOM update or the attribute being stripped on parent re-paints. */
function AnalogWatch() {
  const secRef = useRef(null);
  const minRef = useRef(null);
  const hourRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");

    const applyHandAngles = () => {
      const now = new Date();
      const ms = now.getMilliseconds();
      const s = now.getSeconds() + ms / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      if (secRef.current) secRef.current.style.setProperty("--deg", `${s * 6}deg`);
      if (minRef.current) minRef.current.style.setProperty("--deg", `${m * 6}deg`);
      if (hourRef.current) hourRef.current.style.setProperty("--deg", `${h * 30}deg`);
    };

    const loop = () => {
      applyHandAngles();
      rafRef.current = requestAnimationFrame(loop);
    };

    if (mql.matches) {
      applyHandAngles();
      const id = setInterval(applyHandAngles, 1000);
      return () => clearInterval(id);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="vp-watch">
      <svg viewBox="0 0 120 120" className="vp-watch-svg">
        {/* Four cardinal markers at 12 / 3 / 6 / 9 only — kept minimal to
            match the bare-needle look, no full tick ring or dial. */}
        <circle cx="60" cy="8"   r="2.4" className="vp-watch-marker" />
        <circle cx="112" cy="60" r="2.4" className="vp-watch-marker" />
        <circle cx="60" cy="112" r="2.4" className="vp-watch-marker" />
        <circle cx="8" cy="60"   r="2.4" className="vp-watch-marker" />

        {/* Hour & minute hands: tapered needles — wide where they meet the
            hub, narrowing to a sharp point at the tip that indicates the
            time, with a short blunt counterbalance tail behind the hub.
            This reads as a single directional pointer instead of a
            symmetric double-ended spoke. */}
        <polygon
          ref={hourRef}
          className="vp-watch-hand-hour"
          points="60,64 64,60 60,22 56,60"
        />
        <polygon
          ref={minRef}
          className="vp-watch-hand-min"
          points="60,68 63,60 60,10 57,60"
        />
        <polygon
          ref={secRef}
          className="vp-watch-hand-sec"
          points="60,74 61.4,60 60,14 58.6,60"
        />
        <circle cx="60" cy="60" r="4.5" className="vp-watch-hub" />
      </svg>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="vp-watch-time">{time}</span>;
}

const ICONS = {
  purchase: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 9h14M2 5h14M2 13h8"/><circle cx="14" cy="13" r="3"/><path d="M14 11.5v1.5l1 1"/></svg>,
  sales: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 3h12l-1.5 9H4.5z"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  inventory: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="2" width="14" height="4" rx="1"/><rect x="2" y="8" width="14" height="4" rx="1"/><rect x="2" y="14" width="8" height="2" rx="1"/></svg>,
  retailer: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16a6 6 0 0112 0"/></svg>,
  payment: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><rect x="2" y="5" width="14" height="10" rx="2"/><path d="M2 9h14M6 9v6"/></svg>,
  reports: <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 14l4-5 4 3 4-7"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>,
};

const MODULES = [
  { key: "purchase",  label: "Purchase",  hint: "Stock in · supplier dues",   from: "#7c3aed", to: "#ec4899", path: "/master/purchase" },
  { key: "sales",     label: "Sales",     hint: "FIFO billing · invoices",    from: "#06b6d4", to: "#3b82f6", path: "/master/salesshrt" },
  { key: "inventory", label: "Inventory", hint: "Live stock · expiry",        from: "#a3e635", to: "#16a34a", path: "/master/inventory" },
  { key: "retailer",  label: "Retailers", hint: "Credit · outstanding",       from: "#fb923c", to: "#ef4444", path: "/master/retailer" },
  { key: "payment",   label: "Payments",  hint: "Collect · due tracking",     from: "#facc15", to: "#f97316", path: "/master/payment-collection" },
  { key: "reports",   label: "Reports",   hint: "GSTR-1 · recall trace",      from: "#818cf8", to: "#c084fc", path: "/master/reports" },
];

const FALLBACK_STATS = [
  { key: "collectedToday", label: "Collected today", value: "0", prefix: "₹", color: "#22d3ee" },
  { key: "billsGenerated", label: "Bills generated",  value: "0", prefix: "",  color: "#a3e635" },
  { key: "expiring30d",    label: "Expiring in 30d",  value: "0", prefix: "",  color: "#fb923c" },
  { key: "outstandingDues",label: "Outstanding dues", value: "0", prefix: "₹", color: "#ec4899" },
];

const FALLBACK_CHECKLIST = [
  { label: "Auto FIFO batches",        sub: "Oldest expiry sold first, always automatic", color: "#22d3ee" },
  { label: "Credit limit enforcement", sub: "Blocks a sale the instant a retailer's limit is hit", color: "#fb923c" },
  { label: "Nightly expiry scheduler", sub: "1 AM scan marks expired batches, emails alerts", color: "#a3e635" },
  { label: "GST-ready invoices",       sub: "HSN snapshot on every line, GSTR-1 ready", color: "#818cf8" },
  { label: "Batch recall trace",       sub: "One batch traces to every retailer who received it", color: "#ec4899" },
  { label: "Zero manual outstanding",  sub: "Every balance updates automatically, every action", color: "#facc15" },
];

const STAT_COLOR_BY_KEY = {
  collectedToday: "#22d3ee",
  billsGenerated: "#a3e635",
  expiring30d: "#fb923c",
  outstandingDues: "#ec4899",
};

export default function Home() {
  const navigate = useNavigate();
  const user = (() => { try { return JSON.parse(localStorage.getItem("vmsUser")) || {}; } catch { return {}; } })();
  const name = user?.data?.name || "Vendor";

  const [stats, setStats] = useState(FALLBACK_STATS);
  const [ticker, setTicker] = useState([]);
  const [checklist, setChecklist] = useState(FALLBACK_CHECKLIST);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Vendor/GetUserRoleId`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => { if (d.status === 200) localStorage.setItem("roleId", d.data); })
      .catch(() => {});
  }, []);

  /* ── Live dashboard summary: collections, bills, expiry, dues ── */
  const fetchSummary = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Dashboard/GetHomeSummary`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => {
        if (d?.status === 200 && d.data) {
          const next = FALLBACK_STATS.map(s => ({
            ...s,
            value: d.data[s.key] != null ? String(d.data[s.key]) : s.value,
          }));
          setStats(next);
        }
      })
      .catch(() => {
        /* keep last-known stats on transient failure */
      })
      .finally(() => setLoadingStats(false));
  }, []);

  /* ── Live activity ticker ── */
  const fetchTicker = useCallback(() => {
    apiClient(`${API_BASE_URL}/api/Dashboard/GetActivityFeed`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(r => r.json())
      .then(d => {
        if (d?.status === 200 && Array.isArray(d.data) && d.data.length) {
          setTicker(d.data.map(item => item.message || item));
        }
      })
      .catch(() => {
        /* keep last-known ticker on transient failure */
      });
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTicker();

    // Keep the dashboard live: re-pull every 60s without a full page reload.
    const statsId = setInterval(fetchSummary, 60000);
    const tickerId = setInterval(fetchTicker, 45000);
    return () => {
      clearInterval(statsId);
      clearInterval(tickerId);
    };
  }, [fetchSummary, fetchTicker]);

  const tickerItems = ticker.length ? ticker : [
    "Live activity will appear here once today's first action is logged",
  ];
// Add this constant near the top with MODULES
const QUICK_ACTIONS = [
  {
    key: "billing",
    label: "Start billing",
    sub: "FIFO · invoice now",
    path: "/master/salesshrt",
    color: "#22d3ee",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3h12l-1.5 9H4.5z"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    sub: "Live metrics · trends",
    path: "/master/dashboard",
    color: "#a3e635",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 14l4-5 4 3 4-7"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>,
  },
  {
    key: "onboarding",
    label: "How it works",
    sub: "Flow guide · setup",
    path: "/onboarding",
    color: "#fb923c",
    icon: <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="9" cy="5" r="2.5"/><path d="M4 15a5 5 0 0110 0"/><path d="M9 10v3M7.5 12h3"/></svg>,
  },
];
  return (
    <div className="vp-page">
      <section className="vp-hero">
        <div className="vp-hero-top">
          <div className="vp-eyebrow">
            <span className="vp-eyebrow-dot" /> LIVE
          </div>
          <div className="vp-watch-block">
            <AnalogWatch />
            <LiveClock />
          </div>
        </div>

        <h1 className="vp-greeting">
          Namaste, {name}.<br />Here's your pulse today.
        </h1>

        <div className="vp-pulse-wrap">
          <svg className="vp-pulse-svg" viewBox="0 0 1000 90" preserveAspectRatio="none">
            <path
              className="vp-pulse-path"
              d="M0,45 L120,45 L145,12 L165,78 L185,45 L260,45 L285,28 L305,62 L325,45 L420,45 L445,8 L468,82 L490,45 L600,45 L625,20 L648,70 L670,45 L780,45 L805,15 L828,75 L850,45 L1000,45"
              fill="none"
            />
          </svg>
        </div>

{/* ── Combined stat + quick-action panel ── */}
<div className="vp-stataction-panel">
  <div className="vp-stataction-stats">
    {stats.map((s) => (
      <div key={s.key} className="vp-sa-stat" style={{ "--stat-color": s.color }}>
        <span className="vp-sa-dot" />
        <div className="vp-sa-body">
          <div className="vp-sa-val">
            {loadingStats ? "—" : <CountUp target={s.value} prefix={s.prefix} />}
          </div>
          <div className="vp-sa-lbl">{s.label}</div>
        </div>
      </div>
    ))}
  </div>

  <div className="vp-stataction-actions">
    <div className="vp-sa-actions-label">Quick actions</div>
    {QUICK_ACTIONS.map(a => (
      <div
        key={a.key}
        className="vp-sa-qa"
        style={{ "--qa-color": a.color }}
        onClick={() => navigate(a.path)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && navigate(a.path)}
      >
        <div className="vp-sa-qa-icon">{a.icon}</div>
        <div className="vp-sa-qa-text">
          <div className="vp-sa-qa-title">{a.label}</div>
          <div className="vp-sa-qa-sub">{a.sub}</div>
        </div>
        <div className="vp-sa-qa-arr">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
        </div>
      </div>
    ))}
  </div>
</div>

      </section>

      <div className="vp-ticker">
        <div className="vp-ticker-track">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={i} className="vp-ticker-item">
              <span className="vp-ticker-dot" /> {t}
            </span>
          ))}
        </div>
      </div>

      <section className="vp-section">
        <div className="vp-section-head">
          <h2>Open a module</h2>
        </div>
        <div className="vp-tile-grid">
          {MODULES.map(m => (
            <div
              key={m.key}
              className="vp-tile"
              style={{ "--from": m.from, "--to": m.to }}
              onClick={() => navigate(m.path)}
            >
              <div className="vp-tile-glow" />
              <div className="vp-tile-icon">{ICONS[m.key]}</div>
              <div className="vp-tile-label">{m.label}</div>
              <div className="vp-tile-hint">{m.hint}</div>
              <div className="vp-tile-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="vp-section">
        <div className="vp-section-head">
          <h2>Why it runs itself</h2>
        </div>
        <div className="vp-check-grid">
          {checklist.map((f, i) => (
            <div key={i} className="vp-check-card" style={{ "--check-color": f.color }}>
              <span className="vp-check-glowdot" />
              <div className="vp-check-label">{f.label}</div>
              <div className="vp-check-sub">{f.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="vp-cta">
        <div className="vp-cta-orb" />
        <div className="vp-cta-text">
          <h2>Ready to close today's register?</h2>
          <p>First bill in under 30 minutes. One owner, zero complexity.</p>
        </div>
       <div className="vp-cta-btns">
  <button className="vp-btn-primary" onClick={() => navigate("/master/salesshrt")}>Start billing</button>
  <button className="vp-btn-ghost" onClick={() => navigate("/master/dashboard")}>Dashboard</button>
  <button className="vp-btn-ghost" onClick={() => navigate("/onboarding")}>How it works</button>
</div>
      </section>

    </div>
  );
}