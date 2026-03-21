import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/VendorOnboarding.css";

const steps = [
  {
    title: "Product Type",
    desc: "Create categories to structure your products efficiently.",
    icon: "📦",
    subs: ["Add Category", "Edit Type", "Enable / Disable"],
    color: "c0",
  },
  {
    title: "Products",
    desc: "Add products under types with pricing and units.",
    icon: "🛒",
    subs: ["Assign Type", "Set Price", "Unit & Tax"],
    color: "c1",
  },
  {
    title: "Product Inventory",
    desc: "Control stock levels and avoid overselling in real-time.",
    icon: "📊",
    subs: ["Add Stock", "Reduce Stock", "Live Availability"],
    color: "c2",
  },
  {
    title: "Sales & Invoice",
    desc: "Create sales and generate invoices automatically.",
    icon: "🧾",
    subs: ["Create Sale", "Download PDF", "Print Invoice"],
    color: "c3",
  },
  {
    title: "Reports",
    desc: "Analyze sales and payments with powerful filters.",
    icon: "📈",
    subs: ["Sales Report", "Payment Report", "Export & Filters"],
    color: "c4",
  },
];

// ── Canvas background ──────────────────────────────────────────────────────────
function CanvasBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    let W, H, animId;
    let t = 0;

    // Stars
    const particles = Array.from({ length: 200 }, () => ({
      x: Math.random() * 2000,
      y: Math.random() * 4000,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random() * 0.8 + 0.2,
      tw: Math.random() * 3 + 1,
      tp: Math.random() * Math.PI * 2,
    }));

    // Shooting stars
    let shooters = [];
    const addShooter = () => {
      shooters.push({
        x: Math.random() * W * 0.7,
        y: Math.random() * H * 0.4,
        vx: Math.random() * 9 + 4,
        vy: Math.random() * 4 + 2,
        len: Math.random() * 130 + 60,
        a: 1,
        color: `hsl(${Math.random() * 60 + 180},100%,80%)`,
      });
    };
    const shootInterval = setInterval(addShooter, 2200);

    const resize = () => {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drawGrid = () => {
      ctx.strokeStyle = "rgba(0,200,255,0.025)";
      ctx.lineWidth = 1;
      const sz = 80;
      for (let x = 0; x < W; x += sz) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += sz) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    };

    const drawHex = () => {
      ctx.strokeStyle = "rgba(0,200,255,0.015)";
      ctx.lineWidth = 0.5;
      const s = 60, h = s * Math.sqrt(3);
      for (let row = -1; row < H / h + 2; row++) {
        for (let col = -1; col < W / (s * 1.5) + 2; col++) {
          const cx = col * s * 1.5;
          const cy = row * h + (col % 2 === 0 ? 0 : h / 2);
          ctx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (Math.PI / 180) * (60 * a - 30);
            ctx.lineTo(cx + s * Math.cos(ang), cy + s * Math.sin(ang));
          }
          ctx.closePath(); ctx.stroke();
        }
      }
    };

    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      // Deep space gradient
      const bg = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.5, H * 0.5, Math.max(W, H));
      bg.addColorStop(0, "rgba(0,10,30,1)");
      bg.addColorStop(0.5, "rgba(1,5,18,1)");
      bg.addColorStop(1, "rgba(0,0,5,1)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      drawGrid();
      drawHex();

      // Twinkling stars
      for (const p of particles) {
        const tw = 0.5 + 0.5 * Math.sin(t * p.tw + p.tp);
        ctx.beginPath();
        ctx.arc(p.x % W, p.y % H, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${p.a * tw})`;
        ctx.fill();
      }

      // Nebula clouds
      const neb = ctx.createRadialGradient(W * 0.15, H * 0.25, 0, W * 0.15, H * 0.25, W * 0.35);
      neb.addColorStop(0, "rgba(0, 0, 0, 0.04)"); neb.addColorStop(1, "transparent");
      ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);

      const neb2 = ctx.createRadialGradient(W * 0.85, H * 0.7, 0, W * 0.85, H * 0.7, W * 0.3);
      neb2.addColorStop(0, "rgba(0, 0, 0, 0.04)"); neb2.addColorStop(1, "transparent");
      ctx.fillStyle = neb2; ctx.fillRect(0, 0, W, H);

      // Shooting stars
      shooters = shooters.filter((s) => s.a > 0.01);
      for (const s of shooters) {
        ctx.save();
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        const col = s.color.replace("hsl", "hsla").replace(")", `,${s.a})`);
        grad.addColorStop(0, col); grad.addColorStop(1, "transparent");
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len / 10), s.y - s.vy * (s.len / 10));
        ctx.stroke(); ctx.restore();
        s.x += s.vx; s.y += s.vy; s.a -= 0.018;
      }

      animId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(shootInterval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="bg-canvas" />;
}

// ── Live Clock ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const d = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
      const t = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      setTime(`${d} · ${t}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <div className="live-clock">{time}</div>;
}

// ── Card ───────────────────────────────────────────────────────────────────────
function StepCard({ step, index, colorClass }) {
  const cardRef = useRef(null);
  const shellRef = useRef(null);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    const shell = shellRef.current;
    if (!card || !shell) return;
    const r = card.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    card.style.transform = `rotateY(${dx * 10}deg) rotateX(${-dy * 7}deg) translateZ(10px)`;
    shell.style.boxShadow = `${-dx * 20}px ${-dy * 15}px 60px rgba(0,0,0,0.8), 0 0 40px rgba(0,220,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)`;
  };

  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = "";
    if (shellRef.current) shellRef.current.style.boxShadow = "";
  };

  return (
    <div
      className={`vms-card ${colorClass}`}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="card-shell" ref={shellRef}>
        <div className="corner corner-tl" />
        <div className="corner corner-tr" />
        <div className="corner corner-bl" />
        <div className="corner corner-br" />
        <div className="card-top">
          <div className="ico-wrap">{step.icon}</div>
          <div className="card-text">
            <div className="snum">STEP — {String(index + 1).padStart(2, "0")}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        </div>
        <div className="tags">
          {step.subs.map((s, i) => (
            <span key={i} className="tag">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VendorOnboardingFlow() {
  const [visible, setVisible] = useState(0);
  const [showEnd, setShowEnd] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (visible < steps.length) {
      const t = setTimeout(() => setVisible((v) => v + 1), 600);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => setShowEnd(true), 400);
      return () => clearTimeout(t);
    }
  }, [visible]);

  return (
    <div className="vms-page">
      <CanvasBackground />

      {/* Floating orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />

      <LiveClock />

      <div className="vms-inner">
        {/* Header */}
        <header className="vms-header">
          <h1 className="hdr-title">
            <span className="g1">Vendor Management</span>
            <br />
            <span className="g2">System Flow</span>
          </h1>

          <div className="hdr-eyebrow">◆ System Architecture ◆</div>

          <p className="hdr-sub">
            End-to-end business operations · Real-time · Automated
          </p>

          <div className="hdr-line" />
        </header>

        {/* Timeline */}
<div className="vms-timeline">

  <div className="tl-spine">
    <div className="spine-inner"/>
    <div className="spine-glow"/>
  </div>

  {steps.map((step, i) => (
    <div
      key={i}
      className={`vms-step ${step.color} ${i < visible ? "revealed" : ""} ${i % 2 === 0 ? "left-side" : "right-side"}`}
    >

      {i % 2 === 0 ? (
        <>
          <div className="half">
            <StepCard step={step} index={i} colorClass={step.color}/>
          </div>

          <div className="node-area">
            <div className="conn"/>
            <div className="nd"/>
          </div>

          <div className="ghost"/>
        </>
      ) : (
        <>
          <div className="ghost"/>

          <div className="node-area">
            <div className="conn"/>
            <div className="nd"/>
          </div>

          <div className="half">
            <StepCard step={step} index={i} colorClass={step.color}/>
          </div>
        </>
      )}

    </div>
  ))}

</div>

        {/* End CTA */}
        {showEnd && (
          <div className="vms-end">
            <div className="end-spine" />
            <div className="end-ring">✦</div>
            <button className="btn-dash" onClick={() => navigate("/home")}>
              GO TO HOME
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
