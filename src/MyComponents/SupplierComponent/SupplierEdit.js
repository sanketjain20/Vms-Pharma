import React, { useState, useEffect } from "react";
import "../../Styles/Supplier/Supplier.css";

const FIELD_META = [
  { key: "shopName",           label: "Shop Name",           type: "text",     required: true,  placeholder: "e.g. Cipla Distributors Pvt Ltd" },
  { key: "contactPerson",      label: "Contact Person",       type: "text",     required: false, placeholder: "e.g. Ramesh Kumar" },
  { key: "phone",              label: "Phone",                type: "text",     required: false, placeholder: "e.g. 9876543210" },
  { key: "email",              label: "Email",                type: "email",    required: false, placeholder: "e.g. ramesh@cipla.com" },
  { key: "gstNumber",          label: "GST Number",           type: "text",     required: false, placeholder: "e.g. 27AAPFU0939F1ZV" },
  { key: "drugLicenseNumber",  label: "Drug License Number",  type: "text",     required: false, placeholder: "e.g. MH-MUM-123456" },
  { key: "address",            label: "Address",              type: "textarea", required: false, placeholder: "Full address..." },
];

const EMPTY = FIELD_META.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {});

export default function SupplierEdit({ uKey, onClose, onSubmit }) {
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  /* ── LOAD existing supplier ── */
  useEffect(() => {
    if (!uKey) return;
    setFetching(true);
    fetch(`http://localhost:8080/api/Supplier/GetSupplierByUKey/${uKey}`, {
      method: "GET", credentials: "include",
    })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) {
          const d = json.data;
          setForm({
            shopName:          d.shopName          || "",
            contactPerson:     d.contactPerson      || "",
            phone:             d.phone              || "",
            email:             d.email              || "",
            gstNumber:         d.gstNumber          || "",
            drugLicenseNumber: d.drugLicenseNumber  || "",
            address:           d.address            || "",
          });
        } else {
          setErrors({ general: "Failed to load supplier data" });
        }
      })
      .catch(() => setErrors({ general: "Network error loading supplier" }))
      .finally(() => setFetching(false));
  }, [uKey]);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.shopName.trim()) e.shopName = "Shop name is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Invalid GST format (e.g. 27AAPFU0939F1ZV)";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await fetch(`http://localhost:8080/api/Supplier/UpdateSupplier/${uKey}/1`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, gstNumber: form.gstNumber?.toUpperCase() || null }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) { onSubmit(); onClose(); }
      else setErrors({ general: json?.message || "Failed to update supplier" });
    } catch { setErrors({ general: "Network error. Please try again." }); }
    finally { setLoading(false); }
  };

  return (
    <div className="sup-backdrop">
      <div className="sup-modal">
        <div className="sup-top-beam" />
        <div className="sup-corner sup-tl" /><div className="sup-corner sup-tr" />
        <div className="sup-corner sup-bl" /><div className="sup-corner sup-br" />

        {/* ── HEADER ── */}
        <div className="sup-header">
          <div className="sup-header-left">
            <div className="sup-eyebrow"><span className="sup-eyebrow-dot" />EDIT SUPPLIER</div>
            <h3 className="sup-title"><span className="sup-title-acc">//</span> Update Supplier</h3>
          </div>
          <button className="sup-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="sup-divider" />

        {/* ── BODY ── */}
        <div className="sup-body">
          {fetching ? (
            <div className="sup-loading">
              <div className="sup-loader"><div/><div/><div/><div/></div>
              Loading supplier data…
            </div>
          ) : (
            <>
              {errors.general && (
                <div className="sup-alert sup-alert-error">{errors.general}</div>
              )}
              <div className="sup-grid">
                {FIELD_META.map(f => (
                  <div key={f.key} className={`sup-field ${f.type === "textarea" ? "sup-field-full" : ""}`}>
                    <label className="sup-label">
                      {f.label}
                      {f.required && <span className="sup-required">*</span>}
                    </label>
                    {f.type === "textarea" ? (
                      <textarea
                        className={`sup-input sup-textarea ${errors[f.key] ? "sup-input-error" : ""}`}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <input
                        className={`sup-input ${errors[f.key] ? "sup-input-error" : ""}`}
                        type={f.type}
                        value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {errors[f.key] && <span className="sup-error">{errors[f.key]}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="sup-footer">
          <button className="sup-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sup-btn-primary" onClick={submit} disabled={loading || fetching}>
            {loading ? (
              <><span className="sup-spinner" /> Updating…</>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Update Supplier
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
