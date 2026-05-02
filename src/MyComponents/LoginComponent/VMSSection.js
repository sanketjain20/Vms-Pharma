import React from "react";
import "../../Styles/Login/Login.css";

const features = [
  {
    icon: "📦",
    label: "Product Management",
    desc: "Full catalogue with batch tracking, HSN codes and schedule types.",
    color: "cyan",
  },
  {
    icon: "👥",
    label: "Vendor Tracking",
    desc: "Manage suppliers, retailers and outstanding balances in real time.",
    color: "blue",
  },
  {
    icon: "📈",
    label: "Sales Analytics",
    desc: "Live reports, GSTR-1 summaries, FIFO invoicing and payment tracking.",
    color: "purple",
  },
  {
    icon: "🗂️",
    label: "Live Dashboard",
    desc: "KPIs, expiry alerts, low stock and P&L — all in one screen.",
    color: "amber",
  },
];

export default function VMSSection() {
  return (
    <div className="vms-wrap">
      {/* Decorative rings */}
      <div className="vms-ring vms-ring-1" />
      <div className="vms-ring vms-ring-2" />

      {/* Right-edge accent line */}
      <div className="vms-accent-line" />

      <div className="vms-inner">
        {/* ── Brand ── */}
        <div className="vms-brand">
          <div className="vms-brand-letters">
            {"VMS".split("").map((c, i) => (
              <span
                key={i}
                className="vms-brand-char"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="vms-brand-underline" />
          <div className="vms-brand-sub">Vendor Management System</div>
        </div>

        {/* ── Tagline ── */}
        <p className="vms-tagline">
          Track vendors, stock, billing and analytics — complete pharma wholesale control in one system.
        </p>

        {/* ── Features ── */}
        <div className="vms-features">
          {features.map(({ icon, label, desc, color }, i) => (
            <div key={i} className={`vms-feat vms-feat-${color}`}>
              <div className="vms-feat-dot" />
              <div className="vms-feat-icon">{icon}</div>
              <div className="vms-feat-body">
                <div className="vms-feat-label">{label}</div>
                <div className="vms-feat-desc">{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats ── */}
        <div className="vms-stats">
          {[
            ["Products",  "Managed"],
            ["Invoices",  "Auto-generated"],
            ["Reports",   "Instant"],
          ].map(([val, key], i) => (
            <div key={i} className="vms-stat">
              <div className="vms-stat-label">{val}</div>
              <div className="vms-stat-sub">{key}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="vms-bottom-fade" />
    </div>
  );
}