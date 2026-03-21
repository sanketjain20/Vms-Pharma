import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/Home.css";

import img1 from "../Images/3741.jpg";
import img2 from "../Images/4698.jpg";
import img3 from "../Images/4862.jpg";
import img4 from "../Images/28439.jpg";
import img5 from "../Images/32881-NYSF7H.jpg";
import img6 from "../Images/60261.jpg";
import img7 from "../Images/2282382.jpg";
import img8 from "../Images/O4WHN50.jpg";
import img9 from "../Images/OQECWY0.jpg";
import img10 from "../Images/8-bits-characters-gaming-assets.jpg";
import img11 from "../Images/enhanced-large-preview.jpg";
import img12 from "../Images/render.jpeg";
import img13 from "../Images/vmsimg.jpg";
import img14 from "../Images/variety-people-multitasking-3d-cartoon-scene.jpg";
import img15 from "../Images/render-preview1.jpg";
import img16 from "../Images/render-preview2.jpg";
import img17 from "../Images/render-preview3.jpg";
import img18 from "../Images/render-preview4.jpg";
import img19 from "../Images/render-preview5.jpg";
import img20 from "../Images/upload-preview6.jpg";
import img21 from "../Images/upload-preview7.jpg";

/* ── Canvas Background (shared with VendorOnboarding) ─────────── */
function CanvasBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    let W, H, animId;
    let t = 0;

    const particles = Array.from({ length: 220 }, () => ({
      x: Math.random() * 2200,
      y: Math.random() * 4000,
      r: Math.random() * 1.3 + 0.2,
      a: Math.random() * 0.75 + 0.2,
      tw: Math.random() * 3 + 1,
      tp: Math.random() * Math.PI * 2,
    }));

    let shooters = [];
    const addShooter = () => {
      shooters.push({
        x: Math.random() * W * 0.75,
        y: Math.random() * H * 0.45,
        vx: Math.random() * 9 + 4,
        vy: Math.random() * 4 + 2,
        len: Math.random() * 140 + 60,
        a: 1,
        color: `hsl(${Math.random() * 70 + 180},100%,80%)`,
      });
    };
    const shootInterval = setInterval(addShooter, 2000);

    const resize = () => {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      const sz = 80;
      for (let x = 0; x < W; x += sz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += sz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    };

    const drawHex = () => {
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 0.5;
      const s = 60, h = s * Math.sqrt(3);
      for (let row = -1; row < H / h + 2; row++) {
        for (let col = -1; col < W / (s * 1.5) + 2; col++) {
          const cx = col * s * 1.5, cy = row * h + (col % 2 === 0 ? 0 : h / 2);
          ctx.beginPath();
          for (let a = 0; a < 6; a++) { const ang = (Math.PI / 180) * (60 * a - 30); ctx.lineTo(cx + s * Math.cos(ang), cy + s * Math.sin(ang)); }
          ctx.closePath(); ctx.stroke();
        }
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
      bg.addColorStop(0, "rgba(0,0,0,1)");
      bg.addColorStop(0.5, "rgba(0,0,0,1)");
      bg.addColorStop(1, "rgba(0,0,0,1)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      drawGrid(); drawHex();

      for (const p of particles) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath(); ctx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${p.a * tw})`; ctx.fill();
      }

      // Nebula
// Nebula (dark version)
const n1 = ctx.createRadialGradient(W * 0.12, H * 0.22, 0, W * 0.12, H * 0.22, W * 0.38);
n1.addColorStop(0, "rgba(60,60,60,0.04)");
n1.addColorStop(1, "transparent");

const n2 = ctx.createRadialGradient(W * 0.87, H * 0.7, 0, W * 0.87, H * 0.7, W * 0.32);
n2.addColorStop(0, "rgba(50,50,50,0.04)");
n2.addColorStop(1, "transparent");

const n3 = ctx.createRadialGradient(W * 0.5, H * 0.9, 0, W * 0.5, H * 0.9, W * 0.28);
n3.addColorStop(0, "rgba(40,40,40,0.03)");
n3.addColorStop(1, "transparent");

      shooters = shooters.filter((s) => s.a > 0.01);
      for (const s of shooters) {
        ctx.save();
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        grad.addColorStop(0, s.color.replace("hsl", "hsla").replace(")", `,${s.a})`));
        grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke(); ctx.restore();
        s.x += s.vx; s.y += s.vy; s.a -= 0.018;
      }

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => { cancelAnimationFrame(animId); clearInterval(shootInterval); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="home-bg-canvas" />;
}

/* ── Live Clock ───────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const d = now.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "2-digit", year: "numeric" });
      const t = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setTime(`${d} · ${t}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return <div className="home-clock">{time}</div>;
}

/* ── Animated Counter ─────────────────────────────────────────── */
function Counter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = Math.ceil(target / 40);
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [target]);
  return <>{val}</>;
}

/* ── Metric Card ──────────────────────────────────────────────── */
function MetricCard({ title, status, statusClass, count, label, accent, onClick }) {
  const cardRef = useRef(null);

  const handleMove = (e) => {
    const el = cardRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `rotateY(${dx * 8}deg) rotateX(${-dy * 6}deg) translateY(-8px)`;
  };
  const handleLeave = () => { if (cardRef.current) cardRef.current.style.transform = ""; };

  return (
    <div className={`mc mc-${accent}`} ref={cardRef} onMouseMove={handleMove} onMouseLeave={handleLeave} onClick={onClick}>
      <div className="mc-shell">
        <div className="mc-corner mc-tl" /><div className="mc-corner mc-tr" />
        <div className="mc-corner mc-bl" /><div className="mc-corner mc-br" />
        <div className="mc-top">
          <span className="mc-title">{title}</span>
          <span className={`mc-badge mc-badge-${statusClass}`}>{status}</span>
        </div>
        <div className="mc-bottom">
          <div className="mc-num"><Counter target={count} /></div>
          <div className="mc-label">{label}</div>
        </div>
        <div className="mc-scan" />
      </div>
    </div>
  );
}

/* ── Image Grid (hero) ────────────────────────────────────────── */
function HeroGrid({ images }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="home-grid">
      {images.map((src, i) => (
        <div
          key={i}
          className={`hg-item ${hovered === i ? "hovered" : ""}`}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
        >
          <img src={src} alt="" className="hg-img" />
          <div className="hg-glow" />
        </div>
      ))}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("vmsUser")) || {};
  const name = user?.data?.name || "Vendor";
  const isLoggedIn = !!user?.data;

  const [counts, setCounts] = useState({ vendors: 0, products: 0, requests: 0, payments: 0 });
  const [heroVisible, setHeroVisible] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 200);
    setTimeout(() => setCardsVisible(true), 700);
    /* fetch("http://localhost:8080/api/Dashboard/GetCounts", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.status === 200) setCounts(d.data); }); */
  }, []);

  const allImages = [img1, img2, img3, img4, img5, img6, img7, img8, img9, img10, img11, img12, img13, img14, img15, img16, img17, img18, img19, img20, img21];
  const heroImages = [...allImages].sort(() => 0.5 - Math.random()).slice(0, 9);

  const metrics = [
    { title: "Quick Sales", status: "Active", statusClass: "cyan", count: counts.vendors, label: "Create Invoice", accent: "cyan", path: "/master/salesshrt" },
    { title: "Products", status: "Available", statusClass: "purple", count: counts.products, label: "Total Products", accent: "purple", path: "/master/product" },
    { title: "Reports", status: "Generated", statusClass: "green", count: counts.requests, label: "Generated Reports", accent: "green", path: "/master/reports" },
    { title: "Dashboard", status: "Due", statusClass: "amber", count: counts.payments, label: "Sales Info", accent: "amber", path: "/master/dashboard" },
  ];

  return (
    <div className="home-wrap">
      <CanvasBackground />

      {/* Floating orbs */}
      <div className="home-orb orb-a" />
      <div className="home-orb orb-b" />
      <div className="home-orb orb-c" />

      <LiveClock />

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className={`home-hero ${heroVisible ? "visible" : ""}`}>
        <div className="hero-left">

          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            Vendor Management System
          </div>

          <h1 className="hero-h1">
            <span className="h1-greet">
              Namaste
              <span className="namaste-svg" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" height="42px" viewBox="0 -960 960 960" width="42px" fill="currentColor">
                  <path d="M631-320v-102l-49-90q-18 2-29.5 15.5T541-465v227l96 158h-70l-86-141v-244q0-35 20-62.5t52-38.5l-66-122q-20-38-16.5-80t32.5-71l60-60 278 324 40 495h-61l-38-472-222-259-14 14q-14 14-17 33.5t6 36.5l156 290v117h-60Zm-361 0v-117l156-290q9-17 6-36.5T415-797l-14-14-222 259-38 472H80l40-495 278-324 60 60q29 29 32.5 71T474-688l-66 122q32 11 52 38.5t20 62.5v244L394-80h-70l96-158v-227q0-18-11.5-31.5T379-512l-49 90v102h-60Z" />
                </svg>
              </span>
              , {name}!
            </span>
            <br />
            <span className="h1-accent">Empower Your Shop.</span>
          </h1>

          <p className="hero-desc">
            Track products, monitor requests, generate reports,<br />
            and take quick actions — all in one place.
          </p>

          <div className="hero-actions">
            <button className="btn-get-started" onClick={() => navigate(isLoggedIn ? "/onboarding" : "/")}>
              <span>Get Started</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="btn-learn" onClick={() => navigate("/master/dashboard")}>
              View Dashboard
            </button>
          </div>

          {/* mini stats strip */}
          <div className="hero-stats">
            {[["Products", "Managed"], ["Invoices", "Automated"], ["Reports", "Instant"]].map(([a, b], i) => (
              <div className="hstat" key={i}>
                <div className="hstat-label">{a}</div>
                <div className="hstat-sub">{b}</div>
              </div>
            ))}
          </div>
        </div>

        <HeroGrid images={heroImages} />
      </section>

      {/* ── METRICS ──────────────────────────────────────────── */}
      <section className={`home-metrics ${cardsVisible ? "visible" : ""}`}>
        <div className="metrics-label">
          <span className="ml-line" />
          <span className="ml-text">Live Overview</span>
          <span className="ml-line" />
        </div>
        <div className="metrics-grid">
          {metrics.map((m, i) => (
            <MetricCard key={i} {...m} onClick={() => navigate(m.path)} />
          ))}
        </div>
      </section>
    </div>
  );
}
