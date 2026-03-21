import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Report/Report.css";

/* ── Canvas background ────────────────────────────────────── */
function ReportCanvas() {
  const cvRef = useRef(null);
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

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(0,200,255,0.018)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.006;

      const bg = ctx.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
      bg.addColorStop(0, "rgba(0,6,20,1)");
      bg.addColorStop(0.6, "rgba(0,3,12,1)");
      bg.addColorStop(1, "rgba(0,0,4,1)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      drawGrid();

      for (const p of particles) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath(); ctx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,210,255,${p.a * tw})`; ctx.fill();
      }

      // Data viz nebula — reddish/amber for analytics feel
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
  }, []);
  return <canvas ref={cvRef} className="rpt-canvas" />;
}

/* ── Report Card ──────────────────────────────────────────── */
const ACCENT_COLORS = ["cyan", "amber", "purple", "green", "pink", "blue"];

function ReportCard({ report, index, onOpen }) {
  const cardRef = useRef(null);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  const handleMove = (e) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `rotateY(${dx * 8}deg) rotateX(${-dy * 6}deg) translateY(-6px)`;
  };
  const handleLeave = () => { if (cardRef.current) cardRef.current.style.transform = ""; };

  // mini chart bars — decorative
  const bars = Array.from({ length: 7 }, (_, i) => Math.random() * 60 + 20);

  return (
    <div
      ref={cardRef}
      className={`rpt-card rpt-card-${accent}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="rpt-card-shell">
        {/* HUD corners */}
        <div className="rpt-c rpt-tl" /><div className="rpt-c rpt-tr" />
        <div className="rpt-c rpt-bl" /><div className="rpt-c rpt-br" />

        {/* Mini bar chart */}
        <div className="rpt-mini-chart">
          {bars.map((h, i) => (
            <div key={i} className="rpt-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>

        <div className="rpt-card-body">
          <div className="rpt-card-index">RPT — {String(index + 1).padStart(2, "0")}</div>
          <h3 className="rpt-card-title">{report.name}</h3>
          <p className="rpt-card-desc">{report.description}</p>
        </div>

        <button className="rpt-open-btn" onClick={() => onOpen(report.name)}>
          <span>Open Report</span>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────── */
export default function ReportsDashboard() {
  const moduleId = 7;
  const apiUrl   = "http://localhost:8080/api/Reports/GetAllReports";
  const accessApi = `http://localhost:8080/api/Access/GetUserModuleAccess/${moduleId}`;

  const [search, setSearch]                   = useState("");
  const [reports, setReports]                 = useState([]);
  const [allowedReportKeys, setAllowedReportKeys] = useState([]);
  const [loaded, setLoaded]                   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(accessApi, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200 && Array.isArray(res.data)) {
          setAllowedReportKeys(res.data.flatMap(p => p.split("/")).map(s => s.toLowerCase()));
        }
      })
      .catch(err => console.error("Access fetch error:", err));
  }, [accessApi]);

  useEffect(() => {
    fetch(apiUrl, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
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
    const match  = name.includes(search.toLowerCase());
    return access && match;
  });

  return (
    <div className="rpt-page">
      <ReportCanvas />

      {/* Orbs */}
      <div className="rpt-orb rpt-orb-a" />
      <div className="rpt-orb rpt-orb-b" />

      <div className="rpt-inner">

        {/* ── Header ───────────────────────────────────────── */}
        <div className="rpt-header">
          <div className="rpt-header-left">
            <div className="rpt-eyebrow">
              <span className="rpt-eyebrow-dot" />
              Analytics & Insights
            </div>
            <h1 className="rpt-title">
              <span className="rpt-title-dim">Business</span> Reports
            </h1>
            <p className="rpt-subtitle">Explore and generate insights from your data</p>
          </div>

          <div className="rpt-header-right">
            <div className="rpt-count-pill">
              <span className="rpt-count-num">{filtered.length}</span>
              <span className="rpt-count-label">Reports Available</span>
            </div>
            <div className="rpt-search-wrap">
              <svg className="rpt-search-icon" width="14" height="14" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
              </svg>
              <input
                className="rpt-search"
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────── */}
        <div className="rpt-divider" />

        {/* ── Grid ─────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="rpt-empty">
            <div className="rpt-empty-icon">
              <svg width="32" height="32" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z"/>
              </svg>
            </div>
            <p>No reports found</p>
            {search && <span>Try a different search term</span>}
          </div>
        ) : (
          <div className={`rpt-grid ${loaded ? "loaded" : ""}`}>
            {filtered.map((report, i) => (
              <ReportCard
                key={report.reportCode}
                report={report}
                index={i}
                onOpen={name => navigate("/master/reports/open", { state: { reportName: name } })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
