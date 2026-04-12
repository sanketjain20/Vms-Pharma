import React, { useEffect, useState } from "react";
import "../../Styles/Supplier/Supplier.css";

/* ── Info card helper ── */
const InfoCard = ({ label, value, mono, accent, full }) => (
  <div className={`sup-view-card ${full ? "sup-view-card-full" : ""}`}>
    <span className="sup-view-label">{label}</span>
    <span className={`sup-view-value ${mono ? "sup-view-mono" : ""} ${accent ? "sup-view-accent" : ""}`}>
      {value || <span className="sup-view-empty">—</span>}
    </span>
  </div>
);

/* ── Outstanding badge ── */
const OutstandingBadge = ({ amount }) => {
  const val = parseFloat(amount || 0);
  const color = val > 0 ? "sup-badge-red" : "sup-badge-green";
  return (
    <span className={`sup-badge ${color}`}>
      {val > 0 ? `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 2 })} Due` : "Cleared"}
    </span>
  );
};

export default function SupplierView({ uKey, onClose, onEdit }) {
  const [supplier, setSupplier] = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Supplier/GetSupplierByUKey/${uKey}`, {
      method: "GET", credentials: "include",
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
    <div className="sup-backdrop">
      <div className="sup-modal sup-modal-view">
        <div className="sup-top-beam" />
        <div className="sup-corner sup-tl" /><div className="sup-corner sup-tr" />
        <div className="sup-corner sup-bl" /><div className="sup-corner sup-br" />

        {/* ── HEADER ── */}
        <div className="sup-header">
          <div className="sup-header-left">
            <div className="sup-eyebrow"><span className="sup-eyebrow-dot" />SUPPLIER RECORD</div>
            <h3 className="sup-title">
              <span className="sup-title-acc">//</span>
              {supplier ? supplier.shopName : "Loading…"}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {supplier && onEdit && (
              <button className="sup-btn-ghost" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="sup-close" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="sup-divider" />

        {/* ── BODY ── */}
        <div className="sup-body">
          {error && <div className="sup-alert sup-alert-error">{error}</div>}

          {!supplier && !error && (
            <div className="sup-loading">
              <div className="sup-loader"><div/><div/><div/><div/></div>
              Loading supplier data…
            </div>
          )}

          {supplier && (
            <>
              {/* ── SUPPLIER CODE + STATUS ROW ── */}
              <div className="sup-view-status-row">
                <div className="sup-code-badge">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {supplier.supplierCode}
                </div>
                <OutstandingBadge amount={supplier.outstandingBalance} />
                <span className={`sup-badge ${supplier.disable ? "sup-badge-red" : "sup-badge-green"}`}>
                  {supplier.disable ? "Inactive" : "Active"}
                </span>
              </div>

              {/* ── INFO GRID ── */}
              <div className="sup-view-grid">
                <InfoCard label="Shop Name"          value={supplier.shopName} />
                <InfoCard label="Contact Person"      value={supplier.contactPerson} />
                <InfoCard label="Phone"               value={supplier.phone} mono />
                <InfoCard label="Email"               value={supplier.email} mono />
                <InfoCard label="GST Number"          value={supplier.gstNumber} mono accent />
                <InfoCard label="Drug License Number" value={supplier.drugLicenseNumber} mono />
                <InfoCard label="Outstanding Balance"
                  value={supplier.outstandingBalance != null
                    ? `₹${parseFloat(supplier.outstandingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                    : "₹0.00"
                  }
                  accent={parseFloat(supplier.outstandingBalance || 0) > 0}
                />
                <InfoCard label="Created At"
                  value={supplier.createdAt
                    ? new Date(supplier.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"
                  }
                />
                <InfoCard label="Address" value={supplier.address} full />
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {supplier && (
          <div className="sup-footer">
            <button className="sup-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
