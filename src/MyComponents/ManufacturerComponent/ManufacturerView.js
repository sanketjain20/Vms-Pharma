import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const Field = ({ label, value, mono, accent, full }) => (
  <div className={`afx-field ${full ? "afx-field--full" : ""}`}>
    <label className="afx-label">{label}</label>
    <div
      className={`afx-view-value ${mono ? "afx-view-value--mono" : ""}`}
      style={accent ? { color: "var(--afx-accent)", fontWeight: 600 } : undefined}
    >
      {value || <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

export default function ManufacturerView({ uKey, onClose, onEdit }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Manufacturer/GetManufacturerByUKey/${uKey}`, {
      method: "GET",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Manufacturer Record</div>
            <h3 className="afx-title">{data ? data.name : "Loading…"}</h3>
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
                  {data.manufacturerCode}
                </span>
                <span className="afx-badge" style={data.disable ? { color: "var(--afx-danger)" } : { color: "var(--afx-success)" }}>
                  {data.disable ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="afx-section-title">Details</div>
              <div className="afx-grid">
                <Field label="Manufacturer Name" value={data.name} />
                <Field label="Contact Person"     value={data.contactPerson} />
                <Field label="Phone"              value={data.phone} mono />
                <Field label="Email"              value={data.email} mono />
                <Field label="GST Number"         value={data.gstNumber} mono accent />
                <Field label="Drug License No"    value={data.drugLicenseNumber} mono />
                <Field label="Created At"
                  value={data.createdAt ? new Date(data.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                />
                <Field label="Updated At"
                  value={data.updatedAt ? new Date(data.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                />
                <Field label="Address" value={data.address} full />
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
