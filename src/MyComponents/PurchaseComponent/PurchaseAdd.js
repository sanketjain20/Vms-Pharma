import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Searchable dropdown — externally controlled open state so a row of
   these (one per line item) can be tracked by a single index ── */
const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen }) => {
  const [search, setSearch] = useState("");
  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o =>
    (o.shopName || o.name || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="afx-searchdrop" ref={dropRef}>
      <div className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selected ? "is-filled" : ""}`} onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
        <span>{selected?.shopName || selected?.name || placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
              <div key={o.id}
                className={`afx-searchdrop-item ${o.id === value ? "is-selected" : ""}`}
                onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); setSearch(""); }}
              >
                {o.shopName || o.name}
                {o.supplierCode && <span style={{ color: "var(--afx-text-3)", marginLeft: 6, fontSize: 11 }}>{o.supplierCode}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const GST_RATES = [0, 5, 12, 18, 28];

const EMPTY_ITEM = {
  productId: "", productName: "", quantity: 1,
  costPrice: "", mrp: "", gstRate: 0,
  batchNumber: "", manufacturingDate: "", expiryDate: "",
};

export default function PurchaseAdd({ onSubmit, onClose }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts]   = useState([]);
  const [activeTab, setActiveTab] = useState("DETAILS");
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState({});

  const [supplierOpen, setSupplierOpen]   = useState(false);
  const [productOpenIdx, setProductOpenIdx] = useState(null);
  const supplierRef = useRef(null);
  const productRefs = useRef([]);

  const [form, setForm] = useState({
    supplierId: "",
    supplierInvoiceNumber: "",
    invoiceDate: "",
    paymentStatus: "CREDIT",
    dueDate: "",
    amountPaid: "",
    notes: "",
    items: [],
  });

  /* ── FETCH SUPPLIERS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Supplier/GetSupplierDropdown`)
      .then(r => r.json())
      .then(json => setSuppliers(json.data || []))
      .catch(() => {});
  }, []);

  /* ── FETCH PRODUCTS ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`)
      .then(r => r.json())
      .then(json => {
        const d = json?.data;
        const list = Array.isArray(d) ? d
          : typeof d === "object" ? Object.values(d).find(v => Array.isArray(v)) || [] : [];
        setProducts(list);
      })
      .catch(() => setProducts([]));
  }, []);

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const handler = e => {
      if (supplierRef.current && !supplierRef.current.contains(e.target)) setSupplierOpen(false);
      productRefs.current.forEach((ref, i) => {
        if (ref && !ref.contains(e.target)) setProductOpenIdx(p => p === i ? null : p);
      });
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const setField = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => ({ ...p, [key]: "" }));
  };

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { ...EMPTY_ITEM }] }));

  const updateItem = (i, field, value) => {
    const updated = [...form.items];
    updated[i] = { ...updated[i], [field]: value };
    // Auto-fill cost/mrp when product selected
    if (field === "productId") {
      const p = products.find(x => x.id === value);
      if (p) { updated[i].costPrice = p.price || ""; updated[i].mrp = p.price || ""; updated[i].productName = p.name; }
    }
    setForm(p => ({ ...p, items: updated }));
    // Clear item error
    if (errors.items?.[i]?.[field]) {
      setErrors(p => ({ ...p, items: { ...p.items, [i]: { ...p.items?.[i], [field]: "" } } }));
    }
  };

  const removeItem = i => {
    const updated = [...form.items];
    updated.splice(i, 1);
    setForm(p => ({ ...p, items: updated }));
  };

  /* ── CALCULATIONS ── */
  const getLineTotal = item => {
    const base = (parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0);
    const gst  = base * (parseFloat(item.gstRate) || 0) / 100;
    return base + gst;
  };

  const grandTotal  = form.items.reduce((s, i) => s + getLineTotal(i), 0);
  const totalTax    = form.items.reduce((s, i) => {
    const base = (parseFloat(i.costPrice) || 0) * (parseInt(i.quantity) || 0);
    return s + base * (parseFloat(i.gstRate) || 0) / 100;
  }, 0);

  /* ── VALIDATE ── */
  const validate = () => {
    const e = {};
    if (!form.supplierId)             e.supplierId = "Supplier is required";
    if (!form.supplierInvoiceNumber)  e.supplierInvoiceNumber = "Invoice number is required";
    if (!form.invoiceDate)            e.invoiceDate = "Invoice date is required";
    if (!form.paymentStatus)          e.paymentStatus = "Payment status is required";
    if ((form.paymentStatus === "CREDIT" || form.paymentStatus === "PARTIAL") && !form.dueDate)
      e.dueDate = "Due date required for credit/partial";
    if (form.items.length === 0) e.items_empty = "Add at least one item";

    const itemErrors = {};
    form.items.forEach((item, i) => {
      const ie = {};
      if (!item.productId)        ie.productId = "Required";
      if (!item.quantity || item.quantity < 1) ie.quantity = "Required";
      if (!item.costPrice)        ie.costPrice = "Required";
      if (!item.mrp)              ie.mrp = "Required";
      if (!item.expiryDate)       ie.expiryDate = "Required";
      if (Object.keys(ie).length) itemErrors[i] = ie;
    });
    if (Object.keys(itemErrors).length) e.items = itemErrors;

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      // Switch to tab with errors
      if (errors.supplierId || errors.supplierInvoiceNumber || errors.invoiceDate || errors.paymentStatus || errors.dueDate)
        setActiveTab("DETAILS");
      else setActiveTab("ITEMS");
      toast.error("Please fix the errors before submitting");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        supplierId:            form.supplierId,
        supplierInvoiceNumber: form.supplierInvoiceNumber,
        invoiceDate:           form.invoiceDate,
        paymentStatus:         form.paymentStatus,
        dueDate:               form.dueDate || null,
        amountPaid:            parseFloat(form.amountPaid || 0),
        notes:                 form.notes,
        items: form.items.map(it => ({
          productId:         it.productId,
          manufacturingDate: it.manufacturingDate || null,
          expiryDate:        it.expiryDate,
          quantity:          parseInt(it.quantity),
          costPrice:         parseFloat(it.costPrice),
          mrp:               parseFloat(it.mrp),
          gstRate:           parseFloat(it.gstRate || 0),
        })),
      };

      const res  = await apiClient(`${API_BASE_URL}/api/Purchase/CreatePurchase?createdBy=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.status === 200) { toast.success("Purchase created successfully"); onSubmit?.(); onClose?.(); }
      else toast.error(json?.message || "Failed to create purchase");
    } catch { toast.error("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  const hasDetailErrors = errors.supplierId || errors.supplierInvoiceNumber || errors.invoiceDate || errors.paymentStatus || errors.dueDate;
  const hasItemErrors   = errors.items_empty || errors.items;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />New Purchase</div>
            <h3 className="afx-title">Create Purchase Entry</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="afx-tabs" style={{ padding: 0, background: "none", border: "none" }}>
              {[
                { id: "DETAILS", label: "Details", hasErr: hasDetailErrors },
                { id: "ITEMS",   label: `Items ${form.items.length > 0 ? `(${form.items.length})` : ""}`, hasErr: hasItemErrors },
              ].map(t => (
                <button key={t.id} type="button"
                  className={`afx-tab ${activeTab === t.id ? "is-active" : ""}`}
                  style={t.hasErr ? { color: "var(--afx-danger)" } : undefined}
                  onClick={() => setActiveTab(t.id)}
                >{t.label}</button>
              ))}
            </div>
            <button className="afx-close" type="button" onClick={onClose}>
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {activeTab === "DETAILS" && (
            <div className="afx-grid">
              <div className="afx-field">
                <label className="afx-label">Supplier<span className="afx-req">*</span></label>
                <SearchDrop
                  options={suppliers}
                  value={form.supplierId}
                  onChange={v => { setField("supplierId", v); }}
                  placeholder="Search supplier…"
                  dropRef={supplierRef}
                  open={supplierOpen}
                  setOpen={setSupplierOpen}
                />
                {errors.supplierId && <span className="afx-error">{errors.supplierId}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Supplier Invoice No<span className="afx-req">*</span></label>
                <input className={`afx-input ${errors.supplierInvoiceNumber ? "afx-input--err" : ""}`}
                  value={form.supplierInvoiceNumber}
                  onChange={e => setField("supplierInvoiceNumber", e.target.value)}
                  placeholder="e.g. INV-2024-001"
                />
                {errors.supplierInvoiceNumber && <span className="afx-error">{errors.supplierInvoiceNumber}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Invoice Date<span className="afx-req">*</span></label>
                <input type="date" className={`afx-input ${errors.invoiceDate ? "afx-input--err" : ""}`}
                  value={form.invoiceDate}
                  onChange={e => setField("invoiceDate", e.target.value)}
                />
                {errors.invoiceDate && <span className="afx-error">{errors.invoiceDate}</span>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Payment Status<span className="afx-req">*</span></label>
                <div className="afx-select-wrap">
                  <select className={`afx-select ${errors.paymentStatus ? "afx-select--err" : ""}`}
                    value={form.paymentStatus}
                    onChange={e => setField("paymentStatus", e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="PAID">Paid in Full</option>
                    <option value="CREDIT">Credit (Pay Later)</option>
                    <option value="PARTIAL">Partial Payment</option>
                  </select>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                {errors.paymentStatus && <span className="afx-error">{errors.paymentStatus}</span>}
              </div>

              {(form.paymentStatus === "CREDIT" || form.paymentStatus === "PARTIAL") && (
                <div className="afx-field">
                  <label className="afx-label">Due Date<span className="afx-req">*</span></label>
                  <input type="date" className={`afx-input ${errors.dueDate ? "afx-input--err" : ""}`}
                    value={form.dueDate}
                    onChange={e => setField("dueDate", e.target.value)}
                  />
                  {errors.dueDate && <span className="afx-error">{errors.dueDate}</span>}
                </div>
              )}

              {form.paymentStatus === "PARTIAL" && (
                <div className="afx-field">
                  <label className="afx-label">Amount Paid (₹)</label>
                  <input type="number" className="afx-input" min="0"
                    value={form.amountPaid}
                    onChange={e => setField("amountPaid", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              <div className="afx-field afx-field--full">
                <label className="afx-label">Notes</label>
                <textarea className="afx-textarea" rows={3}
                  value={form.notes}
                  onChange={e => setField("notes", e.target.value)}
                  placeholder="Optional notes about this purchase…"
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
                    <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/>
                    <path d="M13 20h14M20 13v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                  <p>No items added yet</p>
                  <button type="button" className="afx-line-add" onClick={addItem}>+ Add First Item</button>
                </div>
              ) : (
                <>
                  <div className="afx-items-head">
                    <span>Product</span>
                    <span>MFG Date</span>
                    <span>Expiry Date</span>
                    <span>Qty</span>
                    <span>Cost (₹)</span>
                    <span>MRP (₹)</span>
                    <span>GST %</span>
                    <span>Total (₹)</span>
                    <span></span>
                  </div>

                  {form.items.map((item, i) => (
                    <div key={i} className="afx-item-row">
                      <div ref={el => productRefs.current[i] = el}>
                        <SearchDrop
                          options={products}
                          value={item.productId}
                          onChange={v => updateItem(i, "productId", v)}
                          placeholder="Select product"
                          dropRef={{ current: productRefs.current[i] }}
                          open={productOpenIdx === i}
                          setOpen={v => setProductOpenIdx(v ? i : null)}
                        />
                        {errors.items?.[i]?.productId && <span className="afx-error">{errors.items[i].productId}</span>}
                      </div>

                      <div>
                        <input type="date" className="afx-cell-input"
                          value={item.manufacturingDate}
                          onChange={e => updateItem(i, "manufacturingDate", e.target.value)}
                        />
                      </div>

                      <div>
                        <input type="date" className="afx-cell-input"
                          style={errors.items?.[i]?.expiryDate ? { borderColor: "var(--afx-danger)" } : undefined}
                          value={item.expiryDate}
                          onChange={e => updateItem(i, "expiryDate", e.target.value)}
                        />
                        {errors.items?.[i]?.expiryDate && <span className="afx-error">{errors.items[i].expiryDate}</span>}
                      </div>

                      <div>
                        <input type="number" min="1" className="afx-cell-input"
                          style={errors.items?.[i]?.quantity ? { borderColor: "var(--afx-danger)" } : undefined}
                          value={item.quantity}
                          onChange={e => updateItem(i, "quantity", e.target.value)}
                        />
                        {errors.items?.[i]?.quantity && <span className="afx-error">{errors.items[i].quantity}</span>}
                      </div>

                      <div>
                        <input type="number" min="0" className="afx-cell-input"
                          style={errors.items?.[i]?.costPrice ? { borderColor: "var(--afx-danger)" } : undefined}
                          value={item.costPrice}
                          onChange={e => updateItem(i, "costPrice", e.target.value)}
                          placeholder="0.00"
                        />
                        {errors.items?.[i]?.costPrice && <span className="afx-error">{errors.items[i].costPrice}</span>}
                      </div>

                      <div>
                        <input type="number" min="0" className="afx-cell-input"
                          style={errors.items?.[i]?.mrp ? { borderColor: "var(--afx-danger)" } : undefined}
                          value={item.mrp}
                          onChange={e => updateItem(i, "mrp", e.target.value)}
                          placeholder="0.00"
                        />
                        {errors.items?.[i]?.mrp && <span className="afx-error">{errors.items[i].mrp}</span>}
                      </div>

                      <div>
                        <select className="afx-cell-input"
                          value={item.gstRate}
                          onChange={e => updateItem(i, "gstRate", e.target.value)}
                        >
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>

                      <div className="afx-line-total">₹{getLineTotal(item).toFixed(2)}</div>

                      <button type="button" className="afx-remove-btn" onClick={() => removeItem(i)} title="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}

                  <div className="afx-totals">
                    <div className="afx-totals-row">
                      <span>Subtotal</span>
                      <span>₹{(grandTotal - totalTax).toFixed(2)}</span>
                    </div>
                    <div className="afx-totals-row">
                      <span>Total GST</span>
                      <span>₹{totalTax.toFixed(2)}</span>
                    </div>
                    <div className="afx-totals-divider" />
                    <div className="afx-totals-row afx-totals-grand">
                      <span>Grand Total</span>
                      <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              <button type="button" className="afx-line-add" style={{ marginTop: 10 }} onClick={addItem}>+ Add Item</button>
            </div>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="afx-spinner" /> Saving…</> : "Save Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}
