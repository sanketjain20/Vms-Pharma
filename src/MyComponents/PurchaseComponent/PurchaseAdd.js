import React, { useState, useEffect, useRef } from "react";
import "../../Styles/Purchase/Purchase.css";
import { toast } from "react-toastify";

/* ── Searchable dropdown — same pattern as your Sales ── */
const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen }) => {
  const [search, setSearch] = useState("");
  const selected = options.find(o => o.id === value);
  const filtered = options.filter(o =>
    (o.shopName || o.name || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="pfx-drop-wrap" ref={dropRef}>
      <div className={`pfx-drop-box ${open ? "pfx-drop-open" : ""}`} onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
        <input
          className="pfx-drop-input"
          value={open ? search : (selected?.shopName || selected?.name || "")}
          placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}
        />
        <span className="pfx-drop-arrow">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <ul className="pfx-drop-list">
          {filtered.map(o => (
            <li key={o.id}
              className={o.id === value ? "pfx-drop-selected" : ""}
              onMouseDown={e => { e.preventDefault(); onChange(o.id); setOpen(false); setSearch(""); }}
            >
              {o.shopName || o.name}
              {o.supplierCode && <span className="pfx-drop-sub">{o.supplierCode}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="pfx-drop-empty">No results</li>}
        </ul>
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
    fetch("http://localhost:8080/api/Supplier/GetSupplierDropdown", { credentials: "include" })
      .then(r => r.json())
      .then(json => setSuppliers(json.data || []))
      .catch(() => {});
  }, []);

  /* ── FETCH PRODUCTS ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/Product/GetAllProduct", { credentials: "include" })
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

      const res  = await fetch("http://localhost:8080/api/Purchase/CreatePurchase?createdBy=1", {
        method: "POST", credentials: "include",
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
    <div className="pfx-backdrop">
      <div className="pfx-modal">

        {/* ── TOP BEAM ── */}
        <div className="pfx-top-beam" />

        {/* ── HEADER ── */}
        <div className="pfx-header">
          <div className="pfx-header-left">
            <div className="pfx-eyebrow"><span className="pfx-eyebrow-dot" />NEW PURCHASE</div>
            <h2 className="pfx-title"><span className="pfx-title-acc">//</span> Create Purchase Entry</h2>
          </div>
          <div className="pfx-header-right">
            <div className="pfx-tab-row">
              {[
                { id: "DETAILS", label: "Details", hasErr: hasDetailErrors },
                { id: "ITEMS",   label: `Items ${form.items.length > 0 ? `(${form.items.length})` : ""}`, hasErr: hasItemErrors },
              ].map(t => (
                <button key={t.id} type="button"
                  className={`pfx-tab ${activeTab === t.id ? "pfx-tab-active" : ""} ${t.hasErr ? "pfx-tab-err" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >{t.label}</button>
              ))}
            </div>
            <button className="pfx-close-btn" type="button" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="pfx-divider" />

        {/* ── BODY ── */}
        <div className="pfx-body">

          {/* ════ DETAILS TAB ════ */}
          {activeTab === "DETAILS" && (
            <div className="pfx-details-grid">

              {/* Supplier */}
              <div className="pfx-field">
                <label className="pfx-label">Supplier <span className="pfx-req">*</span></label>
                <SearchDrop
                  options={suppliers}
                  value={form.supplierId}
                  onChange={v => { setField("supplierId", v); }}
                  placeholder="Search supplier…"
                  dropRef={supplierRef}
                  open={supplierOpen}
                  setOpen={setSupplierOpen}
                />
                {errors.supplierId && <span className="pfx-error">{errors.supplierId}</span>}
              </div>

              {/* Invoice number */}
              <div className="pfx-field">
                <label className="pfx-label">Supplier Invoice No <span className="pfx-req">*</span></label>
                <input className={`pfx-input ${errors.supplierInvoiceNumber ? "pfx-input-err" : ""}`}
                  value={form.supplierInvoiceNumber}
                  onChange={e => setField("supplierInvoiceNumber", e.target.value)}
                  placeholder="e.g. INV-2024-001"
                />
                {errors.supplierInvoiceNumber && <span className="pfx-error">{errors.supplierInvoiceNumber}</span>}
              </div>

              {/* Invoice date */}
              <div className="pfx-field">
                <label className="pfx-label">Invoice Date <span className="pfx-req">*</span></label>
                <input type="date" className={`pfx-input ${errors.invoiceDate ? "pfx-input-err" : ""}`}
                  value={form.invoiceDate}
                  onChange={e => setField("invoiceDate", e.target.value)}
                />
                {errors.invoiceDate && <span className="pfx-error">{errors.invoiceDate}</span>}
              </div>

              {/* Payment status */}
              <div className="pfx-field">
                <label className="pfx-label">Payment Status <span className="pfx-req">*</span></label>
                <select className={`pfx-input ${errors.paymentStatus ? "pfx-input-err" : ""}`}
                  value={form.paymentStatus}
                  onChange={e => setField("paymentStatus", e.target.value)}
                >
                  <option value="">— Select —</option>
                  <option value="PAID">Paid in Full</option>
                  <option value="CREDIT">Credit (Pay Later)</option>
                  <option value="PARTIAL">Partial Payment</option>
                </select>
                {errors.paymentStatus && <span className="pfx-error">{errors.paymentStatus}</span>}
              </div>

              {/* Due date — only for credit/partial */}
              {(form.paymentStatus === "CREDIT" || form.paymentStatus === "PARTIAL") && (
                <div className="pfx-field">
                  <label className="pfx-label">Due Date <span className="pfx-req">*</span></label>
                  <input type="date" className={`pfx-input ${errors.dueDate ? "pfx-input-err" : ""}`}
                    value={form.dueDate}
                    onChange={e => setField("dueDate", e.target.value)}
                  />
                  {errors.dueDate && <span className="pfx-error">{errors.dueDate}</span>}
                </div>
              )}

              {/* Amount paid — only for partial */}
              {form.paymentStatus === "PARTIAL" && (
                <div className="pfx-field">
                  <label className="pfx-label">Amount Paid (₹)</label>
                  <input type="number" className="pfx-input" min="0"
                    value={form.amountPaid}
                    onChange={e => setField("amountPaid", e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="pfx-field pfx-field-full">
                <label className="pfx-label">Notes</label>
                <textarea className="pfx-input pfx-textarea" rows={3}
                  value={form.notes}
                  onChange={e => setField("notes", e.target.value)}
                  placeholder="Optional notes about this purchase…"
                />
              </div>
            </div>
          )}

          {/* ════ ITEMS TAB ════ */}
          {activeTab === "ITEMS" && (
            <div className="pfx-items-section">
              {errors.items_empty && (
                <div className="pfx-alert">{errors.items_empty}</div>
              )}

              {form.items.length === 0 ? (
                <div className="pfx-empty-state">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                    <path d="M13 20h14M20 13v14" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <p>No items added yet</p>
                  <button type="button" className="pfx-btn-add" onClick={addItem}>+ Add First Item</button>
                </div>
              ) : (
                <>
                  {/* ITEMS TABLE HEADER */}
                  <div className="pfx-items-head">
                    <span>Product</span>
                    <span>MFG Date</span>
                    <span>Expiry Date</span>
                    <span>Quantity</span>
                    <span>Cost (₹)</span>
                    <span>MRP (₹)</span>
                    <span>GST %</span>
                    <span>Total (₹)</span>
                    <span></span>
                  </div>

                  {form.items.map((item, i) => (
                    <div key={i} className="pfx-item-row">

                      {/* PRODUCT */}
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
                        {errors.items?.[i]?.productId && <span className="pfx-error">{errors.items[i].productId}</span>}
                      </div>

                      {/* MFG DATE */}
                      <div>
                        <input type="date" className="pfx-cell-input"
                          value={item.manufacturingDate}
                          onChange={e => updateItem(i, "manufacturingDate", e.target.value)}
                        />
                      </div>

                      {/* EXPIRY DATE */}
                      <div>
                        <input type="date" className={`pfx-cell-input ${errors.items?.[i]?.expiryDate ? "pfx-input-err" : ""}`}
                          value={item.expiryDate}
                          onChange={e => updateItem(i, "expiryDate", e.target.value)}
                        />
                        {errors.items?.[i]?.expiryDate && <span className="pfx-error">{errors.items[i].expiryDate}</span>}
                      </div>

                      {/* QTY */}
                      <div>
                        <input type="number" min="1" className={`pfx-cell-input ${errors.items?.[i]?.quantity ? "pfx-input-err" : ""}`}
                          value={item.quantity}
                          onChange={e => updateItem(i, "quantity", e.target.value)}
                        />
                        {errors.items?.[i]?.quantity && <span className="pfx-error">{errors.items[i].quantity}</span>}
                      </div>

                      {/* COST */}
                      <div>
                        <input type="number" min="0" className={`pfx-cell-input ${errors.items?.[i]?.costPrice ? "pfx-input-err" : ""}`}
                          value={item.costPrice}
                          onChange={e => updateItem(i, "costPrice", e.target.value)}
                          placeholder="0.00"
                        />
                        {errors.items?.[i]?.costPrice && <span className="pfx-error">{errors.items[i].costPrice}</span>}
                      </div>

                      {/* MRP */}
                      <div>
                        <input type="number" min="0" className={`pfx-cell-input ${errors.items?.[i]?.mrp ? "pfx-input-err" : ""}`}
                          value={item.mrp}
                          onChange={e => updateItem(i, "mrp", e.target.value)}
                          placeholder="0.00"
                        />
                        {errors.items?.[i]?.mrp && <span className="pfx-error">{errors.items[i].mrp}</span>}
                      </div>

                      {/* GST */}
                      <div>
                        <select className="pfx-cell-input"
                          value={item.gstRate}
                          onChange={e => updateItem(i, "gstRate", e.target.value)}
                        >
                          {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      </div>

                      {/* LINE TOTAL */}
                      <div className="pfx-line-total">
                        ₹{getLineTotal(item).toFixed(2)}
                      </div>

                      {/* REMOVE */}
                      <button type="button" className="pfx-remove-btn" onClick={() => removeItem(i)} title="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* TOTALS */}
                  <div className="pfx-totals">
                    <div className="pfx-totals-row">
                      <span>Subtotal</span>
                      <span>₹{(grandTotal - totalTax).toFixed(2)}</span>
                    </div>
                    <div className="pfx-totals-row">
                      <span>Total GST</span>
                      <span>₹{totalTax.toFixed(2)}</span>
                    </div>
                    <div className="pfx-totals-divider" />
                    <div className="pfx-totals-row pfx-totals-grand">
                      <span>Grand Total</span>
                      <span>₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}

              <button type="button" className="pfx-btn-add" onClick={addItem}>+ Add Item</button>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="pfx-footer">
          <button type="button" className="pfx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="pfx-btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="pfx-spinner" /> Saving…</> : <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Save Purchase
            </>}
          </button>
        </div>
      </div>
    </div>
  );
}
