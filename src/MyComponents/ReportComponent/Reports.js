import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Report/Report.css";
import { useCanvasThemeKey, isLightTheme } from "../../utils/canvasTheme";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Canvas background ────────────────────────────────────── */
function ReportCanvas() {
  const cvRef = useRef(null);
  const canvasThemeKey = useCanvasThemeKey();

  useEffect(() => {
    const cv = cvRef.current;
    const ctx = cv.getContext("2d");
    let W, H, raf, t = 0;

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 3000,
      r: Math.random() * 1.1 + 0.2,
      a: Math.random() * 0.6 + 0.15,
      tw: Math.random() * 2.5 + 0.8,
      tp: Math.random() * Math.PI * 2,
    }));

    let shooters = [];
    const addS = () => shooters.push({
      x: Math.random() * (W || 1200) * 0.8,
      y: Math.random() * (H || 800) * 0.5,
      vx: Math.random() * 7 + 3,
      vy: Math.random() * 3 + 1,
      len: Math.random() * 110 + 50,
      a: 1,
      hue: Math.random() * 60 + 190,
    });
    const si = setInterval(addS, 2800);

    const resize = () => { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const light = isLightTheme();

    const drawGrid = () => {
      ctx.strokeStyle = light ? "rgba(59,130,246,0.08)" : "rgba(0,200,255,0.018)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.006;

      const bg = ctx.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
      if (light) {
        bg.addColorStop(0, "rgba(244,247,251,1)");
        bg.addColorStop(0.6, "rgba(236,242,252,1)");
        bg.addColorStop(1, "rgba(226,235,248,1)");
      } else {
        bg.addColorStop(0, "rgba(0,6,20,1)");
        bg.addColorStop(0.6, "rgba(0,3,12,1)");
        bg.addColorStop(1, "rgba(0,0,4,1)");
      }
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      drawGrid();

      for (const p of particles) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath(); ctx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,255,${p.a * tw})`; ctx.fill();
      }

      const n1 = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, W * 0.35);
      n1.addColorStop(0, "rgba(255,120,0,0.04)"); n1.addColorStop(1, "transparent");
      ctx.fillStyle = n1; ctx.fillRect(0, 0, W, H);

      const n2 = ctx.createRadialGradient(W * 0.1, H * 0.75, 0, W * 0.1, H * 0.75, W * 0.3);
      n2.addColorStop(0, "rgba(0,160,255,0.04)"); n2.addColorStop(1, "transparent");
      ctx.fillStyle = n2; ctx.fillRect(0, 0, W, H);

      shooters = shooters.filter(s => s.a > 0.01);
      for (const s of shooters) {
        const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        g.addColorStop(0, `hsla(${s.hue},100%,80%,${s.a})`);
        g.addColorStop(1, "transparent");
        ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke(); ctx.restore();
        s.x += s.vx; s.y += s.vy; s.a -= 0.02;
      }

      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => { cancelAnimationFrame(raf); clearInterval(si); window.removeEventListener("resize", resize); };
  }, [canvasThemeKey]);
  return <canvas ref={cvRef} className="rpt-canvas" />;
}

/* ── Color-coding per report, like packaging lot bands ────── */
const ACCENTS = [
  "#ff2ea6", "#00cfff", "#39ff14", "#ff7a00", "#9b5cff", "#ffe600",
  "#00ffe5", "#ff3131", "#ff5e00", "#00ffb7", "#00ff66", "#3a86ff",
  "#ff00ff", "#ffd000", "#7de3ff",
];
const getAccent = (i) => ACCENTS[i % ACCENTS.length];

/* ── Barcode tick row ─────────────────────────────────────── */
function Barcode({ seed, count }) {
  const ticks = Array.from({ length: count }, (_, i) => ((seed * 11 + i * 7) % 3) + 1);
  return (
    <div className="rpt-barcode">
      {ticks.map((w, i) => <span key={i} style={{ width: `${w}px` }} />)}
    </div>
  );
}

/* ── Grid Card — blister cavity ──────────────────────────── */
function ReportCard({ report, index, onOpen }) {
  const accent = getAccent(index);
  return (
    <div
      className="rpt-card"
      style={{ "--accent": accent, animationDelay: `${index * 0.05}s` }}
      onClick={() => onOpen(report.name)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(report.name); }}
    >
      <div className="rpt-card-dome" />
      <div className="rpt-card-body">
        <span className="rpt-card-batch">RPT · {String(index + 1).padStart(2, "0")}</span>
        <h3 className="rpt-card-title">{report.name}</h3>
        <p className="rpt-card-desc">{report.description}</p>
        <Barcode seed={index} count={14} />
      </div>
      <button className="rpt-card-tab" onClick={(e) => { e.stopPropagation(); onOpen(report.name); }}>
        <span>Open Report</span>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

/* ── List Row — manifest / ledger strip ──────────────────── */
function ReportRow({ report, index, onOpen }) {
  const accent = getAccent(index);
  return (
    <div
      className="rpt-row"
      style={{ "--accent": accent, animationDelay: `${index * 0.04}s` }}
      onClick={() => onOpen(report.name)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(report.name); }}
    >
      <div className="rpt-row-perf">
        {Array.from({ length: 4 }).map((_, i) => <span key={i} />)}
      </div>

      <span className="rpt-row-code">{index + 1}</span>

      <div className="rpt-row-info">
        <h3 className="rpt-row-title">{report.name}</h3>
        <p className="rpt-row-desc">{report.description}</p>
      </div>

      <Barcode seed={index} count={16} />

      <button className="rpt-row-stamp" onClick={(e) => { e.stopPropagation(); onOpen(report.name); }}>
        OPEN
      </button>
    </div>
  );
}

/* ── View toggle — Strip / Manifest ──────────────────────── */
function ViewToggle({ view, onChange }) {
  return (
    <div className="rpt-view-toggle">
      <button className={`rpt-toggle-btn ${view === "grid" ? "active" : ""}`} onClick={() => onChange("grid")} title="Strip view">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="1" width="6" height="6" rx="3" />
          <rect x="9" y="1" width="6" height="6" rx="3" />
          <rect x="1" y="9" width="6" height="6" rx="3" />
          <rect x="9" y="9" width="6" height="6" rx="3" />
        </svg>
        <span>Strip</span>
      </button>
      <button className={`rpt-toggle-btn ${view === "list" ? "active" : ""}`} onClick={() => onChange("list")} title="Manifest view">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="2.5" rx="1.25" />
          <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" />
          <rect x="1" y="11.5" width="14" height="2.5" rx="1.25" />
        </svg>
        <span>Manifest</span>
      </button>
      <div className={`rpt-toggle-pill ${view}`} />
    </div>
  );
}

/* ── Hero — vitals monitor panel ─────────────────────────── */
function HeroSection({ count }) {
  return (
    <div className="rpt-hero">
      <div className="rpt-hero-bezel">
        <div className="rpt-hero-led" />
        <div className="rpt-hero-screen">
          <div className="rpt-hero-top">
            <span className="rpt-hero-eyebrow"><span className="rpt-hero-dot" /> Reports Monitor · Live</span>
            <span className="rpt-hero-readout">{String(count).padStart(2, "0")} <small>ACTIVE</small></span>
          </div>
          <h1 className="rpt-hero-title">Business Reports</h1>
          <p className="rpt-hero-sub">Sales · Purchase · Inventory · Finance</p>
          <svg className="rpt-hero-ecg" viewBox="0 0 800 60" preserveAspectRatio="none">
            <path d="M0 30 L120 30 L140 8 L160 52 L180 30 L300 30 L320 14 L340 46 L360 30 L800 30" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </div>
    </div>
  );
}

const roleId = localStorage.getItem("roleId");

/* ── Main ─────────────────────────────────────────────────── */
export default function ReportsDashboard() {
  const moduleId = 7;
  const apiUrl    = `${API_BASE_URL}/api/Reports/GetAllReports`;
  const accessApi = `${API_BASE_URL}/api/Access/GetUserModuleAccess/${moduleId}/${roleId}`;

  const [search, setSearch] = useState("");
  const [reports, setReports] = useState([]);
  const [allowedReportKeys, setAllowedReportKeys] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState(() => localStorage.getItem("rpt-view") || "grid");
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  const handleViewChange = (v) => {
    setView(v);
    localStorage.setItem("rpt-view", v);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    apiClient(accessApi, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && Array.isArray(res.data))
          setAllowedReportKeys(res.data.flatMap(p => p.split("/")).map(s => s.toLowerCase()));
      })
      .catch(err => console.error("Access fetch error:", err));
  }, [accessApi]);

  useEffect(() => {
    apiClient(apiUrl, { method: "GET", headers: { "Content-Type": "application/json" } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(res => {
        if (res.status === 200 && res.data) {
          const dataObj = res.data;
          const list = Array.isArray(dataObj)
            ? dataObj
            : typeof dataObj === "object"
              ? Object.values(dataObj).find(v => Array.isArray(v)) || []
              : [];
          setReports(list.filter(r => !r.disabled));
          setTimeout(() => setLoaded(true), 100);
        }
      })
      .catch(err => console.error("Reports fetch error:", err));
  }, [apiUrl]);

  const filtered = reports.filter(r => {
    const name = r.name.toLowerCase();
    const access = allowedReportKeys.length === 0 || allowedReportKeys.some(k => name.includes(k));
    const match = name.includes(search.toLowerCase());
    return access && match;
  });

  const handleOpen = (name) => navigate("/master/reports/open", { state: { reportName: name } });

  return (
    <div className="rpt-page">
      <ReportCanvas />
      <div className="rpt-orb rpt-orb-a" />
      <div className="rpt-orb rpt-orb-b" />

      <div className="rpt-inner">

        <HeroSection count={filtered.length} />

        <div className={`rpt-stickybar ${scrolled ? "scrolled" : ""}`}>
          <div className="rpt-stickybar-inner">
            <span className="rpt-stickybar-title">Business Reports</span>

            <div className="rpt-search-wrap">
              <svg className="rpt-search-icon" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
              </svg>
              <input
                className="rpt-search"
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="rpt-count-pill">
              <span className="rpt-count-num">{filtered.length}</span>
              <span className="rpt-count-label">Available</span>
            </div>

            <ViewToggle view={view} onChange={handleViewChange} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rpt-empty">
            <div className="rpt-empty-icon">
              <svg width="32" height="32" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
              </svg>
            </div>
            <p>No reports found</p>
            {search && <span>Try a different search term</span>}
          </div>
        ) : view === "grid" ? (
          <div className={`rpt-grid ${loaded ? "loaded" : ""}`}>
            {filtered.map((report, i) => (
              <ReportCard key={report.reportCode} report={report} index={i} onOpen={handleOpen} />
            ))}
          </div>
        ) : (
          <div className={`rpt-list ${loaded ? "loaded" : ""}`}>
            {filtered.map((report, i) => (
              <ReportRow key={report.reportCode} report={report} index={i} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}