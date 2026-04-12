import React, { useState, useEffect } from "react";
import "../../Styles/Manufacturer/Manufacturer.css";
import { toast } from "react-toastify";

const FIELDS = [
  { key: "name",              label: "Manufacturer Name",   type: "text",     required: true,  placeholder: "e.g. Cipla Ltd" },
  { key: "contactPerson",     label: "Contact Person",       type: "text",     required: false, placeholder: "e.g. Ramesh Kumar" },
  { key: "phone",             label: "Phone",                type: "text",     required: false, placeholder: "e.g. 9876543210" },
  { key: "email",             label: "Email",                type: "email",    required: false, placeholder: "e.g. info@cipla.com" },
  { key: "gstNumber",         label: "GST Number",           type: "text",     required: false, placeholder: "e.g. 27AABCC1234A1Z5" },
  { key: "drugLicenseNumber", label: "Drug License Number",  type: "text",     required: false, placeholder: "e.g. MH-MUM-DL-001" },
  { key: "address",           label: "Address",              type: "textarea", required: false, placeholder: "Full registered address..." },
];

const EMPTY = FIELDS.reduce((a, f) => ({ ...a, [f.key]: "" }), {});

export default function ManufacturerEdit({ uKey, onClose, onSubmit }) {
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [mfrCode, setMfrCode]   = useState("");

  /* ── LOAD ── */
  useEffect(() => {
    if (!uKey) return;
    setFetching(true);
    fetch(`http://localhost:8080/api/Manufacturer/GetManufacturerByUKey/${uKey}`, {
      credentials: "include",
    })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) {
          const d = json.data;
          setMfrCode(d.manufacturerCode || "");
          setForm({
            name:              d.name              || "",
            contactPerson:     d.contactPerson     || "",
            phone:             d.phone             || "",
            email:             d.email             || "",
            gstNumber:         d.gstNumber         || "",
            drugLicenseNumber: d.drugLicenseNumber || "",
            address:           d.address           || "",
          });
        } else {
          setErrors({ general: "Failed to load manufacturer data" });
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
    if (!form.name.trim())
      e.name = "Manufacturer name is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone))
      e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "Invalid email address";
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Invalid GST format (e.g. 27AABCC1234A1Z5)";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await fetch(`http://localhost:8080/api/Manufacturer/UpdateManufacturer/${uKey}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          gstNumber: form.gstNumber ? form.gstNumber.toUpperCase().trim() : null,
          name:      form.name.trim(),
        }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success("Manufacturer updated successfully");
        onSubmit?.();
        onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to update manufacturer" });
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mfx-backdrop">
      <div className="mfx-modal">
        <div className="mfx-top-beam" />
        <div className="mfx-corner mfx-tl" /><div className="mfx-corner mfx-tr" />
        <div className="mfx-corner mfx-bl" /><div className="mfx-corner mfx-br" />

        {/* ── HEADER ── */}
        <div className="mfx-header">
          <div className="mfx-header-left">
            <div className="mfx-eyebrow"><span className="mfx-eyebrow-dot" />EDIT MANUFACTURER</div>
            <h3 className="mfx-title">
              <span className="mfx-title-acc">//</span>
              Update Manufacturer
              {mfrCode && <span className="mfx-code-inline">{mfrCode}</span>}
            </h3>
          </div>
          <button className="mfx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="mfx-divider" />

        {/* ── BODY ── */}
        <div className="mfx-body">
          {fetching ? (
            <div className="mfx-loading">
              <div className="mfx-loader"><div/><div/><div/><div/></div>
              Loading manufacturer data…
            </div>
          ) : (
            <>
              {errors.general && <div className="mfx-alert">{errors.general}</div>}
              <div className="mfx-grid">
                {FIELDS.map(f => (
                  <div key={f.key} className={`mfx-field ${f.type === "textarea" ? "mfx-field-full" : ""}`}>
                    <label className="mfx-label">
                      {f.label}
                      {f.required && <span className="mfx-req"> *</span>}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        className={`mfx-input mfx-textarea ${errors[f.key] ? "mfx-input-err" : ""}`}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <input
                        className={`mfx-input ${errors[f.key] ? "mfx-input-err" : ""}`}
                        type={f.type}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {errors[f.key] && <span className="mfx-error">{errors[f.key]}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="mfx-footer">
          <button type="button" className="mfx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="mfx-btn-primary" onClick={submit} disabled={loading || fetching}>
            {loading
              ? <><span className="mfx-spinner" /> Updating…</>
              : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Update Manufacturer</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
