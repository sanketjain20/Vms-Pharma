import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import DynamicGrid from "../CommonComponent/DynamicGrid";

// Phase 7 — supplier free-goods schemes ("buy 10 get 1 free" from a supplier). Purchase entry fills a line's Free
// quantity from the scheme that applies; it can still be changed by hand there.

const listOf = (json) => {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  return data && typeof data === "object" ? Object.values(data).find(Array.isArray) || [] : [];
};

const STATUS_LABEL = { ACTIVE: "Active", UPCOMING: "Starts later", EXPIRED: "Ended", OFF: "Switched off" };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { productId: "", supplierId: "", buyQuantity: "", freeQuantity: "", validFrom: today(), validTo: "", note: "" };
const SUPPLIER_SCHEME_MODULE_ID = "40"; // permissions 137–140 (View / Add / Edit / Disable)

/** The common grid's columns: six shown by default, the note added from the columns icon. */
export const SUPPLIER_SCHEME_COLUMNS = [
  { header: "Product", field: "productName", width: "180px" },
  { header: "Supplier", field: "supplierName", width: "170px" },
  { header: "Offer", field: "label", width: "150px" },
  { header: "Valid From", field: "validFrom", width: "120px" },
  { header: "Valid To", field: "validTo", width: "120px" },
  { header: "Status", field: "status", width: "120px", format: (s) => STATUS_LABEL[s] || s },
  { header: "Note", field: "note", width: "200px" },
  { header: "Actions", field: "Action", width: "120px" },
];

const refreshGrid = () => window.dispatchEvent(new Event("document-grid-refresh"));

export default function SupplierScheme() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(null); // { uKey?, ...fields } while the form is open

  useEffect(() => {
    Promise.allSettled([
      apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`).then((r) => r.json()),
      apiClient(`${API_BASE_URL}/api/Supplier/GetSupplierDropdown`).then((r) => r.json()),
    ]).then(([p, s]) => {
      setProducts(p.status === "fulfilled" ? listOf(p.value) : []);
      setSuppliers(s.status === "fulfilled" ? listOf(s.value) : []);
    });
  }, []);

  const toggle = async (row) => {
    const res = await apiClient(`${API_BASE_URL}/api/SupplierScheme/Toggle/${row.uKey}/${row.disable ? 0 : 1}`, { method: "POST" });
    const json = await res.json();
    if (json?.status === 200) { toast.success(json.message); refreshGrid(); } else toast.error(json?.message || "Could not change the scheme.");
  };

  const edit = (r) => setForm({ uKey: r.uKey, productId: String(r.productId), supplierId: r.supplierId ? String(r.supplierId) : "",
    buyQuantity: String(r.buyQuantity), freeQuantity: String(r.freeQuantity), validFrom: r.validFrom || today(),
    validTo: r.validTo || "", note: r.note || "" });

  // the grid's own action buttons: edit, and switch off / on (each only with its permission)
  const actions = (row, { can, ActionIcon }) => <>
    {can("Edit") && (
      <button className="dg-icon-btn dg-icon-btn--edit" title="Edit" aria-label="Edit" onClick={() => edit(row)}><ActionIcon.Edit /></button>
    )}
    {can("Disable") && (row.disable ? (
      <button className="dg-icon-btn dg-icon-btn--activate" title="Switch on" aria-label="Switch on" onClick={() => toggle(row)}><ActionIcon.Activate /></button>
    ) : (
      <button className="dg-icon-btn dg-icon-btn--disable" title="Switch off" aria-label="Switch off" onClick={() => toggle(row)}><ActionIcon.Disable /></button>
    ))}
  </>;

  return (
    <div className="i-container">
      <h2 className="i-title">🎁 SUPPLIER SCHEMES</h2>
      <p className="srl-note" style={{ marginBottom: 12 }}>
        Free goods a supplier gives, e.g. buy 10 get 1 free. When you enter a purchase from that supplier, the line's Free
        quantity is filled in for you.
      </p>

      <DynamicGrid
        columns={SUPPLIER_SCHEME_COLUMNS}
        apiUrl={`${API_BASE_URL}/api/SupplierScheme/GetAll`}
        noPagination
        Module="Supplier schemes"
        ModuleId={SUPPLIER_SCHEME_MODULE_ID}
        customActionsOnly
        extraActions={actions}
        customAddAction={() => setForm({ ...EMPTY })}
        customAddLabel="Add supplier scheme"
      />

      {form && <SchemeForm value={form} products={products} suppliers={suppliers} onClose={() => setForm(null)}
        onSaved={() => { setForm(null); refreshGrid(); }} />}
    </div>
  );
}

export function SchemeForm({ value, products, suppliers, onClose, onSaved }) {
  const [f, setF] = useState(value);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setF((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: "" })); };

  const save = async (e) => {
    e.preventDefault();
    const err = {};
    if (!f.productId) err.productId = "Choose the product";
    if (!(Number(f.buyQuantity) >= 1)) err.buyQuantity = "At least 1";
    if (!(Number(f.freeQuantity) >= 1)) err.freeQuantity = "At least 1";
    if (f.validTo && f.validFrom && f.validTo < f.validFrom) err.validTo = "Can't be before the start";
    if (Object.keys(err).length) { setErrors(err); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ productId: Number(f.productId), supplierId: f.supplierId ? Number(f.supplierId) : null,
        buyQuantity: Number(f.buyQuantity), freeQuantity: Number(f.freeQuantity), validFrom: f.validFrom || null,
        validTo: f.validTo || null, note: f.note || null });
      const res = await apiClient(`${API_BASE_URL}/api/SupplierScheme/${f.uKey ? `Update/${f.uKey}` : "Add"}`,
        { method: f.uKey ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body });
      const json = await res.json();
      if (json?.status === 200) { toast.success(json.message); onSaved(); } else toast.error(json?.message || "Could not save the scheme.");
    } catch {
      // handled by the global unreachable-backend toast
    } finally { setSaving(false); }
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md" role="dialog" aria-label="Supplier scheme">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Supplier scheme</div>
            <h3 className="afx-title">{f.uKey ? "Edit scheme" : "Add scheme"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">ESC</button>
        </div>
        <form onSubmit={save}>
          <div className="afx-body">
            <div className="afx-grid">
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-product">Product<span className="afx-req">*</span></label>
                <select id="ss-product" className="afx-select" value={f.productId} onChange={set("productId")}>
                  <option value="">— Select product —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.productId && <div className="afx-error">{errors.productId}</div>}
              </div>
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-supplier">Supplier</label>
                <select id="ss-supplier" className="afx-select" value={f.supplierId} onChange={set("supplierId")}>
                  <option value="">Any supplier</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.shopName || s.name}</option>)}
                </select>
              </div>
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-buy">Buy (units)<span className="afx-req">*</span></label>
                <input id="ss-buy" className="afx-input" type="number" min="1" value={f.buyQuantity} onChange={set("buyQuantity")} />
                {errors.buyQuantity && <div className="afx-error">{errors.buyQuantity}</div>}
              </div>
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-free">Get free (units)<span className="afx-req">*</span></label>
                <input id="ss-free" className="afx-input" type="number" min="1" value={f.freeQuantity} onChange={set("freeQuantity")} />
                {errors.freeQuantity && <div className="afx-error">{errors.freeQuantity}</div>}
              </div>
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-from">Valid from</label>
                <input id="ss-from" className="afx-input" type="date" value={f.validFrom} onChange={set("validFrom")} />
              </div>
              <div className="afx-field">
                <label className="afx-label" htmlFor="ss-to">Valid to (optional)</label>
                <input id="ss-to" className="afx-input" type="date" value={f.validTo} onChange={set("validTo")} />
                {errors.validTo && <div className="afx-error">{errors.validTo}</div>}
              </div>
              <div className="afx-field afx-field--full">
                <label className="afx-label" htmlFor="ss-note">Note</label>
                <input id="ss-note" className="afx-input" value={f.note} maxLength={200} onChange={set("note")} placeholder="e.g. Diwali offer" />
              </div>
              {Number(f.buyQuantity) >= 1 && Number(f.freeQuantity) >= 1 && (
                <div className="afx-info afx-field--full" data-testid="scheme-example">
                  Buying {Number(f.buyQuantity) * 3} gives {Number(f.freeQuantity) * 3} free.
                </div>
              )}
            </div>
          </div>
          <div className="afx-footer">
            <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
            <button className="afx-btn afx-btn--primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save scheme"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
