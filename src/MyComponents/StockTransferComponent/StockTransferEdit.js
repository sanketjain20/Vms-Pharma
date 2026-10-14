import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { toastApiError } from "../../utils/toastMessage";

/* ── Searchable dropdown (self-contained copy, mirrors PurchaseEdit's widget). ── */
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
                className={`afx-searchdrop-item ${String(o.id) === String(value) ? "is-selected" : ""}`}
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

const EMPTY_ITEM = { productId: "", productName: "", quantity: 1 };

function extractList(json) {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.values(data).find(v => Array.isArray(v)) || [];
  return [];
}

export default function StockTransferEdit({ uKey, onSubmit, onClose }) {
  const [godowns, setGodowns] = useState([]);
  const [products, setProducts] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState("DETAILS");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [fromGodownOpen, setFromGodownOpen] = useState(false);
  const [toGodownOpen, setToGodownOpen] = useState(false);
  const [productOpenIdx, setProductOpenIdx] = useState(null);
  const fromGodownRef = useRef(null);
  const toGodownRef = useRef(null);
  const productRefs = useRef([]);

  const [form, setForm] = useState({
    fromGodownId: "", toGodownId: "", date: "",
    vehicleNumber: "", notes: "", items: [],
  });

  /* ── FETCH ONLY THE DROPDOWNS STOCK TRANSFER NEEDS (godowns + products). ── */
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      apiClient(`${API_BASE_URL}/api/Godown/GetGodownDropdown`).then(r => r.json()),
      apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`).then(r => r.json()),
    ]).then(results => {
      if (!alive) return;
      setGodowns(results[0].status === "fulfilled" ? extractList(results[0].value) : []);
      setProducts(results[1].status === "fulfilled" ? extractList(results[1].value) : []);
      setCatalogLoading(false);
    }).catch(() => { if (alive) setCatalogLoading(false); });
    return () => { alive = false; };
  }, []);

  /* ── LOAD EXISTING STOCK TRANSFER ── */
  useEffect(() => {
    if (!uKey) return;
    let alive = true;
    setFetching(true);
    apiClient(`${API_BASE_URL}/api/StockTransfer/GetStockTransferByUKey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (!alive) return;
        if (json?.status === 200 && json.data) {
          const d = json.data;
          setForm({
            fromGodownId:  String(d.fromGodownId ?? ""),
            toGodownId:    String(d.toGodownId ?? ""),
            date:          d.transferDate || "",
            vehicleNumber: d.vehicleNumber || "",
            notes:         d.notes || "",
            items: (d.items || []).map(it => ({
              productId:   String(it.productId || ""),
              productName: it.productName || "",
              quantity:    Number(it.quantity || 1),
            })),
          });
        } else {
          toast.error("Failed to load stock transfer");
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, [uKey]);

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
    if (!form.fromGodownId) e.fromGodownId = "Source godown is required";
    if (!form.toGodownId) e.toGodownId = "Destination godown is required";
    if (form.fromGodownId && form.toGodownId && form.fromGodownId === form.toGodownId) {
      e.toGodownId = "Source and destination godowns must differ";
    }
    if (!form.date) e.date = "Transfer date is required";
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
        fromGodownId: Number(form.fromGodownId),
        toGodownId: Number(form.toGodownId),
        transferDate: form.date,
        vehicleNumber: form.vehicleNumber || null,
        notes: form.notes,
        items: form.items.map(it => ({ productId: Number(it.productId), quantity: Number(it.quantity) })),
      };
      const res = await apiClient(`${API_BASE_URL}/api/StockTransfer/UpdateStockTransfer/${uKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.status === 200) {
        toast.success("Stock transfer updated successfully");
        onSubmit?.();
        onClose?.();
      } else {
        toastApiError(json, "Failed to update stock transfer");
      }
    } catch {
      /* global unreachable-backend toast */
    } finally {
      setSaving(false);
    }
  };

  const godownName = g => g.name || g.godownName || `Godown #${g.id}`;
  const productName = p => p.name || p.productName || `Product #${p.id}`;
  const totalUnits = form.items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  const hasDetailErrors = errors.fromGodownId || errors.toGodownId || errors.date;
  const hasItemErrors = errors.items_empty || errors.items;

  /* While the transfer record OR the dropdowns are loading, show a spinner
     instead of half-empty selects (this is the "dropdown value comes to late"
     fix — the user gets feedback instead of an empty form). */
  const loading = fetching || catalogLoading;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Edit Stock Transfer</div>
            <h3 className="afx-title">Update Stock Transfer</h3>
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
          {loading ? (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div /><div /><div /></div>
              <span className="afx-view-value--muted" style={{ marginTop: 12, display: "block" }}>Loading transfer and options…</span>
            </div>
          ) : (
            <>
              {activeTab === "DETAILS" && (
                <div className="afx-grid">
                  <div className="afx-field">
                    <label className="afx-label">From godown<span className="afx-req">*</span></label>
                    <SearchDrop
                      options={godowns}
                      value={form.fromGodownId}
                      onChange={v => setField("fromGodownId", v)}
                      placeholder="Search godowns…"
                      dropRef={fromGodownRef}
                      open={fromGodownOpen}
                      setOpen={setFromGodownOpen}
                      getLabel={godownName}
                    />
                    {errors.fromGodownId && <span className="afx-error">{errors.fromGodownId}</span>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">To godown<span className="afx-req">*</span></label>
                    <SearchDrop
                      options={godowns.filter(g => String(g.id) !== String(form.fromGodownId))}
                      value={form.toGodownId}
                      onChange={v => setField("toGodownId", v)}
                      placeholder="Search godowns…"
                      dropRef={toGodownRef}
                      open={toGodownOpen}
                      setOpen={setToGodownOpen}
                      getLabel={godownName}
                    />
                    {errors.toGodownId && <span className="afx-error">{errors.toGodownId}</span>}
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Transfer date<span className="afx-req">*</span></label>
                    <input
                      className={`afx-input ${errors.date ? "afx-input--err" : ""}`}
                      type="date"
                      value={form.date}
                      onChange={e => setField("date", e.target.value)}
                    />
                    {errors.date && <span className="afx-error">{errors.date}</span>}
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

                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Notes</label>
                    <textarea
                      className="afx-textarea"
                      rows={3}
                      value={form.notes}
                      onChange={e => setField("notes", e.target.value)}
                      placeholder="Optional notes about this transfer…"
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
                                  className="afx-cell-input"
                                  style={errors.items?.[i]?.quantity ? { borderColor: "var(--afx-danger)" } : undefined}
                                  value={item.quantity}
                                  onChange={e => updateItem(i, "quantity", e.target.value)}
                                />
                                {errors.items?.[i]?.quantity && <span className="afx-error">{errors.items[i].quantity}</span>}
                              </div>
                            </div>

                            <div className="afx-item-card-footer">
                              <span className="afx-item-card-footer-label">Total units</span>
                              <span className="afx-line-total">{Number(item.quantity || 0)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="afx-totals">
                        <div className="afx-totals-row"><span>Total units</span><span>{totalUnits}</span></div>
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
            disabled={saving || loading}
          >
            {saving ? <><span className="afx-spinner" /> Updating…</> : "Update Stock Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
