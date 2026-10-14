import React, { useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const FIELDS = [
  { key: "name",              label: "Godown Name",       type: "text", required: true,  placeholder: "e.g. Main Warehouse" },
  { key: "contactPerson",     label: "Contact Person",     type: "text", required: false, placeholder: "e.g. Ramesh Kumar" },
  { key: "phone",             label: "Phone",              type: "text", required: false, placeholder: "e.g. 9876543210" },
  { key: "addressLine1",      label: "Address Line 1",     type: "text", required: false, placeholder: "Building, street" },
  { key: "addressLine2",      label: "Address Line 2",     type: "text", required: false, placeholder: "Area, landmark" },
  { key: "city",              label: "City",               type: "text", required: false, placeholder: "e.g. Pune" },
  { key: "state",             label: "State",              type: "text", required: false, placeholder: "e.g. Maharashtra" },
  { key: "pincode",           label: "Pincode",            type: "text", required: false, placeholder: "e.g. 411001" },
  { key: "drugLicenseNumber", label: "Drug License Number", type: "text", required: false, placeholder: "e.g. MH-PUN-DL-001" },
];

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: "" }), {});

export default function GodownAdd({ onClose, onSubmit }) {
  const [form, setForm]         = useState(EMPTY);
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())
      e.name = "Godown name is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone))
      e.phone = "Invalid phone number";
    if (form.pincode && !/^[0-9]{5,6}$/.test(form.pincode))
      e.pincode = "Invalid pincode";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await apiClient(`${API_BASE_URL}/api/Godown/Add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          isDefault,
        }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success("Godown created successfully");
        onSubmit?.();
        onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to create godown" });
      }
    } catch {
      // handled by the global unreachable-backend toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Godown</div>
            <h3 className="afx-title">Add Godown</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {errors.general && <div className="afx-alert">{errors.general}</div>}

          <div className="afx-grid">
            {FIELDS.map(f => (
              <div key={f.key} className="afx-field">
                <label className="afx-label">
                  {f.label}
                  {f.required && <span className="afx-req">*</span>}
                </label>
                <input
                  className={`afx-input ${errors[f.key] ? "afx-input--err" : ""}`}
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
                {errors[f.key] && <span className="afx-error">{errors[f.key]}</span>}
              </div>
            ))}

            <div className="afx-field">
              <label className="afx-label">Default Godown</label>
              <label className="afx-switch-row">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={e => setIsDefault(e.target.checked)}
                />
                <span className="afx-switch" />
                <span className="afx-switch-text">
                  {isDefault ? "Will be the default godown" : "Use as default godown"}
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="afx-spinner" /> Saving…</> : "Save Godown"}
          </button>
        </div>
      </div>
    </div>
  );
}
