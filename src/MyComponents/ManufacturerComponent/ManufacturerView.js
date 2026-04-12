import React, { useEffect, useState } from "react";
import "../../Styles/Manufacturer/Manufacturer.css";

/* ── Info card ── */
const Card = ({ label, value, mono, accent, full }) => (
  <div className={`mfx-view-card ${full ? "mfx-view-card-full" : ""}`}>
    <span className="mfx-view-label">{label}</span>
    <span className={`mfx-view-value ${mono ? "mfx-mono" : ""} ${accent ? "mfx-accent" : ""}`}>
      {value || <span className="mfx-view-empty">—</span>}
    </span>
  </div>
);

export default function ManufacturerView({ uKey, onClose, onEdit }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Manufacturer/GetManufacturerByUKey/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (json?.status === 200) setData(json.data);
        else setError(json?.message || "Failed to fetch manufacturer");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="mfx-backdrop">
      <div className="mfx-modal mfx-modal-view">
        <div className="mfx-top-beam" />
        <div className="mfx-corner mfx-tl" /><div className="mfx-corner mfx-tr" />
        <div className="mfx-corner mfx-bl" /><div className="mfx-corner mfx-br" />

        {/* ── HEADER ── */}
        <div className="mfx-header">
          <div className="mfx-header-left">
            <div className="mfx-eyebrow"><span className="mfx-eyebrow-dot" />MANUFACTURER RECORD</div>
            <h3 className="mfx-title">
              <span className="mfx-title-acc">//</span>
              {data ? data.name : "Loading…"}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data && onEdit && (
              <button type="button" className="mfx-btn-ghost" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="mfx-close" type="button" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="mfx-divider" />

        {/* ── BODY ── */}
        <div className="mfx-body">

          {error && <div className="mfx-alert">{error}</div>}

          {!data && !error && (
            <div className="mfx-loading">
              <div className="mfx-loader"><div/><div/><div/><div/></div>
              Loading manufacturer data…
            </div>
          )}

          {data && (
            <>
              {/* ── STATUS ROW ── */}
              <div className="mfx-view-status-row">
                <span className="mfx-code-badge">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {data.manufacturerCode}
                </span>
                <span className={`mfx-badge ${data.disable ? "mfx-badge-red" : "mfx-badge-green"}`}>
                  {data.disable ? "Inactive" : "Active"}
                </span>
              </div>

              {/* ── INFO GRID ── */}
              <div className="mfx-view-grid">
                <Card label="Manufacturer Name" value={data.name} />
                <Card label="Contact Person"     value={data.contactPerson} />
                <Card label="Phone"              value={data.phone} mono />
                <Card label="Email"              value={data.email} mono />
                <Card label="GST Number"         value={data.gstNumber} mono accent />
                <Card label="Drug License No"    value={data.drugLicenseNumber} mono />
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
                <Card label="Address" value={data.address} full />
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {data && (
          <div className="mfx-footer">
            <button type="button" className="mfx-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
