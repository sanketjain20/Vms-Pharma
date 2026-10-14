import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const TYPES = [
  { id: "FREE_QUANTITY",    label: "Free quantity",       sub: "e.g. Buy 10 Get 1 free" },
  { id: "PERCENT_DISCOUNT", label: "Percentage discount", sub: "e.g. 10% off" },
];

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = {
  name: "", schemeType: "FREE_QUANTITY", productId: "", retailerId: "",
  buyQuantity: "", freeQuantity: "", discountPercent: "", repeatable: true,
  validFrom: today(), validTo: "",
};

const whole = (v) => /^[0-9]+$/.test(String(v).trim());

/** Mirrors the server's checks so a mistake is shown at once; the server still has the last word. */
export function validateScheme(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Give the scheme a name";
  if (!f.validFrom) e.validFrom = "Choose the start date";
  if (f.validFrom && f.validTo && f.validTo < f.validFrom) e.validTo = "End date cannot be before the start date";
  if (f.schemeType === "FREE_QUANTITY") {
    if (!whole(f.buyQuantity) || Number(f.buyQuantity) < 1) e.buyQuantity = "Enter a whole number, 1 or more";
    if (!whole(f.freeQuantity) || Number(f.freeQuantity) < 1) e.freeQuantity = "Enter a whole number, 1 or more";
  } else {
    const pct = Number(f.discountPercent);
    if (f.discountPercent === "" || !(pct > 0) || pct > 100) e.discountPercent = "Must be more than 0 and at most 100";
    if (f.buyQuantity !== "" && (!whole(f.buyQuantity) || Number(f.buyQuantity) < 1)) e.buyQuantity = "Whole number, 1 or more, or leave empty";
  }
  return e;
}

export function toRequest(f) {
  const free = f.schemeType === "FREE_QUANTITY";
  return {
    name: f.name.trim(),
    schemeType: f.schemeType,
    productId: f.productId ? Number(f.productId) : null,
    retailerId: f.retailerId ? Number(f.retailerId) : null,
    buyQuantity: f.buyQuantity === "" ? null : Number(f.buyQuantity),
    freeQuantity: free ? Number(f.freeQuantity) : null,
    discountPercent: free ? null : Number(f.discountPercent),
    repeatable: free ? !!f.repeatable : true,
    validFrom: f.validFrom,
    validTo: f.validTo || null,
  };
}

export default function SchemeForm({ uKey, onClose, onSubmit }) {
  const editing = !!uKey;
  const [form, setForm]         = useState(EMPTY);
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(editing);
  const [products, setProducts]   = useState([]);
  const [retailers, setRetailers] = useState([]);

  const set = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, { method: "GET" })
      .then(r => r.json())
      .then(json => {
        const d = json?.data;
        setProducts(Array.isArray(d) ? d : (d && Object.values(d).find(Array.isArray)) || []);
      })
      .catch(() => {});
    apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`, { method: "GET" })
      .then(r => r.json())
      .then(json => setRetailers(json?.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!uKey) return;
    setFetching(true);
    apiClient(`${API_BASE_URL}/api/Scheme/GetByUKey/${uKey}`, { method: "GET" })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) {
          const d = json.data;
          setForm({
            name: d.name || "",
            schemeType: d.schemeType,
            productId: d.productId ?? "",
            retailerId: d.retailerId ?? "",
            buyQuantity: d.buyQuantity ?? "",
            freeQuantity: d.freeQuantity ?? "",
            discountPercent: d.discountPercent ?? "",
            repeatable: d.repeatable !== false,
            validFrom: d.validFrom || "",
            validTo: d.validTo || "",
          });
        } else {
          setErrors({ general: json?.message || "Failed to load the scheme" });
        }
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [uKey]);

  const submit = async () => {
    const e = validateScheme(form);
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res = await apiClient(
        editing ? `${API_BASE_URL}/api/Scheme/Update/${uKey}` : `${API_BASE_URL}/api/Scheme/Add`,
        { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toRequest(form)) }
      );
      const json = await res.json();
      if (json?.status === 200) {
        toast.success(json.message || (editing ? "Scheme updated" : "Scheme added"));
        onSubmit?.();
        onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to save the scheme" });
      }
    } catch {
      // handled by the global unreachable-backend toast
    } finally {
      setLoading(false);
    }
  };

  const free = form.schemeType === "FREE_QUANTITY";
  const err = (k) => errors[k] && <span className="afx-error">{errors[k]}</span>;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />{editing ? "Edit Scheme" : "New Scheme"}</div>
            <h3 className="afx-title">{editing ? "Update Scheme" : "Add Scheme"}</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {fetching ? (
            <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
          ) : (
            <>
              {errors.general && <div className="afx-alert">{errors.general}</div>}
              <div className="afx-grid">
                <div className="afx-field afx-field--full">
                  <label className="afx-label">Scheme name<span className="afx-req">*</span></label>
                  <input className={`afx-input ${errors.name ? "afx-input--err" : ""}`} value={form.name}
                    onChange={e => set("name", e.target.value)} placeholder="e.g. Diwali Buy 10 Get 1" maxLength={150} />
                  {err("name")}
                </div>

                <div className="afx-field afx-field--full">
                  <label className="afx-label">What does the retailer get?</label>
                  <div className="afx-seg-row">
                    {TYPES.map(t => (
                      <button key={t.id} type="button" title={t.sub}
                        className={`afx-seg-btn ${form.schemeType === t.id ? "is-active" : ""}`}
                        onClick={() => set("schemeType", t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>

                {free ? (
                  <>
                    <div className="afx-field">
                      <label className="afx-label">Buy (quantity)<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.buyQuantity ? "afx-input--err" : ""}`} inputMode="numeric" value={form.buyQuantity}
                        onChange={e => set("buyQuantity", e.target.value)} placeholder="e.g. 10" />
                      {err("buyQuantity")}
                    </div>
                    <div className="afx-field">
                      <label className="afx-label">Get free (quantity)<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.freeQuantity ? "afx-input--err" : ""}`} inputMode="numeric" value={form.freeQuantity}
                        onChange={e => set("freeQuantity", e.target.value)} placeholder="e.g. 1" />
                      {err("freeQuantity")}
                    </div>
                    <div className="afx-field afx-field--full">
                      <label className="afx-switch-row">
                        <input type="checkbox" checked={form.repeatable} onChange={e => set("repeatable", e.target.checked)} />
                        <span className="afx-switch" />
                        <span className="afx-switch-text">
                          {form.repeatable ? "Repeats: buy 20 gets 2 free" : "Once per bill line: buy 20 still gets 1 free"}
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="afx-field">
                      <label className="afx-label">Discount %<span className="afx-req">*</span></label>
                      <input className={`afx-input ${errors.discountPercent ? "afx-input--err" : ""}`} inputMode="decimal" value={form.discountPercent}
                        onChange={e => set("discountPercent", e.target.value)} placeholder="e.g. 10" />
                      {err("discountPercent")}
                    </div>
                    <div className="afx-field">
                      <label className="afx-label">Minimum quantity (optional)</label>
                      <input className={`afx-input ${errors.buyQuantity ? "afx-input--err" : ""}`} inputMode="numeric" value={form.buyQuantity}
                        onChange={e => set("buyQuantity", e.target.value)} placeholder="any quantity" />
                      {err("buyQuantity")}
                    </div>
                  </>
                )}

                <div className="afx-field">
                  <label className="afx-label">Product</label>
                  <select className="afx-select" value={form.productId} onChange={e => set("productId", e.target.value)}>
                    <option value="">All products</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Retailer</label>
                  <select className="afx-select" value={form.retailerId} onChange={e => set("retailerId", e.target.value)}>
                    <option value="">All retailers</option>
                    {retailers.map(r => <option key={r.id} value={r.id}>{r.shopName}{r.ownerName ? ` · ${r.ownerName}` : ""}</option>)}
                  </select>
                </div>

                <div className="afx-field">
                  <label className="afx-label">Valid from<span className="afx-req">*</span></label>
                  <input type="date" className={`afx-input ${errors.validFrom ? "afx-input--err" : ""}`} value={form.validFrom}
                    onChange={e => set("validFrom", e.target.value)} />
                  {err("validFrom")}
                </div>
                <div className="afx-field">
                  <label className="afx-label">Valid to (optional)</label>
                  <input type="date" className={`afx-input ${errors.validTo ? "afx-input--err" : ""}`} value={form.validTo}
                    onChange={e => set("validTo", e.target.value)} />
                  {err("validTo")}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={submit} disabled={loading || fetching}>
            {loading ? <><span className="afx-spinner" /> Saving…</> : editing ? "Update Scheme" : "Save Scheme"}
          </button>
        </div>
      </div>
    </div>
  );
}
