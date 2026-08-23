import React, { useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const FIELDS = [
  { key: "shopName",           label: "Shop Name",           type: "text",     required: true,  placeholder: "e.g. Sharma Medical Store" },
  { key: "ownerName",          label: "Owner Name",           type: "text",     required: false, placeholder: "e.g. Vijay Sharma" },
  { key: "phone",              label: "Phone",                type: "text",     required: true, placeholder: "e.g. 9876543210" },
  { key: "email",              label: "Email",                type: "email",    required: false, placeholder: "e.g. vijay@sharma.com" },
  { key: "gstNumber",          label: "GST Number",           type: "text",     required: false, placeholder: "e.g. 27AABCC1234A1Z5" },
  { key: "drugLicenseNumber",  label: "Drug License Number",  type: "text",     required: false, placeholder: "e.g. MH-MUM-DL-002" },
  { key: "creditLimit",        label: "Credit Limit (₹)",     type: "number",   required: false, placeholder: "0 = unlimited" },
  { key: "address",            label: "Address",              type: "textarea", required: false, placeholder: "Full shop address..." },
];

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: "" }), {});

export default function RetailerAdd({ onClose, onSubmit }) {
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.shopName?.trim())
      e.shopName = "Shop name is required";
    if(!form.phone?.trim())
      e.phone = "Phone number is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone))
      e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email address";
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Invalid GST format (e.g. 27AABCC1234A1Z5)";
    if (form.creditLimit && isNaN(parseFloat(form.creditLimit)))
      e.creditLimit = "Credit limit must be a number";
    if (form.creditLimit && parseFloat(form.creditLimit) < 0)
      e.creditLimit = "Credit limit cannot be negative";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await apiClient(`${API_BASE_URL}/api/Retailer/Add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName:           form.shopName?.trim(),
          ownerName:          form.ownerName?.trim() || null,
          phone:              form.phone              || null,
          email:              form.email?.toLowerCase().trim() || null,
          gstNumber:          form.gstNumber ? form.gstNumber.toUpperCase().trim() : null,
          drugLicenseNumber:  form.drugLicenseNumber  || null,
          address:            form.address            || null,
          creditLimit:        form.creditLimit ? parseFloat(form.creditLimit) : 0,
        }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success("Retailer created successfully");
        onSubmit?.(); onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to create retailer" });
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Retailer</div>
            <h3 className="afx-title">Add Retailer</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {errors.general && <div className="afx-alert">{errors.general}</div>}

          <div className="afx-info">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6.5 6v3M6.5 4h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Set Credit Limit to <strong>0</strong> for unlimited credit. Leave blank to set ₹0 limit.
          </div>

          <div className="afx-grid">
            {FIELDS.map(f => (
              <div key={f.key} className={`afx-field ${f.type === "textarea" ? "afx-field--full" : ""}`}>
                <label className="afx-label">
                  {f.label}
                  {f.required && <span className="afx-req">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    className={`afx-textarea ${errors[f.key] ? "afx-textarea--err" : ""}`}
                    value={form[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                  />
                ) : (
                  <input
                    className={`afx-input ${errors[f.key] ? "afx-input--err" : ""}`}
                    type={f.type}
                    value={form[f.key]}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    min={f.key === "creditLimit" ? "0" : undefined}
                  />
                )}
                {errors[f.key] && <span className="afx-error">{errors[f.key]}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="afx-spinner" /> Saving…</> : "Save Retailer"}
          </button>
        </div>
      </div>
    </div>
  );
}
