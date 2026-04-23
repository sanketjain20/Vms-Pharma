import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";

/* ── Live Clock ── */
function LiveClock() {
  const [time, setTime] = React.useState("");
  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="hw-clock">{time}</span>;
}

/* ── Module icons ── */
const ICONS = {
  purchase: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 9h14M2 5h14M2 13h8"/><circle cx="14" cy="13" r="3"/><path d="M14 11.5v1.5l1 1"/></svg>,
  sales: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M3 3h12l-1.5 9H4.5z"/><circle cx="7" cy="16" r="1" fill="currentColor"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
  inventory: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="2" y="2" width="14" height="4" rx="1"/><rect x="2" y="8" width="14" height="4" rx="1"/><rect x="2" y="14" width="8" height="2" rx="1"/></svg>,
  retailer: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="6" r="3"/><path d="M3 16a6 6 0 0112 0"/></svg>,
  payment: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><rect x="2" y="5" width="14" height="10" rx="2"/><path d="M2 9h14M6 9v6"/></svg>,
  reports: <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M2 14l4-5 4 3 4-7"/><circle cx="14" cy="5" r="1" fill="currentColor"/></svg>,
};

export default function Home() {
  const navigate   = useNavigate();
  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const user       = (() => { try { return JSON.parse(localStorage.getItem("vmsUser")) || {}; } catch { return {}; } })();
  const name       = user?.data?.name || "Vendor";
  const isLoggedIn = !!user?.data;

  /* ── 3D Canvas background ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const orbs = Array.from({ length: 5 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 150 + Math.random() * 180,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      hue: [215, 230, 245, 200, 260][i],
      alpha: 0.016 + Math.random() * 0.018,
    }));

    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 0.5 + Math.random() * 0.9,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      alpha: 0.1 + Math.random() * 0.2,
    }));

    let tick = 0;
    const draw = () => {
      tick++;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);

      /* perspective grid */
      const hor = H * 0.38, vanX = W / 2, gc = 10;
      const spd = (tick * 0.14) % (H / gc);
      ctx.save(); ctx.globalAlpha = 0.032; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 0.5;
      for (let i = 0; i <= gc; i++) {
        const y = hor + spd + (i * (H - hor)) / gc;
        if (y > H) continue;
        const sp = ((y - hor) / (H - hor)) * W * 1.5;
        ctx.beginPath(); ctx.moveTo(vanX - sp / 2, y); ctx.lineTo(vanX + sp / 2, y); ctx.stroke();
      }
      for (let i = 0; i <= 16; i++) {
        const t = i / 16, bx = vanX - W * 0.75 + t * W * 1.5;
        ctx.beginPath(); ctx.moveTo(vanX, hor); ctx.lineTo(bx, H + 10); ctx.stroke();
      }
      ctx.restore();

      /* orbs */
      orbs.forEach(o => {
        o.x += o.vx; o.y += o.vy;
        if (o.x < -o.r) o.x = W + o.r; if (o.x > W + o.r) o.x = -o.r;
        if (o.y < -o.r) o.y = H + o.r; if (o.y > H + o.r) o.y = -o.r;
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, `hsla(${o.hue},70%,55%,${o.alpha})`);
        g.addColorStop(1, "transparent");
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
      });

      /* particles + connections */
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96,165,250,${p.alpha})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 90) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${(1 - d / 90) * 0.07})`; ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }

      /* vignette */
      const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.08, W / 2, H / 2, H * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(rafRef.current); };
  }, []);

  const modules = [
    { key: "purchase",  label: "Purchase",   hint: "Stock in · batches · supplier dues", color: "#06b6d4", path: "/master/purchase"  },
    { key: "sales",     label: "Sales",      hint: "Bill · FIFO batch · credit invoice",  color: "#3b82f6", path: "/master/salesshrt" },
    { key: "inventory", label: "Inventory",  hint: "Live stock · low-stock alerts",       color: "#8b5cf6", path: "/master/inventory" },
    { key: "retailer",  label: "Retailers",  hint: "Customers · credit · outstanding",    color: "#f59e0b", path: "/master/retailer"  },
    { key: "payment",   label: "Payments",   hint: "Collect · reverse · due tracking",   color: "#10b981", path: "/master/payment-collection"   },
    { key: "reports",   label: "Reports",    hint: "GSTR-1 · expiry · recall trace",     color: "#6366f1", path: "/master/reports"   },
  ];

  const features = [
    { label: "Auto FIFO batches",       sub: "Oldest expiry sold first — always automatic" },
    { label: "Credit limit enforcement", sub: "System blocks sale if retailer limit reached" },
    { label: "Nightly expiry scheduler", sub: "1 AM marks expired batches, sends email alerts" },
    { label: "GST-ready invoices",       sub: "HSN snapshot on every line — GSTR-1 ready" },
    { label: "Batch recall trace",       sub: "One batch → every retailer who received it" },
    { label: "Zero manual outstanding",  sub: "All balances update automatically on every action" },
  ];

  return (
    <div className="hw-root">
      <canvas ref={canvasRef} className="hw-canvas" />

      {/* ── NAV ── */}
      <nav className="hw-nav">
        <div className="hw-nav-logo">
          <span className="hw-logo-dot" />
          VMS<span className="hw-logo-acc">Pro</span>
        </div>
        <div className="hw-nav-links">
          {[
            { label: "Dashboard", path: "/master/dashboard" },
            { label: "Sales",     path: "/master/salesshrt" },
            { label: "Purchase",  path: "/master/purchase"  },
            { label: "Inventory", path: "/master/inventory" },
            { label: "Reports",   path: "/master/reports"   },
          ].map(l => (
            <button key={l.label} className="hw-nav-link" onClick={() => navigate(l.path)}>
              {l.label}
            </button>
          ))}
        </div>
        <div className="hw-nav-right">
          <LiveClock />
          <button className="hw-nav-cta" onClick={() => navigate("/master/dashboard")}>
            Dashboard →
          </button>
        </div>
      </nav>

      <main className="hw-main">

        {/* ── HERO ── */}
        <section className="hw-hero">
          <div className="hw-hero-eyebrow">
            <span className="hw-eyebrow-dot" />
            Medical Wholesale ERP
          </div>
          <h1 className="hw-h1">
            Run your pharmacy<br />
            wholesale <span className="hw-h1-grad">effortlessly</span>
          </h1>
          <p className="hw-hero-sub">
            Namaste, <strong>{name}</strong>. One system for purchase, sales, batches,
            expiry, payments and GST — built for Indian medical wholesale shops.
          </p>
          <div className="hw-hero-btns">
            <button className="hw-btn-primary" onClick={() => navigate(isLoggedIn ? "/master/salesshrt" : "/")}>
              Start billing today
            </button>
            <button className="hw-btn-ghost" onClick={() => navigate("/master/dashboard")}>
              View dashboard
            </button>
          </div>
        </section>

        {/* ── STATS STRIP ── */}
        <div className="hw-stats">
          {[
            { val: "Auto",  unit: "",   label: "Batch FIFO selection"  },
            { val: "1",     unit: " AM", label: "Nightly expiry scan"  },
            { val: "Zero",  unit: "",   label: "Manual outstanding"    },
            { val: "GSTR-1", unit: "",  label: "Invoice-ready GST"     },
          ].map(s => (
            <div key={s.label} className="hw-stat">
              <div className="hw-stat-val">{s.val}<span className="hw-stat-unit">{s.unit}</span></div>
              <div className="hw-stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── MODULES ── */}
        <section className="hw-section">
          <div className="hw-sec-label">Quick access</div>
          <h2 className="hw-sec-title">All modules</h2>
          <div className="hw-modules-grid">
            {modules.map(m => (
              <div key={m.key} className="hw-mod-card" onClick={() => navigate(m.path)}
                style={{ "--mod-color": m.color }}>
                <div className="hw-mod-icon" style={{ background: `${m.color}18`, border: `1px solid ${m.color}30` }}>
                  <span style={{ color: m.color }}>{ICONS[m.key]}</span>
                </div>
                <div className="hw-mod-body">
                  <div className="hw-mod-name">{m.label}</div>
                  <div className="hw-mod-hint">{m.hint}</div>
                </div>
                <svg className="hw-mod-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                  <path d="M3 7h8M7 3l4 4-4 4" />
                </svg>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="hw-section">
          <div className="hw-sec-label">Core capabilities</div>
          <h2 className="hw-sec-title">Built for pharma wholesale</h2>
          <div className="hw-feat-grid">
            {features.map((f, i) => (
              <div key={i} className="hw-feat-card">
                <div className="hw-feat-check">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M2 5l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <div className="hw-feat-name">{f.label}</div>
                  <div className="hw-feat-sub">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── WORKFLOW ── */}
        <section className="hw-section">
          <div className="hw-sec-label">Daily workflow</div>
          <h2 className="hw-sec-title">Your day in 5 steps</h2>
          <div className="hw-flow">
            {[
              { n: "01", title: "Check alerts",    desc: "Expiry · low stock · overdue dues" },
              { n: "02", title: "Enter purchase",   desc: "Stock in → batches auto-created"   },
              { n: "03", title: "Bill retailer",    desc: "FIFO batch → invoice in seconds"   },
              { n: "04", title: "Collect payment",  desc: "Cash/UPI → outstanding drops"      },
              { n: "05", title: "System runs",      desc: "1 AM scheduler → expiry emails"   },
            ].map((s, i) => (
              <div key={i} className="hw-flow-step">
                <div className="hw-flow-num">{s.n}</div>
                <div className="hw-flow-name">{s.title}</div>
                <div className="hw-flow-desc">{s.desc}</div>
                {i < 4 && <div className="hw-flow-line" />}
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="hw-cta">
          <div className="hw-cta-glow" />
          <div className="hw-cta-text">
            <h2 className="hw-cta-title">Ready to modernize your shop?</h2>
            <p className="hw-cta-sub">First bill in under 30 minutes. One owner, zero complexity.</p>
          </div>
          <div className="hw-cta-btns">
            <button className="hw-btn-primary" onClick={() => navigate(isLoggedIn ? "/onboarding" : "/")}>
              Launch system
            </button>
            <button className="hw-btn-ghost" onClick={() => navigate("/master/dashboard")}>
              View dashboard
            </button>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="hw-footer">
          <span className="hw-footer-logo">VMS<span style={{ color: "#3b82f6" }}>Pro</span></span>
          <span className="hw-footer-note">Medical Wholesale Management System · v2.0</span>
        </footer>

      </main>
    </div>
  );
}
