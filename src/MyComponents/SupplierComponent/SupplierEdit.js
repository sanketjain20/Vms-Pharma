import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { getApiMessage, toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const FIELD_META = [
  { key: "shopName",           label: "Shop Name",           type: "text",     required: true,  placeholder: "e.g. Cipla Distributors Pvt Ltd" },
  { key: "contactPerson",      label: "Contact Person",       type: "text",     required: false, placeholder: "e.g. Ramesh Kumar" },
  { key: "phone",              label: "Phone",                type: "text",     required: true, placeholder: "e.g. 9876543210" },
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
    apiClient(`${API_BASE_URL}/api/Supplier/GetSupplierByUKey/${uKey}`, {
      method: "GET",
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
          toast.error("Failed to load supplier data");
        }
      })
      .catch(() => {
        setErrors({ general: "Network error loading supplier" });
        toast.error("Network error loading supplier");
      })
      .finally(() => setFetching(false));
  }, [uKey]);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.shopName.trim()) e.shopName = "Shop name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) e.phone = "Invalid phone number";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (form.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Invalid GST format (e.g. 27AAPFU0939F1ZV)";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error(Object.values(e)[0]);
      return;
    }
    setLoading(true);
    try {
      const res  = await apiClient(`${API_BASE_URL}/api/Supplier/UpdateSupplier/${uKey}/1`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, gstNumber: form.gstNumber?.toUpperCase() || null }),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success(json?.message || "Supplier updated successfully");
        onSubmit();
        onClose();
      } else {
        const message = getApiMessage(json, "Failed to update supplier");
        setErrors({ general: message });
        toastApiError(json, "Failed to update supplier");
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
      toast.error("Network error. Please try again.");
    }
    finally { setLoading(false); }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        {fetching ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Supplier</div>
                <h3 className="afx-title">Update Supplier</h3>
              </div>
              <button className="afx-close" onClick={onClose}>
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                ESC
              </button>
            </div>

            <div className="afx-body">
              {errors.general && <div className="afx-alert">{errors.general}</div>}

              <div className="afx-grid">
                {FIELD_META.map(f => (
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
                      />
                    )}
                    {errors[f.key] && <span className="afx-error">{errors[f.key]}</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="afx-footer">
              <button className="afx-btn" onClick={onClose}>Cancel</button>
              <button className="afx-btn afx-btn--primary" onClick={submit} disabled={loading}>
                {loading ? <><span className="afx-spinner" /> Updating…</> : "Update Supplier"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
