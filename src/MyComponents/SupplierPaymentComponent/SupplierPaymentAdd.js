import React, { useState, useEffect, useRef } from "react";
import "../../Styles/SupplierPayment/SupplierPayment.css";
import { toast } from "react-toastify";

const API = "http://localhost:8080/api/SupplierPayment";
const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const PAYMENT_MODES = [
  { id: "CASH",          label: "Cash",           needsRef: false },
  { id: "UPI",           label: "UPI",            needsRef: true  },
  { id: "CHEQUE",        label: "Cheque",         needsRef: true  },
  { id: "BANK_TRANSFER", label: "Bank Transfer",  needsRef: true  },
  { id: "NEFT",          label: "NEFT",           needsRef: true  },
  { id: "RTGS",          label: "RTGS",           needsRef: true  },
];

/* ── Searchable dropdown ── */
const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen, displayKey = "name" }) => {
  const [search, setSearch] = useState("");
  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o => (o[displayKey] || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="spx-drop-wrap" ref={dropRef}>
      <div className={`spx-drop-box ${open ? "spx-drop-open" : ""}`}
        onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
        <input className="spx-drop-input"
          value={open ? search : (selected?.[displayKey] || "")}
          placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}
        />
        <span className="spx-drop-arrow">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <ul className="spx-drop-list">
          {filtered.map(o => (
            <li key={o.id}
              className={String(o.id) === String(value) ? "spx-drop-selected" : ""}
              onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); setSearch(""); }}
            >
              <span style={{ flex: 1 }}>{o[displayKey]}</span>
              {o.sub && <span className="spx-drop-sub">{o.sub}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="spx-drop-empty">No results</li>}
        </ul>
      )}
    </div>
  );
};

export default function SupplierPaymentAdd({ onClose, onSubmit }) {
  const [suppliers,       setSuppliers]       = useState([]);
  const [unpaidPurchases, setUnpaidPurchases] = useState([]);
  const [selectedSupplier,setSelectedSupplier]= useState(null);
  const [selectedPurchase,setSelectedPurchase]= useState(null);
  const [loading,         setLoading]         = useState(false);
  const [errors,          setErrors]          = useState({});

  const supplierRef = useRef(null);
  const purchaseRef = useRef(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const [form, setForm] = useState({
    amount:          "",
    paymentMode:     "CASH",
    referenceNumber: "",
    paymentDate:     new Date().toISOString().split("T")[0],
    notes:           "",
  });

  /* ── Fetch suppliers with outstanding ── */
  useEffect(() => {
    fetch(`${API}/SuppliersWithOutstanding`, { credentials: "include" })
      .then(r => r.json())
      .then(j => {
        const list = (j?.data || []).map(s => ({
          id:   s.supplierId,
          name: s.shopName,
          sub:  `${s.supplierCode} · Owes: ₹${fmt(s.outstandingBalance)}`,
          outstandingBalance: s.outstandingBalance,
          phone: s.phone,
          supplierCode: s.supplierCode,
        }));
        setSuppliers(list);
      }).catch(() => {});
  }, []);

  /* ── Click outside ── */
  useEffect(() => {
    const h = e => {
      if (supplierRef.current && !supplierRef.current.contains(e.target)) setSupplierOpen(false);
      if (purchaseRef.current && !purchaseRef.current.contains(e.target))  setPurchaseOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSelectedPurchase(null);
    setForm(p => ({ ...p, amount: "" }));
    setErrors({});
    // Load unpaid purchases
    fetch(`http://localhost:8080/api/Purchase/GetUnpaidBySupplier/${supplier.id}`, { credentials: "include" })
      .then(r => r.json())
      .then(j => {
        const list = (j?.data || []).map(p => ({
          id:   p.id,
          name: `${p.purchaseNumber} — ₹${fmt(p.remainingAmount)} due`,
          sub:  p.purchaseDate ? `Date: ${p.purchaseDate}` : "",
          purchaseNumber:   p.purchaseNumber,
          remainingAmount:  p.remainingAmount,
          netAmount:        p.netAmount,
          purchaseDate:     p.purchaseDate,
        }));
        setUnpaidPurchases(list);
      }).catch(() => setUnpaidPurchases([]));
  };

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: "" }));
  };

  const needsRef = PAYMENT_MODES.find(m => m.id === form.paymentMode)?.needsRef;

  const validate = () => {
    const e = {};
    if (!selectedSupplier)              e.supplier       = "Select a supplier";
    if (!form.amount || parseFloat(form.amount) <= 0) e.amount = "Enter a valid amount";
    const outstanding = parseFloat(selectedSupplier?.outstandingBalance || 0);
    if (form.amount && parseFloat(form.amount) > outstanding)
      e.amount = `Cannot exceed outstanding ₹${fmt(outstanding)}`;
    if (selectedPurchase && parseFloat(form.amount) > parseFloat(selectedPurchase.remainingAmount))
      e.amount = `Cannot exceed purchase remaining ₹${fmt(selectedPurchase.remainingAmount)}`;
    if (!form.paymentDate)              e.paymentDate    = "Payment date is required";
    if (needsRef && !form.referenceNumber) e.referenceNumber = `Reference required for ${form.paymentMode}`;
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/Record`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId:      selectedSupplier.id,
          purchaseId:      selectedPurchase?.id || null,
          amount:          parseFloat(form.amount),
          paymentMode:     form.paymentMode,
          referenceNumber: form.referenceNumber || null,
          paymentDate:     form.paymentDate,
          notes:           form.notes || null,
        }),
      });
      const json = await res.json();
      if (json?.status === 200) {
        toast.success("Payment to supplier recorded successfully");
        onSubmit?.(); onClose?.();
      } else {
        setErrors({ general: json?.message || "Failed to record payment" });
      }
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const outstanding = selectedSupplier ? parseFloat(selectedSupplier.outstandingBalance || 0) : 0;
  const maxAmount   = selectedPurchase ? parseFloat(selectedPurchase.remainingAmount || 0) : outstanding;

  return (
    <div className="spx-backdrop">
      <div className="spx-modal">
        <div className="spx-top-beam" />
        <div className="spx-corner spx-tl" /><div className="spx-corner spx-tr" />
        <div className="spx-corner spx-bl" /><div className="spx-corner spx-br" />

        {/* HEADER */}
        <div className="spx-header">
          <div className="spx-header-left">
            <div className="spx-eyebrow"><span className="spx-eyebrow-dot" />PAY SUPPLIER</div>
            <h3 className="spx-title"><span className="spx-title-acc">//</span> Settle Supplier Payment</h3>
          </div>
          <button className="spx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="spx-divider" />

        {/* BODY */}
        <div className="spx-body">
          {errors.general && <div className="spx-alert">{errors.general}</div>}

          {/* Supplier select */}
          <div className="spx-field spx-field-full">
            <label className="spx-label">Supplier <span className="spx-req">*</span></label>
            <SearchDrop
              options={suppliers} value={selectedSupplier?.id}
              onChange={handleSupplierSelect}
              placeholder="Search supplier with outstanding dues…"
              dropRef={supplierRef} open={supplierOpen} setOpen={setSupplierOpen}
            />
            {errors.supplier && <span className="spx-error">{errors.supplier}</span>}
          </div>

          {/* Outstanding display */}
          {selectedSupplier && (
            <div className="spx-outstanding-card">
              <div className="spx-outstanding-row">
                <span className="spx-outstanding-label">You owe this supplier</span>
                <span className="spx-outstanding-amount spx-danger">₹{fmt(outstanding)}</span>
              </div>
              {selectedSupplier.phone && (
                <div className="spx-outstanding-row">
                  <span className="spx-outstanding-label">Phone</span>
                  <span className="spx-outstanding-sub">{selectedSupplier.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Link to specific purchase (optional) */}
          {selectedSupplier && (
            <div className="spx-field spx-field-full">
              <label className="spx-label">
                Link to specific purchase invoice
                <span className="spx-opt"> (optional — leave blank for general payment)</span>
              </label>
              <SearchDrop
                options={unpaidPurchases} value={selectedPurchase?.id}
                onChange={inv => {
                  setSelectedPurchase(inv);
                  setForm(p => ({ ...p, amount: String(inv.remainingAmount) }));
                }}
                placeholder={unpaidPurchases.length ? "Select purchase invoice" : "No pending invoices"}
                dropRef={purchaseRef} open={purchaseOpen} setOpen={setPurchaseOpen}
              />
              {selectedPurchase && (
                <div className="spx-invoice-tag">
                  <strong>{selectedPurchase.purchaseNumber}</strong>
                  — remaining <strong className="spx-danger"> ₹{fmt(selectedPurchase.remainingAmount)}</strong>
                  {selectedPurchase.purchaseDate && <span> · {selectedPurchase.purchaseDate}</span>}
                </div>
              )}
            </div>
          )}

          <div className="spx-grid">
            {/* Amount */}
            <div className="spx-field">
              <label className="spx-label">
                Amount (₹) <span className="spx-req">*</span>
                {maxAmount > 0 && <span className="spx-max"> max ₹{fmt(maxAmount)}</span>}
              </label>
              <input className={`spx-input ${errors.amount ? "spx-input-err" : ""}`}
                type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
                placeholder="0.00"
              />
              {errors.amount && <span className="spx-error">{errors.amount}</span>}
            </div>

            {/* Payment date */}
            <div className="spx-field">
              <label className="spx-label">Payment Date <span className="spx-req">*</span></label>
              <input className={`spx-input ${errors.paymentDate ? "spx-input-err" : ""}`}
                type="date" value={form.paymentDate}
                onChange={e => set("paymentDate", e.target.value)}
              />
              {errors.paymentDate && <span className="spx-error">{errors.paymentDate}</span>}
            </div>

            {/* Payment mode */}
            <div className="spx-field spx-field-full">
              <label className="spx-label">Payment Mode <span className="spx-req">*</span></label>
              <div className="spx-mode-row">
                {PAYMENT_MODES.map(m => (
                  <button key={m.id} type="button"
                    className={`spx-mode-btn ${form.paymentMode === m.id ? "spx-mode-active" : ""}`}
                    onClick={() => set("paymentMode", m.id)}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            {/* Reference number */}
            {needsRef && (
              <div className="spx-field spx-field-full">
                <label className="spx-label">
                  {form.paymentMode === "CHEQUE" ? "Cheque Number"
                    : form.paymentMode === "UPI" ? "UPI Transaction ID"
                    : "UTR / Reference Number"}
                  <span className="spx-req"> *</span>
                </label>
                <input className={`spx-input ${errors.referenceNumber ? "spx-input-err" : ""}`}
                  value={form.referenceNumber}
                  onChange={e => set("referenceNumber", e.target.value)}
                  placeholder={
                    form.paymentMode === "CHEQUE" ? "e.g. 123456"
                    : form.paymentMode === "UPI"  ? "e.g. 987654321098"
                    : "e.g. HDFC0012345678"
                  }
                />
                {errors.referenceNumber && <span className="spx-error">{errors.referenceNumber}</span>}
              </div>
            )}

            {/* Notes */}
            <div className="spx-field spx-field-full">
              <label className="spx-label">Notes <span className="spx-opt">(optional)</span></label>
              <textarea className="spx-input spx-textarea" rows={2}
                value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="e.g. Against invoice #PUR000045, partial payment for March stock"
              />
            </div>
          </div>

          {/* Live summary */}
          {selectedSupplier && form.amount && parseFloat(form.amount) > 0 && (
            <div className="spx-summary">
              <div className="spx-summary-row">
                <span>You currently owe</span>
                <span className="spx-danger">₹{fmt(outstanding)}</span>
              </div>
              <div className="spx-summary-row">
                <span>Paying now</span>
                <span className="spx-success">−₹{fmt(form.amount)}</span>
              </div>
              <div className="spx-summary-divider" />
              <div className="spx-summary-row spx-summary-net">
                <span>Remaining after payment</span>
                <span>₹{fmt(Math.max(0, outstanding - parseFloat(form.amount || 0)))}</span>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="spx-footer">
          <button type="button" className="spx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="spx-btn-primary" onClick={submit} disabled={loading}>
            {loading
              ? <><span className="spx-spinner" /> Recording…</>
              : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Pay Supplier</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
