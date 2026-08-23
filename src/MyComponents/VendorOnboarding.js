import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/VendorOnboarding.css";

const GROUPS = [
  { id: "start", label: "Start here", description: "Set up the people and products you work with." },
  { id: "stock", label: "Stock", description: "Bring stock in and keep it accurate." },
  { id: "sales", label: "Sales", description: "Bill customers, take payments, and handle returns." },
  { id: "money", label: "Payments", description: "Track what customers owe and what you owe suppliers." },
  { id: "control", label: "Control centre", description: "Review, correct, and automate your business." },
];

const MODULES = [
  { id: "manufacturer", group: "start", icon: "M", name: "Manufacturers", summary: "Add the companies that make the products you sell.", use: "Do this before adding products.", route: "/master/manufacturer" },
  { id: "supplier", group: "start", icon: "S", name: "Suppliers", summary: "Add distributors and stockists you buy from.", use: "Needed before recording a purchase.", route: "/master/supplier" },
  { id: "product-type", group: "start", icon: "T", name: "Product types", summary: "Create simple categories such as Tablet, Syrup, or Injection.", use: "Use these to organise products and reports.", route: "/master/product-type" },
  { id: "product", group: "start", icon: "P", name: "Products", summary: "Build your medicine catalogue with manufacturer, type, and GST details.", use: "Products need to exist before purchase or sale.", route: "/master/product" },
  { id: "retailer", group: "start", icon: "R", name: "Retailers", summary: "Add your customer pharmacies and their credit limits.", use: "Needed before creating a tracked sales invoice.", route: "/master/retailer" },

  { id: "purchase", group: "stock", icon: "IN", name: "Purchase", summary: "Record stock received from a supplier, including batch and expiry details.", use: "This creates inventory and supplier dues automatically.", route: "/master/purchase" },
  { id: "inventory", group: "stock", icon: "IV", name: "Inventory", summary: "See live stock quantities, values, and reorder information.", use: "Use it to check availability before selling.", route: "/master/inventory" },
  { id: "batch", group: "stock", icon: "B", name: "Batches", summary: "Review batch-wise quantity and expiry dates.", use: "Useful for expiry checks and batch traceability.", route: "/master/batch" },
  { id: "stock-adjustment", group: "stock", icon: "AD", name: "Stock adjustment", summary: "Correct stock after damage, counting differences, or other changes.", use: "Use only when stock must be manually corrected.", route: "/master/stock-adjustment" },
  { id: "alerts", group: "stock", icon: "!", name: "Expiry and reorder alerts", summary: "Find stock that is expiring soon or running low.", use: "Review these regularly to avoid losses and stock-outs.", route: "/master/alerts" },

  { id: "sales", group: "sales", icon: "SL", name: "Sales", summary: "Create invoices for retailers and reduce stock using the available batches.", use: "Use for your normal day-to-day billing.", route: "/master/sales" },
  { id: "quick-sale", group: "sales", icon: "QS", name: "Quick sale", summary: "Create a faster sales invoice when you need to bill quickly.", use: "Best for fast counter billing.", route: "/master/salesshrt" },
  { id: "sales-return", group: "sales", icon: "SR", name: "Sales return", summary: "Record goods returned by a retailer and update stock and balances.", use: "Use when a customer returns invoiced products.", route: "/master/sales-return" },
  { id: "purchase-return", group: "sales", icon: "PR", name: "Purchase return", summary: "Record products returned to a supplier.", use: "Use for damaged, expired, or supplier-returned stock.", route: "/master/purchase-return" },
  { id: "payment-collection", group: "sales", icon: "PC", name: "Payment collection", summary: "Record cash, UPI, card, cheque, or bank payments from retailers.", use: "Use when a retailer pays an outstanding invoice.", route: "/master/payment-collection" },

  { id: "supplier-payment", group: "money", icon: "SP", name: "Supplier payment", summary: "Record payments made against supplier purchase dues.", use: "Use whenever you settle a supplier invoice or balance.", route: "/master/supplier-payment" },
  { id: "retailer-outstanding", group: "money", icon: "RO", name: "Retailer outstanding", summary: "See what every retailer owes and review their ledger.", use: "Use before follow-ups or credit decisions.", route: "/master/retailer-outstanding" },
  { id: "supplier-outstanding", group: "money", icon: "SO", name: "Supplier outstanding", summary: "See what you owe each supplier and review purchase dues.", use: "Use to plan supplier payments.", route: "/master/supplier-outstanding" },
  { id: "payment-history", group: "money", icon: "PH", name: "Payment history", summary: "Review recorded customer payments and their status.", use: "Use when reconciling collections.", route: "/master/payment-collection" },

  { id: "dashboard", group: "control", icon: "DB", name: "Dashboard", summary: "See important sales, stock, due, and alert information in one place.", use: "Start each day here for a quick health check.", route: "/master/dashboard" },
  { id: "reports", group: "control", icon: "RP", name: "Reports", summary: "Generate sales, stock, expiry, and outstanding reports.", use: "Use for review, reconciliation, and compliance.", route: "/master/reports" },
  { id: "bulk-upload", group: "control", icon: "UP", name: "Bulk upload", summary: "Upload large sets of master data or transactions from a file.", use: "Use instead of entering many records one by one.", route: "/master/bulk-upload" },
  { id: "job-scheduler", group: "control", icon: "JS", name: "Job scheduler", summary: "Review and manage scheduled system jobs.", use: "Use when you need to check background automation.", route: "/master/job-scheduler" },
];

const STARTING_PATH = ["manufacturer", "supplier", "product-type", "product", "retailer", "purchase", "sales"];

// One plain-English line per starter step — kept separate from MODULES.summary
// so this stays short and skimmable even where the master-data summary is longer.
const STEP_HINT = {
  manufacturer: "Add the companies whose medicines you sell.",
  supplier: "Add where you buy your stock from.",
  "product-type": "Group medicines, e.g. Tablet, Syrup, Injection.",
  product: "Build your medicine list — name, price, GST.",
  retailer: "Add the pharmacies you sell to.",
  purchase: "Bring stock in from a supplier.",
  sales: "Bill a retailer — you're live.",
};

/* Reveals a section once it scrolls into view, then stays revealed.
   Respects prefers-reduced-motion by starting already visible. */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

export default function VendorOnboarding() {
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState("start");
  const [selectedId, setSelectedId] = useState("manufacturer");
  const [showAll, setShowAll] = useState(false);

  const [heroReady, setHeroReady] = useState(false);
  const [flowRef, flowVisible] = useReveal();
  const [stepsRef, stepsVisible] = useReveal();
  const [guideRef, guideVisible] = useReveal();

  useEffect(() => {
    const t = setTimeout(() => setHeroReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  const selected = MODULES.find((module) => module.id === selectedId) || MODULES[0];
  const visibleModules = useMemo(
    () => MODULES.filter((module) => showAll || module.group === activeGroup),
    [activeGroup, showAll]
  );

  const chooseModule = (module) => {
    setSelectedId(module.id);
    setActiveGroup(module.group);
  };

  const chooseGroup = (id) => {
    setActiveGroup(id);
    setShowAll(false);
    const first = MODULES.find((module) => module.group === id);
    if (first) setSelectedId(first.id);
  };

  return (
    <main className="onboarding-page">
      <section className={`onboarding-hero${heroReady ? " is-ready" : ""}`}>
        <div>
          <span className="onboarding-eyebrow onboarding-fade-1">VMS GETTING STARTED</span>
          <h1 className="onboarding-fade-2">Learn VMS in the order you work.</h1>
          <p className="onboarding-fade-3">Start with your master data, record stock, bill customers, then use payments and reports. Select any task to see when to use it and open it directly.</p>
        </div>
        <button className="onboarding-primary onboarding-fade-3" onClick={() => navigate("/master/manufacturer")}>Start setup</button>
      </section>

      <section className={`onboarding-flow reveal${flowVisible ? " is-visible" : ""}`} ref={flowRef} aria-labelledby="business-flow">
        <div className="onboarding-section-head">
          <div>
            <span className="onboarding-eyebrow">THE BIG PICTURE</span>
            <h2 id="business-flow">How everything connects</h2>
          </div>
          <span className="onboarding-path-note">Your business moves through these five stages, in this order, every day.</span>
        </div>

        <div className="onboarding-flow-track">
          <svg className="onboarding-flow-svg" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <path id="obFlowPath" className="onboarding-flow-line" d="M10,5 L90,5" />
            <circle r="1.6" className="onboarding-flow-pulse">
              <animateMotion dur="7s" repeatCount="indefinite">
                <mpath href="#obFlowPath" />
              </animateMotion>
            </circle>
          </svg>

          <div className="onboarding-flow-nodes">
            {GROUPS.map((group, index) => (
              <button
                key={group.id}
                className={activeGroup === group.id && !showAll ? "onboarding-flow-node is-active" : "onboarding-flow-node"}
                style={{ "--i": index }}
                onClick={() => chooseGroup(group.id)}
              >
                <span className="onboarding-flow-icon">{index + 1}</span>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`onboarding-path reveal${stepsVisible ? " is-visible" : ""}`} ref={stepsRef} aria-labelledby="recommended-path">
        <div className="onboarding-section-head">
          <div>
            <span className="onboarding-eyebrow">RECOMMENDED FIRST RUN</span>
            <h2 id="recommended-path">Your first 7 steps</h2>
          </div>
          <span className="onboarding-path-note">Follow this once, in order. After that, use the guide below whenever you need help.</span>
        </div>

        <ol className="onboarding-timeline">
          {STARTING_PATH.map((id, index) => {
            const module = MODULES.find((item) => item.id === id);
            return (
              <li key={id} style={{ "--i": index }}>
                <button className="onboarding-timeline-item" onClick={() => chooseModule(module)}>
                  <span className="onboarding-timeline-num">{index + 1}</span>
                  <span className="onboarding-timeline-copy">
                    <strong>{module.name}</strong>
                    <small>{STEP_HINT[id]}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={`onboarding-guide reveal${guideVisible ? " is-visible" : ""}`} ref={guideRef}>
        <aside className="onboarding-sidebar">
          <span className="onboarding-eyebrow">TASK GUIDE</span>
          <h2>What do you need to do?</h2>
          <div className="onboarding-group-list">
            {GROUPS.map((group) => (
              <button key={group.id} className={activeGroup === group.id && !showAll ? "is-active" : ""} onClick={() => { setActiveGroup(group.id); setShowAll(false); }}>
                <strong>{group.label}</strong><span>{group.description}</span>
              </button>
            ))}
          </div>
          <button className={showAll ? "onboarding-all is-active" : "onboarding-all"} onClick={() => setShowAll((current) => !current)}>
            {showAll ? "Show one group" : `See all ${MODULES.length} modules`}
          </button>
        </aside>

        <div className="onboarding-content">
          <div className="onboarding-module-grid">
            {visibleModules.map((module, index) => (
              <button
                key={module.id}
                className={selected.id === module.id ? "onboarding-module is-selected" : "onboarding-module"}
                style={{ "--i": index }}
                onClick={() => chooseModule(module)}
              >
                <span className="onboarding-module-icon">{module.icon}</span>
                <span><strong>{module.name}</strong><small>{module.summary}</small></span>
              </button>
            ))}
          </div>

          <article className="onboarding-detail" key={selected.id}>
            <span className="onboarding-detail-icon">{selected.icon}</span>
            <div>
              <span className="onboarding-eyebrow">{GROUPS.find((group) => group.id === selected.group)?.label}</span>
              <h2>{selected.name}</h2>
              <p>{selected.summary}</p>
              <div className="onboarding-when"><strong>When should I use this?</strong><span>{selected.use}</span></div>
              <button className="onboarding-primary" onClick={() => navigate(selected.route)}>Open {selected.name}</button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
