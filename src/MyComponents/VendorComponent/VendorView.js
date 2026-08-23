import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function VendorView({ uKey, onClose }) {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Vendor/GetVendorByUkey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
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
  const formatBool = value => value === true ? "Yes" : value === false ? "No" : "N/A";
  const isMasterVendor = vendor?.masterVendor === true;

  /* ── field config ── */
  const fields = vendor ? [
    { label: "Name",                  value: vendor.name },
    { label: "Email",                 value: vendor.email },
    { label: "Phone",                 value: vendor.phone },
    { label: "Role",                  value: vendor.roleName },
    { label: "Shop Name",             value: vendor.shopName },
    { label: "Vendor Code",           value: vendor.vendorCode },
    { label: "Account Validity Till", value: vendor.expiryDate || "N/A" },
    ...(isMasterVendor ? [{ label: "Vendor Prefix", value: vendor.vendorPrefix || "N/A" }] : []),
    ...(isMasterVendor ? [{ label: "Master Vendor", value: formatBool(vendor.masterVendor) }] : []),
    ...(isMasterVendor ? [{ label: "Worker Limit", value: vendor.subVendorLimit ?? 0 }] : []),
  ] : [];

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Vendor Record</div>
            <h3 className="afx-title">{vendor?.vendorCode ? `Vendor · ${vendor.vendorCode}` : "View Vendor"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {loading ? (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div/><div/><div/></div>
            </div>
          ) : !vendor ? (
            <div className="afx-items-empty">Vendor not found</div>
          ) : (
            <>
              <div className="afx-option-row" style={{ justifyContent: "flex-start" }}>
                <span
                  className="afx-badge"
                  style={{
                    background: isActive ? "var(--afx-success-soft)" : "var(--afx-danger-soft)",
                    color: isActive ? "var(--afx-success)" : "var(--afx-danger)",
                  }}
                >
                  {isActive ? "Active" : "Inactive"}
                </span>
                <span style={{ color: "var(--afx-text-3)", fontSize: 11.5 }}>Read-only view</span>
              </div>

              <div className="afx-grid">
                {fields.map((f, i) => (
                  <div key={i} className="afx-field">
                    <label className="afx-label">{f.label}</label>
                    <div className="afx-view-value">{f.value || <span className="afx-view-value--empty">—</span>}</div>
                  </div>
                ))}

                <div className="afx-field afx-field--full">
                  <label className="afx-label">Address</label>
                  <div className="afx-view-value">{vendor.address || <span className="afx-view-value--empty">—</span>}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="afx-footer">
          <button className="afx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
