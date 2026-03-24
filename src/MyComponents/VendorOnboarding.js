import React, { useState, useEffect } from "react";
import "../Styles/VendorOnboarding.css";

const steps = [
  {
    id: 1, icon: "🏷️", label: "Product Type",
    color: "#e63946", glow: "#e6394650",
    title: "Define Product Types", subtitle: "Lay the Foundation",
    description: "Start by setting up your product categories. Product Types act as the blueprint — defining product type and its description.",
    bullets: ["Go to Product and Types → Product Types", "Click 'Add Product Type' (e.g. Electronics, Apparel)", "Add the Product Type name and description", "Can Add,Edit & Deactivate product types anytime"],
    tip: "Keep types broad (5–10 max). Sub-categories live at the Product level.",
  },
  {
    id: 2, icon: "📦", label: "Product",
    color: "#4361ee", glow: "#4361ee50",
    title: "Add Your Products", subtitle: "Build the Catalogue",
    description: "Create individual products under their respective types. Add descriptions, pricing and  unit. Your product catalogue is the core of the entire VMS.",
    bullets: ["Navigate to Product and Types → Products", "Click 'Add Product' and select a Product Type", "Enter name, description, price and unit (e.g. piece, kg) for each product"],
    tip: "In future you can use bulk import via CSV to add hundreds of products at once.",
  },
  {
    id: 3, icon: "🏪", label: "Inventory",
    color: "#7209b7", glow: "#7209b750",
    title: "Manage Inventory", subtitle: "Track Every Unit",
    description: "Stock your products across warehouses and locations. Set reorder levels, track movement, and ensure you never run out — or overstock.",
    bullets: ["Go to Inventory → Stock Management", "Select product and assign warehouse location", "Enter opening stock quantity", "Set low-stock alerts and reorder thresholds"],
    tip: "Enable auto-reorder to trigger purchase orders when stock dips below threshold.",
  },
  {
    id: 4, icon: "🧾", label: "Sales / Invoice",
    color: "#f77f00", glow: "#f77f0050",
    title: "Process Sales & Invoices", subtitle: "Close the Deal",
    description: "Create sales orders and generate invoices in seconds. The VMS links product data and inventory automatically — so every sale updates your stock in real time.",
    bullets: ["Navigate to Sales → New Order", "Select customer and add products from catalogue", "Confirm quantities — inventory deducts live", "Generate and send invoice (PDF / email)"],
    tip: "Apply discount codes, taxes, and payment terms directly on the invoice.",
  },
  {
    id: 5, icon: "📊", label: "Reports",
    color: "#06d6a0", glow: "#06d6a050",
    title: "Run Reports", subtitle: "Measure Everything",
    description: "Access pre-built and custom reports across sales, inventory, and financials. Spot trends, identify top sellers, and manage margins with precision.",
    bullets: ["Go to Reports → choose category", "Filter by date range, product, or vendor", "Export as PDF or Excel", "Schedule automated weekly / monthly reports"],
    tip: "Use the Sales Velocity report to predict restock needs before stockouts happen.",
  },
  {
    id: 6, icon: "🚀", label: "Dashboard",
    color: "#118ab2", glow: "#118ab250",
    title: "Your Command Centre", subtitle: "Everything at a Glance",
    description: "The Dashboard is your live hub — see real-time KPIs, alerts, pending invoices, and inventory health all in one place. Customise widgets to match your workflow.",
    bullets: ["Access Dashboard from the main navigation", "Pin your key metrics as widgets", "View pending orders and low-stock alerts", "Drill down into any card for full details"],
    tip: "Share Dashboard views with your team using role-based access controls.",
  },
];

/* ── Spider-Man inspired hero SVG ── */
const SpiderHero = () => (
  <svg viewBox="0 0 200 420" className="vo-hero-svg" xmlns="http://www.w3.org/2000/svg">
    <g opacity=".35">
      <line x1="100" y1="0" x2="0" y2="100" stroke="#e63946" strokeWidth=".6" />
      <line x1="100" y1="0" x2="50" y2="150" stroke="#e63946" strokeWidth=".6" />
      <line x1="100" y1="0" x2="100" y2="160" stroke="#e63946" strokeWidth=".6" />
      <line x1="100" y1="0" x2="150" y2="150" stroke="#e63946" strokeWidth=".6" />
      <line x1="100" y1="0" x2="200" y2="100" stroke="#e63946" strokeWidth=".6" />
      <path d="M0,100 Q50,80 100,100 Q150,120 200,100" stroke="#e63946" strokeWidth=".6" fill="none" />
      <path d="M25,150 Q62,130 100,150 Q138,170 175,150" stroke="#e63946" strokeWidth=".6" fill="none" />
      <path d="M50,200 Q75,185 100,200 Q125,215 150,200" stroke="#e63946" strokeWidth=".6" fill="none" />
    </g>
    <ellipse cx="100" cy="205" rx="50" ry="65" fill="#e63946" opacity=".06" className="vo-aura-pulse" />
    <ellipse cx="100" cy="205" rx="36" ry="52" fill="#c1121f" className="vo-body-glow" />
    <g transform="translate(100,200)">
      <path d="M0,-13 L-4,-4 L-13,-6 L-8,2 L-13,9 L-4,7 L0,17 L4,7 L13,9 L8,2 L13,-6 L4,-4 Z" fill="#000" opacity=".5" />
    </g>
    <rect x="66" y="244" width="68" height="7" rx="3.5" fill="#000" opacity=".35" />
    <ellipse cx="100" cy="142" rx="28" ry="30" fill="#c1121f" className="vo-head-pulse" />
    <ellipse cx="90" cy="137" rx="11" ry="9" fill="white" opacity=".92" className="vo-eye-glow" />
    <ellipse cx="110" cy="137" rx="11" ry="9" fill="white" opacity=".92" className="vo-eye-glow" />
    <ellipse cx="90" cy="137" rx="6" ry="5.5" fill="#e63946" />
    <ellipse cx="110" cy="137" rx="6" ry="5.5" fill="#e63946" />
    <line x1="100" y1="112" x2="100" y2="170" stroke="#000" strokeWidth=".7" opacity=".3" />
    <path d="M72,132 Q86,140 100,132 Q114,124 128,132" stroke="#000" strokeWidth=".7" fill="none" opacity=".3" />
    <path d="M74,147 Q87,155 100,147 Q113,139 126,147" stroke="#000" strokeWidth=".7" fill="none" opacity=".3" />
    <path d="M64,212 Q32,172 12,142" stroke="#c1121f" strokeWidth="17" strokeLinecap="round" fill="none" className="vo-arm-swing" />
    <path d="M64,212 Q32,172 12,142" stroke="#e63946" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".4" />
    <path d="M12,142 Q-15,95 -25,30" stroke="#e63946" strokeWidth="1.5" fill="none" strokeDasharray="5,4" className="vo-web-shoot" opacity=".85" />
    <path d="M136,212 Q158,235 172,255" stroke="#c1121f" strokeWidth="17" strokeLinecap="round" fill="none" />
    <path d="M84,250 Q72,315 68,375" stroke="#c1121f" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-float" />
    <path d="M116,250 Q128,315 132,375" stroke="#c1121f" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-float-r" />
  </svg>
);

/* ── Cosmic hero SVG ── */
const CosmicHero = () => (
  <svg viewBox="0 0 200 420" className="vo-hero-svg" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="100" cy="210" rx="90" ry="108" fill="none" stroke="#ffd60a" strokeWidth="1" opacity=".12" className="vo-ring-pulse-1" />
    <ellipse cx="100" cy="210" rx="72" ry="86" fill="none" stroke="#4cc9f0" strokeWidth="1" opacity=".18" className="vo-ring-pulse-2" />
    <ellipse cx="100" cy="205" rx="50" ry="65" fill="#4cc9f0" opacity=".05" className="vo-aura-pulse" />
    <ellipse cx="100" cy="205" rx="36" ry="52" fill="#1d3557" className="vo-cosmic-body" />
    <path d="M64,185 L100,170 L136,185" stroke="#4cc9f0" strokeWidth="1" fill="none" opacity=".4" />
    <path d="M64,220 L100,235 L136,220" stroke="#4cc9f0" strokeWidth="1" fill="none" opacity=".3" />
    <g transform="translate(100,200)">
      <polygon points="0,-14 3.5,-5 13,-5 5.5,2 8.5,12 0,6.5 -8.5,12 -5.5,2 -13,-5 -3.5,-5" fill="#ffd60a" className="vo-star-pulse" />
    </g>
    <rect x="64" y="226" width="72" height="9" rx="4.5" fill="#ffd60a" opacity=".75" />
    <ellipse cx="100" cy="148" rx="26" ry="28" fill="#f4a261" />
    <ellipse cx="100" cy="150" rx="22" ry="19" fill="#1d3557" opacity=".55" />
    <path d="M100,120 Q95,104 93,90 Q100,83 107,90 Q105,104 100,120" fill="#ffd60a" className="vo-crest-glow" />
    <path d="M76,135 Q88,125 100,122 Q112,125 124,135" stroke="#4cc9f0" strokeWidth="1.5" fill="none" opacity=".6" />
    <ellipse cx="91" cy="144" rx="9" ry="7" fill="#ffd60a" className="vo-cosmic-eye" />
    <ellipse cx="109" cy="144" rx="9" ry="7" fill="#ffd60a" className="vo-cosmic-eye" />
    <ellipse cx="91" cy="144" rx="4.5" ry="3.5" fill="white" />
    <ellipse cx="109" cy="144" rx="4.5" ry="3.5" fill="white" />
    <path d="M136,202 Q168,162 194,132" stroke="#1d3557" strokeWidth="17" strokeLinecap="round" fill="none" className="vo-cosmic-arm" />
    <path d="M136,202 Q168,162 194,132" stroke="#4cc9f0" strokeWidth="7" strokeLinecap="round" fill="none" opacity=".65" />
    <circle cx="194" cy="132" r="14" fill="#ffd60a" opacity=".25" className="vo-blast-pulse" />
    <circle cx="194" cy="132" r="8" fill="#ffd60a" opacity=".75" className="vo-blast-core" />
    <circle cx="194" cy="132" r="4" fill="white" opacity=".9" />
    <circle cx="210" cy="116" r="3.5" fill="#4cc9f0" className="vo-particle-1" opacity=".8" />
    <circle cx="222" cy="102" r="2.5" fill="#ffd60a" className="vo-particle-2" opacity=".7" />
    <circle cx="206" cy="102" r="2" fill="#4cc9f0" className="vo-particle-3" opacity=".6" />
    <path d="M64,202 Q46,222 32,244" stroke="#1d3557" strokeWidth="17" strokeLinecap="round" fill="none" />
    <path d="M84,252 Q76,315 74,378" stroke="#1d3557" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-hover" />
    <path d="M116,252 Q124,315 126,378" stroke="#1d3557" strokeWidth="19" strokeLinecap="round" fill="none" className="vo-leg-hover-r" />
    <path d="M84,252 Q76,315 74,378" stroke="#4cc9f0" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".25" />
    <path d="M116,252 Q124,315 126,378" stroke="#4cc9f0" strokeWidth="4" strokeLinecap="round" fill="none" opacity=".25" />
    <path d="M66,202 Q42,265 38,345 Q62,322 84,352" fill="#c1121f" opacity=".4" className="vo-cape-flutter" />
    <circle cx="50" cy="182" r="3" fill="#ffd60a" className="vo-float-p1" opacity=".65" />
    <circle cx="154" cy="242" r="4" fill="#4cc9f0" className="vo-float-p2" opacity=".55" />
    <circle cx="158" cy="172" r="2.5" fill="#ffd60a" className="vo-float-p3" opacity=".75" />
  </svg>
);

export default function VendorOnboarding() {
  const [activeStep, setActiveStep] = useState(0);
  const [animated, setAnimated] = useState(false);

  const [particles] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3.5 + 1,
      duration: Math.random() * 7 + 4,
      delay: Math.random() * 6,
      color: ["#e63946","#4361ee","#ffd60a","#4cc9f0","#06d6a0","#7209b7"][Math.floor(Math.random() * 6)],
    }))
  );

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, []);

  const step = steps[activeStep];

  return (
    <div className="vms-root">
      {/* Particles */}
      <div className="vo-bg-particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="vo-bg-particle"
            style={{
              left: `${p.x}%`, top: `${p.y}%`,
              width: p.size, height: p.size,
              background: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Grid */}
      <div className="vo-grid-overlay" />

      {/* Hero characters */}
      <div className={`vo-hero-left ${animated ? "vo-hero-in" : ""}`}>
        <SpiderHero />
      </div>
      <div className={`vo-hero-right ${animated ? "vo-hero-in" : ""}`}>
        <CosmicHero />
      </div>

      {/* ── Content ── */}
      <div className={`vms-content ${animated ? "vo-content-in" : ""}`}>

        {/* Header */}
        <div className="vms-header">
          <div className="vo-badge">VENDOR MANAGEMENT SYSTEM</div>
          <h1 className="vms-title">
            Your <span className="vo-highlight-red">Super</span>power
            <br />
            <span className="vo-highlight-blue">Workflow</span> Guide
          </h1>
          <p className="vms-subtitle">
            6 heroic steps to master your VMS — from first product type to live dashboard.
          </p>
        </div>

        {/* Pill nav */}
        <div className="vo-step-nav">
          {steps.map((s, i) => (
            <button
              key={s.id}
              className={`vo-step-pill ${activeStep === i ? "vo-active" : ""}`}
              style={{ "--pill-color": s.color, "--pill-glow": s.glow }}
              onClick={() => setActiveStep(i)}
            >
              <span className="vo-pill-icon">{s.icon}</span>
              <span className="vo-pill-label">{s.label}</span>
              {activeStep === i && <span className="vo-pill-dot" />}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="vo-connector-bar">
          <div
            className="vo-connector-fill"
            style={{ width: `${(activeStep / (steps.length - 1)) * 100}%`, background: step.color }}
          />
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`vo-connector-node ${i <= activeStep ? "vo-done" : ""}`}
              style={{ left: `${(i / (steps.length - 1)) * 100}%`, "--nc": s.color }}
              onClick={() => setActiveStep(i)}
            >
              <span>{i + 1}</span>
            </div>
          ))}
        </div>

        {/* Step card */}
        <div
          key={step.id}
          className="vo-step-card"
          style={{ "--step-color": step.color, "--step-glow": step.glow }}
        >
          {/* Left info */}
          <div className="vo-card-left">
            <div className="vo-step-tag" style={{ color: step.color }}>
              {String(step.id).padStart(2, "0")} — {step.label}
            </div>
            <div className="vo-step-big-icon">{step.icon}</div>
            <h2 className="vo-step-title">{step.title}</h2>
            <p className="vo-step-sub" style={{ color: step.color }}>{step.subtitle}</p>
            <p className="vo-step-desc">{step.description}</p>
            <div className="vo-tip-box" style={{ borderColor: step.color }}>
              <span className="vo-tip-label" style={{ color: step.color }}>⚡ Pro Tip</span>
              <span className="vo-tip-text">{step.tip}</span>
            </div>
          </div>

          {/* Right actions */}
          <div className="vo-card-right">
            <div className="vo-actions-label">HOW TO DO IT</div>
            {step.bullets.map((b, i) => (
              <div key={i} className="vo-action-row" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="vo-action-num" style={{ background: step.color }}>{i + 1}</div>
                <div className="vo-action-text">{b}</div>
              </div>
            ))}
            <div className="vo-nav-buttons">
              <button
                className="vo-nav-btn"
                onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
                disabled={activeStep === 0}
              >
                ← Previous
              </button>
              {activeStep < steps.length - 1 ? (
                <button
                  className="vo-nav-btn vo-next"
                  style={{ background: step.color }}
                  onClick={() => setActiveStep((p) => p + 1)}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  className="vo-nav-btn vo-finish"
                  style={{ background: step.color }}
                  onClick={() => setActiveStep(0)}
                >
                  🎉 Restart Tour
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Flow overview */}
        <div className="vo-flow-overview">
          {steps.map((s, i) => (
            <React.Fragment key={s.id}>
              <div
                className={`vo-flow-node ${
                  activeStep === i ? "vo-flow-active" : activeStep > i ? "vo-flow-done" : ""
                }`}
                style={{ "--fc": s.color }}
                onClick={() => setActiveStep(i)}
              >
                <span>{s.icon}</span>
                <span className="vo-fn-label">{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`vo-flow-arrow ${activeStep > i ? "vo-arrow-done" : ""}`}
                  style={{ color: s.color }}
                >
                  →
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
