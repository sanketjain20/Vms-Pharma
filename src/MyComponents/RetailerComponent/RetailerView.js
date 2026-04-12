import React, { useEffect, useState } from "react";
import "../../Styles/Retailer/Retailer.css";

/* ── Info card ── */
const Card = ({ label, value, mono, accent, danger, full }) => (
  <div className={`rtx-view-card ${full ? "rtx-view-card-full" : ""}`}>
    <span className="rtx-view-label">{label}</span>
    <span className={`rtx-view-value ${mono ? "rtx-mono" : ""} ${accent ? "rtx-accent" : ""} ${danger ? "rtx-danger" : ""}`}>
      {value || <span className="rtx-view-empty">—</span>}
    </span>
  </div>
);

/* ── Credit progress bar ── */
const CreditBar = ({ creditLimit, outstandingBalance }) => {
  const limit   = parseFloat(creditLimit || 0);
  const used    = parseFloat(outstandingBalance || 0);
  const avail   = Math.max(limit - used, 0);
  const pct     = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981";

  if (limit === 0) {
    return (
      <div className="rtx-credit-bar-wrap">
        <div className="rtx-credit-bar-labels">
          <span>Credit Limit</span>
          <span className="rtx-badge rtx-badge-blue">Unlimited</span>
        </div>
        <div className="rtx-credit-bar-track">
          <div className="rtx-credit-bar-fill" style={{ width: "30%", background: "#10b981" }} />
        </div>
        <div className="rtx-credit-bar-sub">
          Outstanding: <strong style={{ color: used > 0 ? "#fca5a5" : "#6ee7b7" }}>
            ₹{used.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </div>
    );
  }

  return (
    <div className="rtx-credit-bar-wrap">
      <div className="rtx-credit-bar-labels">
        <span>Credit Usage</span>
        <span style={{ fontFamily: "var(--rtx-font-m)", fontSize: 11, color: barColor }}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="rtx-credit-bar-track">
        <div className="rtx-credit-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="rtx-credit-bar-sub">
        <span>Used: <strong style={{ color: "#fca5a5" }}>₹{used.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
        <span>Available: <strong style={{ color: "#6ee7b7" }}>₹{avail.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
        <span>Limit: <strong style={{ color: "#93c5fd" }}>₹{limit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
      </div>
    </div>
  );
};

/* ── Credit status badge ── */
const creditStatus = (creditLimit, outstanding) => {
  const limit = parseFloat(creditLimit || 0);
  const used  = parseFloat(outstanding || 0);
  if (limit === 0) return { label: "Unlimited", cls: "rtx-badge-blue" };
  const pct = (used / limit) * 100;
  if (pct >= 100) return { label: "Limit Reached", cls: "rtx-badge-red" };
  if (pct >= 80)  return { label: "Warning",       cls: "rtx-badge-amber" };
  return             { label: "OK",               cls: "rtx-badge-green" };
};

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function RetailerView({ uKey, onClose, onEdit }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Retailer/Get/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (json?.status === 200) setData(json.data);
        else setError(json?.message || "Failed to fetch retailer");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  if (!uKey) return null;

  const cs = data ? creditStatus(data.creditLimit, data.outstandingBalance) : null;

  return (
    <div className="rtx-backdrop">
      <div className="rtx-modal rtx-modal-view">
        <div className="rtx-top-beam" />
        <div className="rtx-corner rtx-tl" /><div className="rtx-corner rtx-tr" />
        <div className="rtx-corner rtx-bl" /><div className="rtx-corner rtx-br" />

        {/* ── HEADER ── */}
        <div className="rtx-header">
          <div className="rtx-header-left">
            <div className="rtx-eyebrow"><span className="rtx-eyebrow-dot" />RETAILER RECORD</div>
            <h3 className="rtx-title">
              <span className="rtx-title-acc">//</span>
              {data ? data.shopName : "Loading…"}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data && onEdit && (
              <button type="button" className="rtx-btn-ghost" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="rtx-close" type="button" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="rtx-divider" />

        {/* ── BODY ── */}
        <div className="rtx-body">

          {error && <div className="rtx-alert">{error}</div>}

          {!data && !error && (
            <div className="rtx-loading">
              <div className="rtx-loader"><div/><div/><div/><div/></div>
              Loading retailer data…
            </div>
          )}

          {data && (
            <>
              {/* ── STATUS ROW ── */}
              <div className="rtx-view-status-row">
                <span className="rtx-code-badge">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {data.retailerCode}
                </span>
                {cs && <span className={`rtx-badge ${cs.cls}`}>{cs.label}</span>}
                <span className={`rtx-badge ${data.disable ? "rtx-badge-red" : "rtx-badge-green"}`}>
                  {data.disable ? "Inactive" : "Active"}
                </span>
                {parseFloat(data.outstandingBalance || 0) > 0 && (
                  <span className="rtx-badge rtx-badge-red">
                    ₹{fmt(data.outstandingBalance)} Outstanding
                  </span>
                )}
              </div>

              {/* ── CREDIT BAR ── */}
              <CreditBar creditLimit={data.creditLimit} outstandingBalance={data.outstandingBalance} />

              {/* ── INFO GRID ── */}
              <div className="rtx-view-grid">
                <Card label="Shop Name"           value={data.shopName} />
                <Card label="Owner Name"           value={data.ownerName} />
                <Card label="Phone"                value={data.phone} mono />
                <Card label="Email"                value={data.email} mono />
                <Card label="GST Number"           value={data.gstNumber} mono accent />
                <Card label="Drug License No"      value={data.drugLicenseNumber} mono />
                <Card label="Credit Limit"
                  value={parseFloat(data.creditLimit || 0) === 0 ? "Unlimited" : `₹${fmt(data.creditLimit)}`}
                  accent
                />
                <Card label="Outstanding Balance"
                  value={`₹${fmt(data.outstandingBalance)}`}
                  danger={parseFloat(data.outstandingBalance || 0) > 0}
                />
                <Card label="Created At"
                  value={data.createdAt
                    ? new Date(data.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"
                  }
                />
                <Card label="Updated At"
                  value={data.updatedAt
                    ? new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"
                  }
                />
                {data.address && <Card label="Address" value={data.address} full />}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {data && (
          <div className="rtx-footer">
            <button type="button" className="rtx-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
