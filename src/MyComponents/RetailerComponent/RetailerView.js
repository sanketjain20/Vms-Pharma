import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Info field ── */
const Field = ({ label, value, mono, accent, danger, full }) => (
  <div className={`afx-field ${full ? "afx-field--full" : ""}`}>
    <label className="afx-label">{label}</label>
    <div
      className={`afx-view-value ${mono ? "afx-view-value--mono" : ""}`}
      style={accent ? { color: "var(--afx-accent)", fontWeight: 600 } : danger ? { color: "var(--afx-danger)", fontWeight: 600 } : undefined}
    >
      {value || <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

/* ── Credit usage bar ── */
const CreditBar = ({ creditLimit, outstandingBalance }) => {
  const limit = parseFloat(creditLimit || 0);
  const used  = parseFloat(outstandingBalance || 0);
  const avail = Math.max(limit - used, 0);
  const pct   = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct >= 100 ? "var(--afx-danger)" : pct >= 80 ? "var(--afx-warning)" : "var(--afx-success)";

  if (limit === 0) {
    return (
      <div className="afx-card">
        <div className="afx-card-row">
          <span>Credit Limit</span>
          <span className="afx-badge">Unlimited</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--afx-sunken)", border: "1px solid var(--afx-border)", overflow: "hidden" }}>
          <div style={{ width: "30%", height: "100%", background: "var(--afx-success)" }} />
        </div>
        <div className="afx-card-row">
          <span>Outstanding</span>
          <strong className={used > 0 ? "afx-text-danger" : "afx-text-success"}>₹{used.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="afx-card">
      <div className="afx-card-row">
        <span>Credit Usage</span>
        <span style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11, color: barColor }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--afx-sunken)", border: "1px solid var(--afx-border)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor }} />
      </div>
      <div className="afx-card-row">
        <span>Used: <strong className="afx-text-danger">₹{used.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
        <span>Available: <strong className="afx-text-success">₹{avail.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
        <span>Limit: <strong>₹{limit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
      </div>
    </div>
  );
};

/* ── Credit status ── */
const creditStatus = (creditLimit, outstanding) => {
  const limit = parseFloat(creditLimit || 0);
  const used  = parseFloat(outstanding || 0);
  if (limit === 0) return { label: "Unlimited", cls: "" };
  const pct = (used / limit) * 100;
  if (pct >= 100) return { label: "Limit Reached", cls: "afx-text-danger" };
  if (pct >= 80)  return { label: "Warning", cls: "" };
  return { label: "OK", cls: "afx-text-success" };
};

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function RetailerView({ uKey, onClose, onEdit }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Retailer/Get/${uKey}`, {
      method: "GET",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Retailer Record</div>
            <h3 className="afx-title">{data ? data.shopName : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data && onEdit && (
              <button type="button" className="afx-btn" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="afx-close" type="button" onClick={onClose} title="Close">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!data && !error && (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div/><div/><div/></div>
            </div>
          )}

          {data && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="afx-tag">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {data.retailerCode}
                </span>
                {cs && <span className={`afx-badge ${cs.cls}`}>{cs.label}</span>}
                <span className="afx-badge" style={data.disable ? { color: "var(--afx-danger)" } : { color: "var(--afx-success)" }}>
                  {data.disable ? "Inactive" : "Active"}
                </span>
                {parseFloat(data.outstandingBalance || 0) > 0 && (
                  <span className="afx-badge afx-text-danger">₹{fmt(data.outstandingBalance)} Outstanding</span>
                )}
              </div>

              <CreditBar creditLimit={data.creditLimit} outstandingBalance={data.outstandingBalance} />

              <div className="afx-section-title">Details</div>
              <div className="afx-grid">
                <Field label="Shop Name"      value={data.shopName} />
                <Field label="Owner Name"     value={data.ownerName} />
                <Field label="Phone"          value={data.phone} mono />
                <Field label="Email"          value={data.email} mono />
                <Field label="GST Number"     value={data.gstNumber} mono accent />
                <Field label="Drug License No" value={data.drugLicenseNumber} mono />
                <Field label="Credit Limit"
                  value={parseFloat(data.creditLimit || 0) === 0 ? "Unlimited" : `₹${fmt(data.creditLimit)}`}
                  accent
                />
                <Field label="Outstanding Balance"
                  value={`₹${fmt(data.outstandingBalance)}`}
                  danger={parseFloat(data.outstandingBalance || 0) > 0}
                />
                <Field label="Created At"
                  value={data.createdAt ? new Date(data.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                />
                <Field label="Updated At"
                  value={data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                />
                {data.address && <Field label="Address" value={data.address} full />}
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
