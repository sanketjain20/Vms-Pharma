import React, { useEffect, useState } from "react";
import "../../Styles/Login/Auth.css";

const FEATURES = [
  { label: "Live inventory, batch by batch", desc: "Stock, expiry and reorder points update the moment a sale or purchase happens." },
  { label: "Vendor & retailer ledgers", desc: "Every outstanding balance and payment, always current — no manual reconciling." },
  { label: "GST-ready invoicing", desc: "Compliant bills and instant reports, generated automatically as you sell." },
];

/* Restrained aurora wash + film-grain texture behind the brand panel —
   same recipe as the dashboard's noise overlay, kept deliberately quiet. */
function BrandBackdrop() {
  return (
    <div className="auth-brand-bg" aria-hidden="true">
      <span className="auth-brand-blob auth-brand-blob-1" />
      <span className="auth-brand-blob auth-brand-blob-2" />
      <div className="auth-brand-grid" />
      <div className="auth-brand-noise" />
    </div>
  );
}

function BrandPanel() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <aside className={`auth-brand${ready ? " is-ready" : ""}`}>
      <BrandBackdrop />

      <div className="auth-brand-top">
        <div className="auth-brand-mark">
          VMS<span className="auth-cursor" />
        </div>
        <span className="auth-brand-tagline">Vendor Management System</span>
      </div>

      <div className="auth-brand-mid">
        <p className="auth-brand-headline">
          Your pharma business,<br />always in control.
        </p>
        <p className="auth-brand-copy">
          One console for stock, billing, vendors and reports — built for pharma
          wholesale.
        </p>

        <ul className="auth-feature-list">
          {FEATURES.map((f, i) => (
            <li key={f.label} className="auth-feature" style={{ "--i": i }}>
              <span className="auth-feature-check">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <strong>{f.label}</strong>
                <small>{f.desc}</small>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-brand-bottom">
        <div className="auth-brand-quote">
          &ldquo;Everything from purchase to payment, in one place.&rdquo;
        </div>
      </div>
    </aside>
  );
}

/* Shared chrome for every auth screen — brand panel on the left, a clean
   card-less form column on the right. Pass eyebrow/title/subtitle/children
   for the form content and an optional footer node below the card. */
export default function AuthLayout({ eyebrow, title, subtitle, children, footer, formKey }) {
  return (
    <div className="auth-frame">
      <BrandPanel />

      <section className="auth-form-side">
        <div className="auth-form-col" key={formKey}>
          {eyebrow && <span className="auth-eyebrow">{eyebrow}</span>}
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}

          {children}
        </div>

        <div className="auth-form-footer">{footer}</div>
      </section>
    </div>
  );
}
