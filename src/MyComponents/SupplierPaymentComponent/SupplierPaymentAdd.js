import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const API = `${API_BASE_URL}/api/SupplierPayment`;
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
    <div className="afx-searchdrop" ref={dropRef}>
      <div className={`afx-searchdrop-face ${open ? "is-open" : ""} ${selected ? "is-filled" : ""}`}
        onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
        <span>{selected?.[displayKey] || placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      {open && (
        <div className="afx-searchdrop-panel">
          <input className="afx-searchdrop-input" autoFocus
            value={search}
            placeholder="Search…"
            onChange={e => setSearch(e.target.value)}
          />
          <div className="afx-searchdrop-list">
            {filtered.length === 0 ? (
              <div className="afx-searchdrop-empty">No results</div>
            ) : filtered.map(o => (
              <div key={o.id}
                className={`afx-searchdrop-item ${String(o.id) === String(value) ? "is-selected" : ""}`}
                onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); setSearch(""); }}
              >
                <div>{o[displayKey]}</div>
                {o.sub && <div style={{ fontSize: 11, color: "var(--afx-text-3)" }}>{o.sub}</div>}
              </div>
            ))}
          </div>
        </div>
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
    apiClient(`${API}/SuppliersWithOutstanding`)
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
    apiClient(`${API_BASE_URL}/api/Purchase/GetUnpaidInvoice/${supplier.id}`)
      .then(r => r.json())
      .then(j => {
        const list = (j?.data || []).map(p => ({
          id:   p.id,
          name: `${p.invoiceNumber} — ₹${fmt(p.remainingAmount)} due`,
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
      const res  = await apiClient(`${API}/Record`, {
        method: "POST",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Pay Supplier</div>
            <h3 className="afx-title">Settle Supplier Payment</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {errors.general && <div className="afx-alert">{errors.general}</div>}

          <div className="afx-field">
            <label className="afx-label">Supplier<span className="afx-req">*</span></label>
            <SearchDrop
              options={suppliers} value={selectedSupplier?.id}
              onChange={handleSupplierSelect}
              placeholder="Search supplier with outstanding dues…"
              dropRef={supplierRef} open={supplierOpen} setOpen={setSupplierOpen}
            />
            {errors.supplier && <span className="afx-error">{errors.supplier}</span>}
          </div>

          {selectedSupplier && (
            <div className="afx-card">
              <div className="afx-card-row">
                <span>You owe this supplier</span>
                <strong className="afx-text-danger">₹{fmt(outstanding)}</strong>
              </div>
              {selectedSupplier.phone && (
                <div className="afx-card-row">
                  <span>Phone</span>
                  <span>{selectedSupplier.phone}</span>
                </div>
              )}
            </div>
          )}

          {selectedSupplier && (
            <div className="afx-field">
              <label className="afx-label">
                Link to specific purchase invoice
                <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}> (optional — leave blank for general payment)</span>
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
                <div className="afx-tag" style={{ marginTop: 6 }}>
                  <strong style={{ color: "var(--afx-text-1)" }}>{selectedPurchase.purchaseNumber}</strong>
                  &nbsp;— remaining <strong className="afx-text-danger">&nbsp;₹{fmt(selectedPurchase.remainingAmount)}</strong>
                  {selectedPurchase.purchaseDate && <span>&nbsp;· {selectedPurchase.purchaseDate}</span>}
                </div>
              )}
            </div>
          )}

          <div className="afx-grid">
            <div className="afx-field">
              <label className="afx-label">
                Amount (₹)<span className="afx-req">*</span>
                {maxAmount > 0 && <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}> max ₹{fmt(maxAmount)}</span>}
              </label>
              <input className={`afx-input ${errors.amount ? "afx-input--err" : ""}`}
                type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
                placeholder="0.00"
              />
              {errors.amount && <span className="afx-error">{errors.amount}</span>}
            </div>

            <div className="afx-field">
              <label className="afx-label">Payment Date<span className="afx-req">*</span></label>
              <input className={`afx-input ${errors.paymentDate ? "afx-input--err" : ""}`}
                type="date" value={form.paymentDate}
                onChange={e => set("paymentDate", e.target.value)}
              />
              {errors.paymentDate && <span className="afx-error">{errors.paymentDate}</span>}
            </div>

            <div className="afx-field afx-field--full">
              <label className="afx-label">Payment Mode<span className="afx-req">*</span></label>
              <div className="afx-seg-row">
                {PAYMENT_MODES.map(m => (
                  <button key={m.id} type="button"
                    className={`afx-seg-btn ${form.paymentMode === m.id ? "is-active" : ""}`}
                    onClick={() => set("paymentMode", m.id)}
                  >{m.label}</button>
                ))}
              </div>
            </div>

            {needsRef && (
              <div className="afx-field afx-field--full">
                <label className="afx-label">
                  {form.paymentMode === "CHEQUE" ? "Cheque Number"
                    : form.paymentMode === "UPI" ? "UPI Transaction ID"
                    : "UTR / Reference Number"}
                  <span className="afx-req">*</span>
                </label>
                <input className={`afx-input ${errors.referenceNumber ? "afx-input--err" : ""}`}
                  value={form.referenceNumber}
                  onChange={e => set("referenceNumber", e.target.value)}
                  placeholder={
                    form.paymentMode === "CHEQUE" ? "e.g. 123456"
                    : form.paymentMode === "UPI"  ? "e.g. 987654321098"
                    : "e.g. HDFC0012345678"
                  }
                />
                {errors.referenceNumber && <span className="afx-error">{errors.referenceNumber}</span>}
              </div>
            )}

            <div className="afx-field afx-field--full">
              <label className="afx-label">Notes <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}>(optional)</span></label>
              <textarea className="afx-textarea" rows={2}
                value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="e.g. Against invoice #PUR000045, partial payment for March stock"
              />
            </div>
          </div>

          {selectedSupplier && form.amount && parseFloat(form.amount) > 0 && (
            <div className="afx-totals">
              <div className="afx-totals-row">
                <span>You currently owe</span>
                <span className="afx-text-danger">₹{fmt(outstanding)}</span>
              </div>
              <div className="afx-totals-row">
                <span>Paying now</span>
                <span className="afx-text-success">−₹{fmt(form.amount)}</span>
              </div>
              <div className="afx-totals-divider" />
              <div className="afx-totals-row afx-totals-grand">
                <span>Remaining after payment</span>
                <span>₹{fmt(Math.max(0, outstanding - parseFloat(form.amount || 0)))}</span>
              </div>
            </div>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="afx-spinner" /> Recording…</> : "Pay Supplier"}
          </button>
        </div>
      </div>
    </div>
  );
}
