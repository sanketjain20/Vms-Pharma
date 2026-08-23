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

const OutstandingBadge = ({ amount }) => {
  const val = parseFloat(amount || 0);
  return (
    <span className={`afx-badge ${val > 0 ? "afx-text-danger" : "afx-text-success"}`}>
      {val > 0 ? `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Due` : "Cleared"}
    </span>
  );
};

export default function SupplierView({ uKey, onClose, onEdit }) {
  const [supplier, setSupplier] = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Supplier/GetSupplierByUKey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.status === 200) setSupplier(data.data);
        else setError(data.message || "Failed to fetch supplier");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Supplier Record</div>
            <h3 className="afx-title">{supplier ? supplier.shopName : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {supplier && onEdit && (
              <button className="afx-btn" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="afx-close" onClick={onClose} title="Close">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!supplier && !error && (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div/><div/><div/></div>
            </div>
          )}

          {supplier && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="afx-tag">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {supplier.supplierCode}
                </span>
                <OutstandingBadge amount={supplier.outstandingBalance} />
                <span className="afx-badge" style={supplier.disable ? { color: "var(--afx-danger)" } : { color: "var(--afx-success)" }}>
                  {supplier.disable ? "Inactive" : "Active"}
                </span>
              </div>

              <div className="afx-section-title">Details</div>
              <div className="afx-grid">
                <Field label="Shop Name"          value={supplier.shopName} />
                <Field label="Contact Person"      value={supplier.contactPerson} />
                <Field label="Phone"               value={supplier.phone} mono />
                <Field label="Email"               value={supplier.email} mono />
                <Field label="GST Number"          value={supplier.gstNumber} mono accent />
                <Field label="Drug License Number" value={supplier.drugLicenseNumber} mono />
                <Field label="Outstanding Balance"
                  value={supplier.outstandingBalance != null
                    ? `₹${parseFloat(supplier.outstandingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : "₹0.00"
                  }
                  accent={parseFloat(supplier.outstandingBalance || 0) > 0}
                />
                <Field label="Created At"
                  value={supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                />
                <Field label="Address" value={supplier.address} full />
              </div>
            </>
          )}
        </div>

        {supplier && (
          <div className="afx-footer">
            <button className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
