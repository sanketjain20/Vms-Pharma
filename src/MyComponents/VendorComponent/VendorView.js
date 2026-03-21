import React, { useEffect, useState } from "react";
import "../../Styles/Vendor/VendorView.css";
import { toast } from "react-toastify";

export default function VendorView({ uKey, onClose }) {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Vendor/GetVendorByUkey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
      .then(r => r.json())
      .then(res => {
        if (res.status === 200) setVendor(res.data);
        else toast.error(res.message || "Failed to load vendor");
      })
      .catch(() => toast.error("Network error"))
      .finally(() => setLoading(false));
  }, [uKey]);

  const isActive = vendor?.disable !== 1;

  /* ── field config ── */
  const fields = vendor ? [
    { label: "Name",                 value: vendor.name },
    { label: "Email",                value: vendor.email },
    { label: "Phone",                value: vendor.phone },
    { label: "Role",                 value: vendor.roleName },
    { label: "Shop Name",            value: vendor.shopName },
    { label: "Vendor Code",          value: vendor.vendorCode },
    { label: "Account Validity Till", value: vendor.expiryDate || "N/A" },
    { label: "Vendor Prefix",        value: vendor.vendorPrefix || "N/A" },
  ] : [];

  return (
    <div className="vv-backdrop">
      <div className="vv-modal">

        {/* Top beam */}
        <div className="vv-top-beam" />
        {/* Corners */}
        <div className="vv-corner vv-tl" /><div className="vv-corner vv-tr" />
        <div className="vv-corner vv-bl" /><div className="vv-corner vv-br" />

        {/* ── HEADER ── */}
        <div className="vv-header">
          <div className="vv-header-left">
            <div className="vv-eyebrow">
              <span className="vv-eyebrow-dot" />
              VENDOR RECORD
            </div>
            <h2 className="vv-title">
              <span className="vv-title-acc">//</span>
              {vendor?.vendorCode ? `Vendor · ${vendor.vendorCode}` : "View Vendor"}
            </h2>
          </div>
          <button className="vv-close" onClick={onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="vv-body">

          {/* LOADING */}
          {loading && (
            <div className="vv-loading">
              <div className="vv-loader-ring"><div/><div/><div/><div/></div>
              Loading vendor details…
            </div>
          )}

          {/* NOT FOUND */}
          {!loading && !vendor && (
            <div className="vv-empty">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.25)" strokeWidth="1.5"/>
                <path d="M14 9v6M14 18h.01" stroke="rgba(59,130,246,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Vendor not found
            </div>
          )}

          {/* DATA */}
          {!loading && vendor && (
            <>
              {/* Status badge row */}
              <div className="vv-status-row">
                <span className={`vv-status-badge ${isActive ? "vv-active" : "vv-inactive"}`}>
                  <span className="vv-status-dot" />
                  {isActive ? "Active" : "Inactive"}
                </span>
                <span className="vv-meta-info">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1"/>
                    <path d="M5 3v2.5L6.5 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  Read-only view
                </span>
              </div>

              {/* Fields grid */}
              <div className="vv-grid">
                {fields.map((f, i) => (
                  <div key={i} className="vv-field" style={{ animationDelay: `${i * 0.04}s` }}>
                    <span className="vv-field-label">{f.label}</span>
                    <div className="vv-field-value-wrap">
                      <input
                        type="text"
                        value={f.value || "—"}
                        readOnly
                        className="vv-field-input"
                      />
                    </div>
                  </div>
                ))}

                {/* Address — full width */}
                <div className="vv-field vv-full" style={{ animationDelay: `${fields.length * 0.04}s` }}>
                  <span className="vv-field-label">Address</span>
                  <textarea
                    rows={2}
                    value={vendor.address || "—"}
                    readOnly
                    className="vv-field-input"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="vv-footer">
          <button className="vv-btn-close" onClick={onClose}>Close</button>
        </div>

      </div>
    </div>
  );
}
