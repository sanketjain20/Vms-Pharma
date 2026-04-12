import React, { useState, useEffect } from "react";
import "../../Styles/Retailer/Retailer.css";
import { toast } from "react-toastify";

const FIELDS = [
  { key: "shopName",           label: "Shop Name",           type: "text",     required: true,  placeholder: "e.g. Sharma Medical Store" },
  { key: "ownerName",          label: "Owner Name",           type: "text",     required: false, placeholder: "e.g. Vijay Sharma" },
  { key: "phone",              label: "Phone",                type: "text",     required: false, placeholder: "e.g. 9876543210" },
  { key: "email",              label: "Email",                type: "email",    required: false, placeholder: "e.g. vijay@sharma.com" },
  { key: "gstNumber",          label: "GST Number",           type: "text",     required: false, placeholder: "e.g. 27AABCC1234A1Z5" },
  { key: "drugLicenseNumber",  label: "Drug License Number",  type: "text",     required: false, placeholder: "e.g. MH-MUM-DL-002" },
  { key: "creditLimit",        label: "Credit Limit (₹)",     type: "number",   required: false, placeholder: "0 = unlimited" },
  { key: "address",            label: "Address",              type: "textarea", required: false, placeholder: "Full shop address..." },
];

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: "" }), {});

export default function RetailerEdit({ uKey, onClose, onSubmit }) {
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [retailerCode, setRetailerCode] = useState("");
  const [outstanding, setOutstanding]   = useState(null);

  /* ── LOAD ── */
  useEffect(() => {
    if (!uKey) return;
    setFetching(true);
    fetch(`http://localhost:8080/api/Retailer/Get/${uKey}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) {
          const d = json.data;
          setRetailerCode(d.retailerCode || "");
          setOutstanding(d.outstandingBalance);
          setForm({
            shopName:          d.shopName          || "",
            ownerName:         d.ownerName         || "",
            phone:             d.phone             || "",
            email:             d.email             || "",
            gstNumber:         d.gstNumber         || "",
            drugLicenseNumber: d.drugLicenseNumber || "",
            creditLimit:       d.creditLimit != null ? String(d.creditLimit) : "",
            address:           d.address           || "",
          });
        } else {
          setErrors({ general: "Failed to load retailer data" });
        }
      })
      .catch(() => setErrors({ general: "Network error loading data" }))
      .finally(() => setFetching(false));
  }, [uKey]);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.shopName?.trim()) e.shopName = "Shop name is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email address";
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Invalid GST format";
    if (form.creditLimit && isNaN(parseFloat(form.creditLimit))) e.creditLimit = "Must be a number";
    if (form.creditLimit && parseFloat(form.creditLimit) < 0) e.creditLimit = "Cannot be negative";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await fetch(`http://localhost:8080/api/Retailer/Update/${uKey}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName:          form.shopName?.trim(),
          ownerName:         form.ownerName?.trim()         || null,
          phone:             form.phone                     || null,
          email:             form.email?.toLowerCase().trim() || null,
          gstNumber:         form.gstNumber ? form.gstNumber.toUpperCase().trim() : null,
          drugLicenseNumber: form.drugLicenseNumber         || null,
          address:           form.address                   || null,
          creditLimit:       form.creditLimit ? parseFloat(form.creditLimit) : 0,
        }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success("Retailer updated successfully");
        onSubmit?.(); onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to update retailer" });
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rtx-backdrop">
      <div className="rtx-modal">
        <div className="rtx-top-beam" />
        <div className="rtx-corner rtx-tl" /><div className="rtx-corner rtx-tr" />
        <div className="rtx-corner rtx-bl" /><div className="rtx-corner rtx-br" />

        {/* ── HEADER ── */}
        <div className="rtx-header">
          <div className="rtx-header-left">
            <div className="rtx-eyebrow"><span className="rtx-eyebrow-dot" />EDIT RETAILER</div>
            <h3 className="rtx-title">
              <span className="rtx-title-acc">//</span>
              Update Retailer
              {retailerCode && <span className="rtx-code-inline">{retailerCode}</span>}
            </h3>
          </div>
          <button className="rtx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="rtx-divider" />

        {/* ── BODY ── */}
        <div className="rtx-body">
          {fetching ? (
            <div className="rtx-loading">
              <div className="rtx-loader"><div/><div/><div/><div/></div>
              Loading retailer data…
            </div>
          ) : (
            <>
              {errors.general && <div className="rtx-alert">{errors.general}</div>}

              {/* Outstanding balance warning — read-only, not editable */}
              {outstanding != null && parseFloat(outstanding) > 0 && (
                <div className="rtx-outstanding-banner">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1L12 11.5H1L6.5 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M6.5 5v3M6.5 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Outstanding balance: <strong>₹{parseFloat(outstanding).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong>
                  — this is managed automatically through sales and payments
                </div>
              )}

              <div className="rtx-grid">
                {FIELDS.map(f => (
                  <div key={f.key} className={`rtx-field ${f.type === "textarea" ? "rtx-field-full" : ""}`}>
                    <label className="rtx-label">
                      {f.label}
                      {f.required && <span className="rtx-req"> *</span>}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        className={`rtx-input rtx-textarea ${errors[f.key] ? "rtx-input-err" : ""}`}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <input
                        className={`rtx-input ${errors[f.key] ? "rtx-input-err" : ""}`}
                        type={f.type}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        min={f.key === "creditLimit" ? "0" : undefined}
                      />
                    )}
                    {errors[f.key] && <span className="rtx-error">{errors[f.key]}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="rtx-footer">
          <button type="button" className="rtx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="rtx-btn-primary" onClick={submit} disabled={loading || fetching}>
            {loading
              ? <><span className="rtx-spinner" /> Updating…</>
              : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Update Retailer</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
