import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { toastApiError } from "../../utils/toastMessage";

/* ── Searchable dropdown (self-contained copy — mirrors PurchaseAdd's widget,
   kept separate per the no-shared-components requirement). ── */
const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen, getLabel }) => {
  const [search, setSearch] = useState("");
  const label = getLabel || (o => o.name || o.shopName || o.supplierName || o.retailerName || o.godownName || o.productName || o.id);
  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o => (label(o) || "").toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="afx-searchdrop" ref={dropRef}>
      <div
        className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selected ? "is-filled" : ""}`}
        onClick={() => { if (!open) setSearch(""); setOpen(!open); }}
      >
        <span>{selected ? label(selected) : placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {open && (
        <div className="afx-searchdrop-panel">
          <input
            className="afx-searchdrop-input"
            autoFocus
            value={search}
            placeholder="Search…"
            onChange={e => setSearch(e.target.value)}
          />
          <div className="afx-searchdrop-list">
            {filtered.length === 0 ? (
              <div className="afx-searchdrop-empty">No results</div>
            ) : filtered.map(o => (
              <div
                key={o.id}
                className={`afx-searchdrop-item ${o.id === value ? "is-selected" : ""}`}
                onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); setSearch(""); }}
              >
                {label(o)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const EMPTY_ITEM = { productId: "", productName: "", quantity: 1, unitPrice: "" };

function extractList(json) {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.values(data).find(v => Array.isArray(v)) || [];
  return [];
}

export default function DeliveryChallanAdd({ onSubmit, onClose }) {
  const [retailers, setRetailers] = useState([]);
  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("DETAILS");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [retailerOpen, setRetailerOpen] = useState(false);
  const [godownOpen, setGodownOpen] = useState(false);
  const [productOpenIdx, setProductOpenIdx] = useState(null);
  const retailerRef = useRef(null);
  const godownRef = useRef(null);
  const productRefs = useRef([]);

  const [form, setForm] = useState({
    retailerId: "",
    godownId: "",
    salesOrderUKey: "",
    date: new Date().toISOString().slice(0, 10),
    purpose: "SALE_PENDING_INVOICE",
    vehicleNumber: "",
    transporter: "",
    notes: "",
    items: [{ ...EMPTY_ITEM }],
  });

  /* ── FETCH ONLY THE DROPDOWNS DELIVERY CHALLAN NEEDS (retailer + godowns + products).
     The old generic form fetched all 5 endpoints in a 5-way Promise.all even
     though Delivery Challan only ever uses retailer + godowns + products — that
     is the root cause of "dropdown value comes to late". ── */
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiClient(`${API_BASE_URL}/api/Retailer/Dropdown`).then(r => r.json()),
      apiClient(`${API_BASE_URL}/api/Godown/GetGodownDropdown`).then(r => r.json()),
      apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`).then(r => r.json()),
    ]).then(results => {
      if (!alive) return;
      const retailers = results[0].status === "fulfilled" ? extractList(results[0].value) : [];
      const godowns = results[1].status === "fulfilled" ? extractList(results[1].value) : [];
      const products = results[2].status === "fulfilled" ? extractList(results[2].value) : [];
      setRetailers(retailers);
      setGodowns(godowns);
      setProducts(products);
      setCatalogLoading(false);
    }).catch(() => { if (alive) setCatalogLoading(false); });
    return () => { alive = false };
  }, []);

  const setField = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }));
  const removeItem = i => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

  const updateItem = (i, key, value) => {
    const updated = [...form.items];
    updated[i] = { ...updated[i], [key]: value };
    if (key === "productId") {
      const p = products.find(x => String(x.id) === String(value));
      if (p) updated[i].productName = p.name || p.productName || "";
    }
    setForm(p => ({ ...p, items: updated }));
  };

  const validate = () => {
    const e = {};
    if (!form.retailerId) e.retailerId = "Retailer is required";
    if (!form.godownId) e.godownId = "Godown is required";
    if (!form.date) e.date = "Challan date is required";
    if (form.items.length === 0) e.items_empty = "Add at least one item";
    const itemErrors = {};
    form.items.forEach((item, i) => {
      const ie = {};
      if (!item.productId) ie.productId = "Required";
      if (!item.quantity || Number(item.quantity) < 1) ie.quantity = "Required";
      if (Object.keys(ie).length) itemErrors[i] = ie;
    });
    if (Object.keys(itemErrors).length) e.items = itemErrors;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        retailerId: Number(form.retailerId),
        godownId: Number(form.godownId),
        salesOrderUKey: form.salesOrderUKey || null,
        challanDate: form.date,
        purpose: form.purpose,
        vehicleNumber: form.vehicleNumber || null,
        transporter: form.transporter || null,
        notes: form.notes,
        items: form.items.map(it => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          unitPrice: it.unitPrice === "" || it.unitPrice == null ? null : Number(it.unitPrice),
        })),
      };
      const res = await apiClient(`${API_BASE_URL}/api/DeliveryChallan/AddDeliveryChallan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.status === 200) {
        toast.success("Delivery challan created successfully");
        onSubmit?.();
        onClose?.();
      } else {
        toastApiError(json, "Failed to create delivery challan");
      }
    } catch {
      /* global unreachable-backend toast */
    } finally {
      setSaving(false);
    }
  };

  const retailerLabel = r => r.name || r.shopName || r.retailerName || `Retailer #${r.id}`;
  const godownName = g => g.name || g.godownName || `Godown #${g.id}`;
  const productName = p => p.name || p.productName || `Product #${p.id}`;
  const totalValue = form.items.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unitPrice || 0)), 0);

  const hasDetailErrors = errors.retailerId || errors.godownId || errors.date;
  const hasItemErrors = errors.items_empty || errors.items;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Delivery Challan</div>
            <h3 className="afx-title">Create Delivery Challan</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
              {[
                { id: "DETAILS", label: "Details", hasErr: !!hasDetailErrors },
                { id: "ITEMS", label: `Items ${form.items.length ? `(${form.items.length})` : ""}`, hasErr: !!hasItemErrors },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`afx-tab ${activeTab === t.id ? "is-active" : ""}`}
                  style={t.hasErr ? { color: "var(--afx-danger)" } : undefined}
                  onClick={() => setActiveTab(t.id)}
                >{t.label}</button>
              ))}
            </div>
            <button className="afx-close" type="button" onClick={onClose}>
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {catalogLoading ? (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div /><div /><div /></div>
              <span className="afx-view-value--muted" style={{ marginTop: 12, display: "block" }}>Loading retailer, godowns and products…</span>
            </div>
          ) : (
            <>
              {activeTab === "DETAILS" && (
                <div className="afx-grid">
                  <div className="afx-field">
                    <label className="afx-label">Retailer<span className="afx-req">*</span></label>
                    <SearchDrop
                      options={retailers}
                      value={form.retailerId}
                      onChange={v => setField("retailerId", v)}
                      placeholder="Search retailers…"
                      dropRef={retailerRef}
                      open={retailerOpen}
                      setOpen={setRetailerOpen}
                      getLabel={retailerLabel}
                    />
                    {errors.retailerId && <span className="afx-error">{errors.retailerId}</span>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Godown<span className="afx-req">*</span></label>
                    <SearchDrop
                      options={godowns}
                      value={form.godownId}
                      onChange={v => setField("godownId", v)}
                      placeholder="Search godowns…"
                      dropRef={godownRef}
                      open={godownOpen}
                      setOpen={setGodownOpen}
                      getLabel={godownName}
                    />
                    {errors.godownId && <span className="afx-error">{errors.godownId}</span>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Challan date<span className="afx-req">*</span></label>
                    <input
                      className={`afx-input ${errors.date ? "afx-input--err" : ""}`}
                      type="date"
                      value={form.date}
                      onChange={e => setField("date", e.target.value)}
                    />
                    {errors.date && <span className="afx-error">{errors.date}</span>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Purpose<span className="afx-req">*</span></label>
                    <select
                      className="afx-select"
                      value={form.purpose}
                      onChange={e => setField("purpose", e.target.value)}
                    >
                      <option value="SALE_PENDING_INVOICE">Sale pending invoice</option>
                      <option value="SAMPLE">Sample</option>
                      <option value="APPROVAL">Approval</option>
                    </select>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Vehicle number</label>
                    <input
                      className="afx-input"
                      value={form.vehicleNumber}
                      onChange={e => setField("vehicleNumber", e.target.value)}
                      placeholder="e.g. MH12AB1234"
                    />
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Transporter</label>
                    <input
                      className="afx-input"
                      value={form.transporter}
                      onChange={e => setField("transporter", e.target.value)}
                      placeholder="Transporter name"
                    />
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Sales order key (optional)</label>
                    <input
                      className="afx-input"
                      value={form.salesOrderUKey}
                      onChange={e => setField("salesOrderUKey", e.target.value)}
                      placeholder="Link a confirmed sales order"
                    />
                  </div>

                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Notes</label>
                    <textarea
                      className="afx-textarea"
                      rows={3}
                      value={form.notes}
                      onChange={e => setField("notes", e.target.value)}
                      placeholder="Optional notes about this challan…"
                    />
                  </div>
                </div>
              )}

              {activeTab === "ITEMS" && (
                <div>
                  {errors.items_empty && <div className="afx-alert" style={{ marginBottom: 12 }}>{errors.items_empty}</div>}

                  {form.items.length === 0 ? (
                    <div className="afx-items-empty">
                      <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.4" opacity="0.3" />
                        <path d="M13 20h14M20 13v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
                      </svg>
                      <p>No items added yet</p>
                      <button type="button" className="afx-line-add" onClick={addItem}>+ Add First Item</button>
                    </div>
                  ) : (
                    <>
                      <div className="afx-items-list">
                        {form.items.map((item, i) => (
                          <div key={i} className="afx-item-card">
                            <div className="afx-item-card-top">
                              <div className="afx-item-card-product" ref={el => productRefs.current[i] = el}>
                                <SearchDrop
                                  options={products}
                                  value={item.productId}
                                  onChange={v => updateItem(i, "productId", v)}
                                  placeholder="Select product"
                                  dropRef={{ current: productRefs.current[i] }}
                                  open={productOpenIdx === i}
                                  setOpen={v => setProductOpenIdx(v ? i : null)}
                                  getLabel={productName}
                                />
                                {errors.items?.[i]?.productId && <span className="afx-error">{errors.items[i].productId}</span>}
                              </div>
                              <button type="button" className="afx-remove-btn" onClick={() => removeItem(i)} title="Remove item">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>

                            <div className="afx-item-card-fields">
                              <div className="afx-item-field">
                                <label className="afx-item-field-label">Qty<span className="afx-req">*</span></label>
                                <input
                                  type="number"
                                  min="1"
                                  className={`afx-cell-input ${errors.items?.[i]?.quantity ? "afx-input--err" : ""}`}
                                  value={item.quantity}
                                  onChange={e => updateItem(i, "quantity", e.target.value)}
                                />
                                {errors.items?.[i]?.quantity && <span className="afx-error">{errors.items[i].quantity}</span>}
                              </div>
                              <div className="afx-item-field">
                                <label className="afx-item-field-label">Unit price (₹)</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="afx-cell-input"
                                  value={item.unitPrice}
                                  onChange={e => updateItem(i, "unitPrice", e.target.value)}
                                  placeholder="Leave blank for godown price"
                                />
                              </div>
                            </div>

                            <div className="afx-item-card-footer">
                              <span className="afx-item-card-footer-label">Line total</span>
                              <span className="afx-line-total">₹{(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="afx-totals">
                        <div className="afx-totals-row"><span>Total value</span><span>₹{totalValue.toFixed(2)}</span></div>
                      </div>
                    </>
                  )}

                  <button type="button" className="afx-line-add" style={{ marginTop: 10 }} onClick={addItem}>+ Add Item</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="afx-btn afx-btn--primary"
            onClick={handleSubmit}
            disabled={saving || catalogLoading}
          >
            {saving ? <><span className="afx-spinner" /> Saving…</> : "Save Delivery Challan"}
          </button>
        </div>
      </div>
    </div>
  );
}
