import React, { useState, useEffect, useRef } from "react";
import "../Styles/VendorOnboarding.css";

/* ════════════════════════════════════════════════════════════
   PHASES + STEPS — 4 phases, 12 steps total
════════════════════════════════════════════════════════════ */
const PHASES = [
  { id: "setup",       label: "One-time Setup",    color: "#3b82f6", icon: "🏗️" },
  { id: "stock",       label: "Stock Management",  color: "#10b981", icon: "📦" },
  { id: "billing",     label: "Billing & Sales",   color: "#f59e0b", icon: "🧾" },
  { id: "insights",    label: "Insights",          color: "#8b5cf6", icon: "📊" },
];

const STEPS = [
  /* ── PHASE 1: One-time Setup ── */
  {
    id: 1, phase: "setup",
    icon: "🏭", label: "Manufacturer",
    color: "#3b82f6", glow: "#3b82f620",
    title: "Register Manufacturers",
    subtitle: "Who makes the medicine",
    description: "Before adding any product, register the companies that manufacture your medicines — Cipla, Sun Pharma, Abbott, Mankind etc. Manufacturers link to products and appear on invoices.",
    bullets: [
      "Go to Masters → Manufacturer → Add Manufacturer",
      "Enter company name, GST number, drug license number",
      "Add contact person and phone for easy reference",
      "Manufacturers appear as a dropdown when adding products",
    ],
    tip: "Add your top 10 manufacturers first — you can add more anytime as new products arrive.",
    route: "/master/manufacturer",
  },
  {
    id: 2, phase: "setup",
    icon: "🏪", label: "Supplier",
    color: "#3b82f6", glow: "#3b82f620",
    title: "Add Suppliers",
    subtitle: "Who you buy stock from",
    description: "Suppliers are the distributors and stockists you purchase medicines from. Each purchase order links to a supplier. Credit purchases automatically update supplier outstanding balance.",
    bullets: [
      "Go to Masters → Supplier → Add Supplier",
      "Enter shop name, GST number, drug license, contact",
      "Outstanding balance starts at ₹0 and updates automatically",
      "System blocks you from recording payment beyond outstanding",
    ],
    tip: "Add all your regular distributors before your first purchase so billing flows without interruption.",
    route: "/master/supplier",
  },
  {
    id: 3, phase: "setup",
    icon: "🏷️", label: "Product Type",
    color: "#3b82f6", glow: "#3b82f620",
    title: "Define Product Types",
    subtitle: "Lay the Foundation",
    description: "Product Types are categories for your medicine catalogue — Tablet, Syrup, Injection, Capsule, Drops. Products must belong to a type. Use them to filter inventory and reports.",
    bullets: [
      "Go to Masters → Product Type → Add Type",
      "Add: Tablet, Syrup, Injection, Capsule, Drops, Cream etc.",
      "Keep it broad — 6 to 10 types is ideal for pharma wholesale",
      "Product types appear as filters in sales and inventory views",
    ],
    tip: "Keep types broad (Tablet, Syrup, Injection). Specific formulations live at the Product level.",
    route: "/master/producttype",
  },
  {
    id: 4, phase: "setup",
    icon: "💊", label: "Product",
    color: "#3b82f6", glow: "#3b82f620",
    title: "Build Your Catalogue",
    subtitle: "Add Every Medicine You Stock",
    description: "Create your full medicine catalogue — each product links to a manufacturer and product type. Add HSN code, schedule type (OTC/H/H1), pack size and unit. No stock here yet — stock comes from Purchase.",
    bullets: [
      "Go to Masters → Product → Add Product",
      "Select manufacturer and product type from dropdowns",
      "Add generic name, HSN code, schedule type (OTC / H / H1)",
      "Set pack size (e.g. 10 tablets per strip) and pack unit",
    ],
    tip: "Products have NO stock until you create a Purchase. The catalogue is just the item master.",
    route: "/master/product",
  },
  {
    id: 5, phase: "setup",
    icon: "🛒", label: "Retailer",
    color: "#3b82f6", glow: "#3b82f620",
    title: "Add Your Retailers",
    subtitle: "Your Customers",
    description: "Retailers are the medical shops and pharmacies you sell to. Each sales invoice links to a retailer. Set credit limits — system will block credit sales if the limit is reached. Outstanding updates automatically.",
    bullets: [
      "Go to Masters → Retailer → Add Retailer",
      "Enter shop name, owner name, drug license (required for H medicines)",
      "Set credit limit — enter 0 for unlimited credit",
      "Outstanding balance tracks automatically through sales and payments",
    ],
    tip: "Drug license number is mandatory for selling Schedule H medicines. Add it now to avoid billing blocks later.",
    route: "/master/retailer",
  },

  /* ── PHASE 2: Stock Management ── */
  {
    id: 6, phase: "stock",
    icon: "📥", label: "Purchase",
    color: "#10b981", glow: "#10b98120",
    title: "Record Stock Purchases",
    subtitle: "Stock In From Supplier",
    description: "Every time a supplier delivers stock, create a Purchase entry. This is the heart of batch tracking — each purchase line creates a batch with expiry date. Inventory, supplier outstanding, and batch FIFO all update automatically in one click.",
    bullets: [
      "Go to Billing → Purchase → Add Purchase",
      "Select supplier, enter their invoice number and date",
      "Add each medicine: product → batch no → expiry → qty → cost → MRP",
      "Set payment: PAID now / CREDIT (30-day) / PARTIAL",
    ],
    tip: "The batch number and expiry date you enter here will appear on every sales invoice — always enter them exactly as printed on the box.",
    route: "/master/purchase",
  },
  {
    id: 7, phase: "stock",
    icon: "🗄️", label: "Inventory",
    color: "#10b981", glow: "#10b98120",
    title: "Monitor Inventory",
    subtitle: "Live Stock at a Glance",
    description: "Inventory is fully automatic — it updates every time you purchase or sell. Your job is to set reorder levels per product so the system can alert you before you run out. View stock per product, per batch, expiry status.",
    bullets: [
      "Go to Inventory → view current stock for all products",
      "Set reorder level for each product (triggers low stock alert)",
      "System sends email alert + dashboard notification when below reorder",
      "View batch-wise stock: quantity, expiry, FIFO order",
    ],
    tip: "Set reorder levels slightly above your minimum. If you run out in 3 days, set reorder at 7 days of stock.",
    route: "/master/inventory",
  },

  /* ── PHASE 3: Billing & Sales ── */
  {
    id: 8, phase: "billing",
    icon: "🧾", label: "Sales",
    color: "#f59e0b", glow: "#f59e0b20",
    title: "Bill Retailers",
    subtitle: "Daily Invoicing",
    description: "Create sales invoices for retailers. The system auto-selects the oldest expiry batch first (FIFO) — you don't need to think about which batch to pick. Credit limit is checked before every credit invoice. Batch number and expiry snapshot to the invoice permanently.",
    bullets: [
      "Go to Billing → Sales → Add Sales (or Quick Sale for fast billing)",
      "Select retailer — credit status shown instantly",
      "Add products + quantity — FIFO batch auto-selected",
      "Set payment: PAID / CREDIT / PARTIAL — due date for credit",
    ],
    tip: "Use Quick Sale for walk-in cash customers — it's faster. Use Add Sales when you need retailer tracking and credit.",
    route: "/master/salesshrt",
  },
  {
    id: 9, phase: "billing",
    icon: "💳", label: "Payment",
    color: "#f59e0b", glow: "#f59e0b20",
    title: "Collect Retailer Payments",
    subtitle: "Settle Outstanding Dues",
    description: "When a retailer pays against their outstanding dues, record it here. You can link payment to a specific invoice or make a general payment against their outstanding. Reversing a payment restores all balances automatically.",
    bullets: [
      "Go to Billing → Payment Collection → Collect Payment",
      "Select retailer — only retailers with outstanding are shown",
      "Optionally link to a specific invoice for precise tracking",
      "Choose mode: Cash, UPI (with reference), Cheque, Card",
    ],
    tip: "Always enter the UPI transaction ID or cheque number — it becomes your audit trail if a dispute arises.",
    route: "/master/payment",
  },
  {
    id: 10, phase: "billing",
    icon: "🏦", label: "Supplier Pay",
    color: "#f59e0b", glow: "#f59e0b20",
    title: "Pay Your Suppliers",
    subtitle: "Settle Purchase Dues",
    description: "When you pay a supplier against their credit purchases, record it here. You can link to a specific purchase invoice or make a general settlement. Supplier outstanding drops instantly. Reversing a payment fully restores balances.",
    bullets: [
      "Go to Billing → Supplier Payments → Pay Supplier",
      "Select supplier — only suppliers you owe money to are shown",
      "Optionally link to a specific purchase invoice",
      "Support for NEFT, RTGS, UPI, Cheque, Bank Transfer, Cash",
    ],
    tip: "For NEFT/RTGS always save the UTR number — you'll need it for reconciliation with your bank statement.",
    route: "/master/supplierpayment",
  },

  /* ── PHASE 4: Insights ── */
  {
    id: 11, phase: "insights",
    icon: "📊", label: "Reports",
    color: "#8b5cf6", glow: "#8b5cf620",
    title: "Run Business Reports",
    subtitle: "Know Your Numbers",
    description: "All reports generate automatically from your existing data — no manual entry. Key pharma reports: expiry alert (batches expiring in 30 days), batch recall trace (which retailers got a specific batch), GSTR-1 ready invoice summary.",
    bullets: [
      "Expiry Report — batches expiring in 7 / 30 / 90 days",
      "Outstanding Report — retailer-wise and supplier-wise dues",
      "Batch Recall Trace — input any batch → see all retailers who got it",
      "GSTR-1 — HSN-wise GST summary, ready to file directly",
    ],
    tip: "Run the Expiry Report every Monday morning. Batches expiring in 30 days should be pushed to retailers or returned to supplier immediately.",
    route: "/master/reports",
  },
  {
    id: 12, phase: "insights",
    icon: "🚀", label: "Dashboard",
    color: "#8b5cf6", glow: "#8b5cf620",
    title: "Your Command Centre",
    subtitle: "Everything at a Glance",
    description: "The Dashboard shows live KPIs — today's sales vs purchases, retailer outstanding, supplier dues, expiry alerts, low stock count, top products, and P&L. Sections auto-open if there are urgent alerts. Charts update on every page load.",
    bullets: [
      "Sales vs Purchase trend for last 7 days — see cash flow",
      "Outstanding section opens automatically if overdue invoices exist",
      "Inventory alerts open automatically if batches expiring in 7 days",
      "Switch chart types: Bar, Line, Pie per chart",
    ],
    tip: "Check the Dashboard every morning before opening the shop. The alert strip at the top tells you what needs action today.",
    route: "/master/dashboard",
  },
];

/* ════════════════════════════════════════════════════════════
   ANIMATED HERO SVGs
════════════════════════════════════════════════════════════ */
const SpiderHero = () => (
  <svg viewBox="0 0 200 420" className="vo-hero-svg" xmlns="http://www.w3.org/2000/svg">
    <g opacity=".3">
      <line x1="100" y1="0" x2="0"   y2="100" stroke="#3b82f6" strokeWidth=".7" />
      <line x1="100" y1="0" x2="50"  y2="150" stroke="#3b82f6" strokeWidth=".7" />
      <line x1="100" y1="0" x2="100" y2="160" stroke="#3b82f6" strokeWidth=".7" />
      <line x1="100" y1="0" x2="150" y2="150" stroke="#3b82f6" strokeWidth=".7" />
      <line x1="100" y1="0" x2="200" y2="100" stroke="#3b82f6" strokeWidth=".7" />
      <path d="M0,100 Q50,80 100,100 Q150,120 200,100"  stroke="#3b82f6" strokeWidth=".7" fill="none"/>
      <path d="M25,150 Q62,130 100,150 Q138,170 175,150" stroke="#3b82f6" strokeWidth=".7" fill="none"/>
      <path d="M50,200 Q75,185 100,200 Q125,215 150,200" stroke="#3b82f6" strokeWidth=".7" fill="none"/>
    </g>
    <ellipse cx="100" cy="205" rx="50" ry="65" fill="#3b82f6" opacity=".07" className="vo-aura-pulse"/>
    <ellipse cx="100" cy="205" rx="36" ry="52" fill="#1d40af" className="vo-body-glow"/>
    <g transform="translate(100,200)">
      <path d="M0,-13 L-4,-4 L-13,-6 L-8,2 L-13,9 L-4,7 L0,17 L4,7 L13,9 L8,2 L13,-6 L4,-4 Z" fill="#000" opacity=".5"/>
    </g>
    <rect x="66" y="244" width="68" height="7" rx="3.5" fill="#000" opacity=".3"/>
    <ellipse cx="100" cy="142" rx="28" ry="30" fill="#1d40af" className="vo-head-pulse"/>
    <ellipse cx="90"  cy="137" rx="11" ry="9" fill="white" opacity=".92" className="vo-eye-glow"/>
    <ellipse cx="110" cy="137" rx="11" ry="9" fill="white" opacity=".92" className="vo-eye-glow"/>
    <ellipse cx="90"  cy="137" rx="6"  ry="5.5" fill="#3b82f6"/>
    <ellipse cx="110" cy="137" rx="6"  ry="5.5" fill="#3b82f6"/>
    <path d="M64,212 Q32,172 12,142" stroke="#1d40af" strokeWidth="17" strokeLinecap="round" fill="none" className="vo-arm-swing"/>
    <path d="M64,212 Q32,172 12,142" stroke="#3b82f6"  strokeWidth="9"  strokeLinecap="round" fill="none" opacity=".5"/>
    <path d="M12,142 Q-15,95 -25,30"  stroke="#3b82f6"  strokeWidth="1.5" fill="none" strokeDasharray="5,4" className="vo-web-shoot" opacity=".85"/>
    <path d="M136,212 Q158,235 172,255" stroke="#1d40af" strokeWidth="17" strokeLinecap="round" fill="none"/>
    <path d="M84,250 Q72,315 68,375"   stroke="#1d40af" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-float"/>
    <path d="M116,250 Q128,315 132,375" stroke="#1d40af" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-float-r"/>
  </svg>
);

const CosmicHero = () => (
  <svg viewBox="0 0 200 420" className="vo-hero-svg" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="210" rx="90" ry="108" fill="none" stroke="#8b5cf6" strokeWidth="1" opacity=".14" className="vo-ring-pulse-1"/>
    <ellipse cx="100" cy="210" rx="72" ry="86"  fill="none" stroke="#a78bfa" strokeWidth="1" opacity=".2"  className="vo-ring-pulse-2"/>
    <ellipse cx="100" cy="205" rx="50" ry="65"  fill="#8b5cf6" opacity=".06" className="vo-aura-pulse"/>
    <ellipse cx="100" cy="205" rx="36" ry="52"  fill="#2e1065" className="vo-cosmic-body"/>
    <path d="M64,185 L100,170 L136,185" stroke="#a78bfa" strokeWidth="1" fill="none" opacity=".5"/>
    <path d="M64,220 L100,235 L136,220" stroke="#a78bfa" strokeWidth="1" fill="none" opacity=".4"/>
    <g transform="translate(100,200)">
      <polygon points="0,-14 3.5,-5 13,-5 5.5,2 8.5,12 0,6.5 -8.5,12 -5.5,2 -13,-5 -3.5,-5" fill="#f59e0b" className="vo-star-pulse"/>
    </g>
    <rect x="64" y="226" width="72" height="9" rx="4.5" fill="#f59e0b" opacity=".8"/>
    <ellipse cx="100" cy="148" rx="26" ry="28" fill="#4c1d95"/>
    <ellipse cx="100" cy="150" rx="22" ry="19" fill="#2e1065" opacity=".6"/>
    <path d="M100,120 Q95,104 93,90 Q100,83 107,90 Q105,104 100,120" fill="#f59e0b" className="vo-crest-glow"/>
    <ellipse cx="91"  cy="144" rx="9" ry="7" fill="#f59e0b" className="vo-cosmic-eye"/>
    <ellipse cx="109" cy="144" rx="9" ry="7" fill="#f59e0b" className="vo-cosmic-eye"/>
    <ellipse cx="91"  cy="144" rx="4.5" ry="3.5" fill="white"/>
    <ellipse cx="109" cy="144" rx="4.5" ry="3.5" fill="white"/>
    <path d="M136,202 Q168,162 194,132" stroke="#2e1065" strokeWidth="17" strokeLinecap="round" fill="none" className="vo-cosmic-arm"/>
    <path d="M136,202 Q168,162 194,132" stroke="#8b5cf6" strokeWidth="7"  strokeLinecap="round" fill="none" opacity=".7"/>
    <circle cx="194" cy="132" r="14" fill="#f59e0b" opacity=".25" className="vo-blast-pulse"/>
    <circle cx="194" cy="132" r="8"  fill="#f59e0b" opacity=".8"  className="vo-blast-core"/>
    <circle cx="194" cy="132" r="4"  fill="white"   opacity=".95"/>
    <circle cx="210" cy="116" r="3.5" fill="#a78bfa" className="vo-particle-1" opacity=".8"/>
    <circle cx="222" cy="102" r="2.5" fill="#f59e0b" className="vo-particle-2" opacity=".7"/>
    <circle cx="206" cy="102" r="2"   fill="#a78bfa" className="vo-particle-3" opacity=".6"/>
    <path d="M64,202 Q46,222 32,244" stroke="#2e1065" strokeWidth="17" strokeLinecap="round" fill="none"/>
    <path d="M84,252 Q76,315 74,378"   stroke="#2e1065" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-hover"/>
    <path d="M116,252 Q124,315 126,378" stroke="#2e1065" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-hover-r"/>
    <path d="M84,252 Q76,315 74,378"   stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".3"/>
    <path d="M116,252 Q124,315 126,378" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".3"/>
    <circle cx="50"  cy="182" r="3"   fill="#f59e0b" className="vo-float-p1" opacity=".7"/>
    <circle cx="154" cy="242" r="4"   fill="#a78bfa" className="vo-float-p2" opacity=".6"/>
    <circle cx="158" cy="172" r="2.5" fill="#f59e0b" className="vo-float-p3" opacity=".8"/>
  </svg>
);

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function VendorOnboarding() {
  const [activePhase, setActivePhase] = useState("setup");
  const [activeStep,  setActiveStep]  = useState(0);
  const [animated,    setAnimated]    = useState(false);
  const [cardKey,     setCardKey]     = useState(0);
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  const phaseSteps    = STEPS.filter(s => s.phase === activePhase);
  const step          = phaseSteps[activeStep] || phaseSteps[0];
  const globalIndex   = STEPS.findIndex(s => s.id === step?.id);
  const totalProgress = ((globalIndex + 1) / STEPS.length) * 100;

  const [particles] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 7 + 5,
      delay: Math.random() * 6,
      color: ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ef4444"][Math.floor(Math.random() * 6)],
    }))
  );

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  /* ── Canvas background ── */
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
    const pts = Array.from({ length: 30 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: .5 + Math.random() * .9,
      vx: (Math.random() - .5) * .18,
      vy: (Math.random() - .5) * .18,
      alpha: .08 + Math.random() * .15,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${p.alpha})`; ctx.fill();
      });
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 80) {
            ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${(1 - d / 80) * .06})`;
            ctx.lineWidth = .5; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);

  const goToStep = (phase, stepIdx) => {
    setActivePhase(phase);
    setActiveStep(stepIdx);
    setCardKey(k => k + 1);
  };

  const goNext = () => {
    if (activeStep < phaseSteps.length - 1) {
      goToStep(activePhase, activeStep + 1);
    } else {
      const phaseIdx = PHASES.findIndex(p => p.id === activePhase);
      if (phaseIdx < PHASES.length - 1) {
        goToStep(PHASES[phaseIdx + 1].id, 0);
      }
    }
  };

  const goPrev = () => {
    if (activeStep > 0) {
      goToStep(activePhase, activeStep - 1);
    } else {
      const phaseIdx = PHASES.findIndex(p => p.id === activePhase);
      if (phaseIdx > 0) {
        const prevPhase = PHASES[phaseIdx - 1];
        const prevSteps = STEPS.filter(s => s.phase === prevPhase.id);
        goToStep(prevPhase.id, prevSteps.length - 1);
      }
    }
  };

  const isFirst = activePhase === PHASES[0].id && activeStep === 0;
  const isLast  = activePhase === PHASES[PHASES.length - 1].id &&
                  activeStep  === STEPS.filter(s => s.phase === activePhase).length - 1;

  if (!step) return null;

  return (
    <div className="vms-root">
      {/* Canvas BG */}
      <canvas ref={canvasRef} className="vo-canvas" />

      {/* Particles */}
      <div className="vo-bg-particles" aria-hidden="true">
        {particles.map(p => (
          <div key={p.id} className="vo-bg-particle" style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size, background: p.color,
            animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`,
          }} />
        ))}
      </div>

      {/* Grid */}
      <div className="vo-grid-overlay" aria-hidden="true" />

      {/* Hero characters */}
      <div className={`vo-hero-left ${animated ? "vo-hero-in" : ""}`} aria-hidden="true">
        <SpiderHero />
      </div>
      <div className={`vo-hero-right ${animated ? "vo-hero-in" : ""}`} aria-hidden="true">
        <CosmicHero />
      </div>

      {/* ── Content ── */}
      <div className={`vms-content ${animated ? "vo-content-in" : ""}`}>

        {/* HEADER */}
        <div className="vms-header">
          <div className="vo-badge">VENDOR MANAGEMENT SYSTEM · SETUP GUIDE</div>
          <h1 className="vms-title">
            Your <span className="vo-highlight-blue">Complete</span><br />
            <span className="vo-highlight-gold">Workflow</span> Guide
          </h1>
          <p className="vms-subtitle">
            4 phases · 12 steps · From first manufacturer to live dashboard
          </p>
        </div>

        {/* PHASE SELECTOR */}
        <div className="vo-phase-nav">
          {PHASES.map((ph, pi) => {
            const phSteps  = STEPS.filter(s => s.phase === ph.id);
            const isDone   = PHASES.findIndex(p => p.id === activePhase) > pi;
            const isCurrent = ph.id === activePhase;
            return (
              <button key={ph.id}
                className={`vo-phase-btn ${isCurrent ? "vo-phase-active" : ""} ${isDone ? "vo-phase-done" : ""}`}
                style={{ "--ph-color": ph.color }}
                onClick={() => goToStep(ph.id, 0)}
              >
                <span className="vo-phase-icon">{ph.icon}</span>
                <div className="vo-phase-text">
                  <span className="vo-phase-label">{ph.label}</span>
                  <span className="vo-phase-count">{phSteps.length} steps</span>
                </div>
                {isDone && <span className="vo-phase-check">✓</span>}
                {isCurrent && <span className="vo-phase-indicator" style={{ background: ph.color }} />}
              </button>
            );
          })}
        </div>

        {/* GLOBAL PROGRESS BAR */}
        <div className="vo-global-progress">
          <div className="vo-gp-bar">
            <div className="vo-gp-fill" style={{ width: `${totalProgress}%`, background: step.color }} />
          </div>
          <span className="vo-gp-label" style={{ color: step.color }}>
            Step {globalIndex + 1} of {STEPS.length}
          </span>
        </div>

        {/* STEP PILLS — only current phase */}
        <div className="vo-step-nav">
          {phaseSteps.map((s, i) => (
            <button key={s.id}
              className={`vo-step-pill ${activeStep === i ? "vo-sp-active" : ""} ${i < activeStep ? "vo-sp-done" : ""}`}
              style={{ "--pill-color": s.color }}
              onClick={() => goToStep(activePhase, i)}
            >
              <span className="vo-pill-icon">{i < activeStep ? "✓" : s.icon}</span>
              <span className="vo-pill-label">{s.label}</span>
              {activeStep === i && <span className="vo-pill-dot" style={{ background: s.color }} />}
            </button>
          ))}
        </div>

        {/* STEP CARD */}
        <div key={cardKey} className="vo-step-card" style={{ "--step-color": step.color, "--step-glow": step.glow }}>

          {/* ── LEFT ── */}
          <div className="vo-card-left">
            <div className="vo-step-tag" style={{ color: step.color }}>
              Phase {PHASES.findIndex(p => p.id === step.phase) + 1} · Step {globalIndex + 1}
            </div>
            <div className="vo-step-big-icon">{step.icon}</div>
            <h2 className="vo-step-title">{step.title}</h2>
            <p className="vo-step-sub" style={{ color: step.color }}>{step.subtitle}</p>
            <p className="vo-step-desc">{step.description}</p>

            <div className="vo-tip-box" style={{ borderColor: step.color }}>
              <span className="vo-tip-label" style={{ color: step.color }}>⚡ Pro Tip</span>
              <span className="vo-tip-text">{step.tip}</span>
            </div>

            {step.route && (
              <a href={step.route} className="vo-go-btn" style={{ background: step.color }}>
                Open {step.label} →
              </a>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="vo-card-right">
            <div className="vo-actions-label">HOW TO DO IT</div>
            {step.bullets.map((b, i) => (
              <div key={i} className="vo-action-row" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="vo-action-num" style={{ background: step.color }}>{i + 1}</div>
                <div className="vo-action-text">{b}</div>
              </div>
            ))}

            {/* Phase mini progress */}
            <div className="vo-phase-progress">
              <span className="vo-pp-label">Phase progress</span>
              <div className="vo-pp-dots">
                {phaseSteps.map((_, i) => (
                  <span key={i} className={`vo-pp-dot ${i === activeStep ? "vo-pp-active" : i < activeStep ? "vo-pp-done" : ""}`}
                    style={{ "--dot-color": step.color }}
                    onClick={() => goToStep(activePhase, i)}
                  />
                ))}
              </div>
            </div>

            <div className="vo-nav-buttons">
              <button className="vo-nav-btn" onClick={goPrev} disabled={isFirst}>← Previous</button>
              {isLast ? (
                <button className="vo-nav-btn vo-finish" style={{ background: step.color }}
                  onClick={() => goToStep(PHASES[0].id, 0)}>
                  🎉 Restart Tour
                </button>
              ) : (
                <button className="vo-nav-btn vo-next" style={{ background: step.color }}
                  onClick={goNext}>
                  Next Step →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PHASE MAP — all steps overview */}
        <div className="vo-phase-map">
          {PHASES.map((ph, pi) => (
            <div key={ph.id} className="vo-pm-phase">
              <div className="vo-pm-phase-label" style={{ color: ph.color }}>
                <span>{ph.icon}</span> {ph.label}
              </div>
              <div className="vo-pm-steps">
                {STEPS.filter(s => s.phase === ph.id).map((s, si) => {
                  const isActive = s.id === step?.id;
                  const isDone   = STEPS.findIndex(x => x.id === step?.id) > STEPS.findIndex(x => x.id === s.id);
                  return (
                    <div key={s.id}
                      className={`vo-pm-step ${isActive ? "vo-pm-active" : ""} ${isDone ? "vo-pm-done" : ""}`}
                      style={{ "--pm-color": s.color }}
                      onClick={() => goToStep(ph.id, si)}
                      title={s.title}
                    >
                      <span className="vo-pm-icon">{isDone ? "✓" : s.icon}</span>
                      <span className="vo-pm-name">{s.label}</span>
                    </div>
                  );
                })}
              </div>
              {pi < PHASES.length - 1 && (
                <div className="vo-pm-arrow" style={{ color: ph.color }}>→</div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}