import React, { useState, useEffect, useRef } from "react";
import "../../Styles/PaymentCollection/Payment.css";
import { toast } from "react-toastify";

const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen, displayKey = "name" }) => {
  const [search, setSearch] = useState("");
  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o =>
    (o[displayKey] || "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="pyx-drop-wrap" ref={dropRef}>
      <div className={`pyx-drop-box ${open ? "pyx-drop-open" : ""}`}
        onClick={() => { if (!open) setSearch(""); setOpen(!open); }}>
        <input className="pyx-drop-input"
          value={open ? search : (selected?.[displayKey] || "")}
          placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}
        />
        <span className="pyx-drop-arrow">{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <ul className="pyx-drop-list">
          {filtered.map(o => (
            <li key={o.id}
              className={String(o.id) === String(value) ? "pyx-drop-selected" : ""}
              onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false); setSearch(""); }}
            >
              <span>{o[displayKey]}</span>
              {o.sub && <span className="pyx-drop-sub">{o.sub}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="pyx-drop-empty">No results</li>}
        </ul>
      )}
    </div>
  );
};

const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CHEQUE"];
const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PaymentCollect({ onClose, onSubmit, prefillRetailerId = null }) {
  const [retailers, setRetailers]       = useState([]);
  const [unpaidInvoices, setUnpaid]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({});

  const [retailerOpen, setRetailerOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen]   = useState(false);
  const retailerRef = useRef(null);
  const invoiceRef  = useRef(null);

  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [selectedInvoice, setSelectedInvoice]   = useState(null);

  const [form, setForm] = useState({
    amount:          "",
    paymentMode:     "CASH",
    referenceNumber: "",
    paymentDate:     new Date().toISOString().split("T")[0],
    notes:           "",
  });

  /* ── FETCH RETAILERS WITH OUTSTANDING ── */
  useEffect(() => {
    fetch("http://localhost:8080/api/PaymentCollection/GetRetailersOutstanding", { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const list = (json?.data || []).map(r => ({
          id:   r.retailerId,
          name: r.shopName,
          sub:  `${r.retailerCode} · Outstanding: ₹${fmt(r.outstandingBalance)}`,
          outstandingBalance: r.outstandingBalance,
          creditLimit:        r.creditLimit,
          phone:              r.phone,
          retailerCode:       r.retailerCode,
        }));
        setRetailers(list);
        // Pre-fill if retailerId passed (from retailer ledger page)
        if (prefillRetailerId) {
          const found = list.find(r => String(r.id) === String(prefillRetailerId));
          if (found) handleRetailerSelect(found);
        }
      })
      .catch(() => {});
  }, []);

  /* ── LOAD UNPAID INVOICES WHEN RETAILER SELECTED ── */
  const handleRetailerSelect = (retailer) => {
    setSelectedRetailer(retailer);
    setSelectedInvoice(null);
    setForm(p => ({ ...p, amount: "" }));
    setErrors({});

    fetch(`http://localhost:8080/api/Sales/GetUnpaidInvoice/${retailer.id}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        const list = (json?.data || [])
          .filter(s => parseFloat(s.remainingAmount || 0) > 0)
          .map(s => ({
            id:   s.id,
            name: `${s.invoiceNumber} — ₹${fmt(s.remainingAmount)} due`,
            sub:  s.dueDate ? `Due: ${s.dueDate}` : "No due date",
            invoiceNumber:   s.invoiceNumber,
            remainingAmount: s.remainingAmount,
            dueDate:         s.dueDate,
          }));
        setUnpaid(list);
      })
      .catch(() => setUnpaid([]));
  };

  /* ── CLICK OUTSIDE ── */
  useEffect(() => {
    const h = e => {
      if (retailerRef.current && !retailerRef.current.contains(e.target)) setRetailerOpen(false);
      if (invoiceRef.current  && !invoiceRef.current.contains(e.target))  setInvoiceOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!selectedRetailer)       e.retailer = "Select a retailer";
    if (!form.amount || parseFloat(form.amount) <= 0)
      e.amount = "Enter a valid amount";
    if (selectedRetailer && parseFloat(form.amount) > parseFloat(selectedRetailer.outstandingBalance))
      e.amount = `Cannot exceed outstanding ₹${fmt(selectedRetailer.outstandingBalance)}`;
    if (selectedInvoice && parseFloat(form.amount) > parseFloat(selectedInvoice.remainingAmount))
      e.amount = `Cannot exceed invoice remaining ₹${fmt(selectedInvoice.remainingAmount)}`;
    if (!form.paymentDate)       e.paymentDate = "Payment date is required";
    if (!form.paymentMode)       e.paymentMode = "Select payment mode";
    if ((form.paymentMode === "UPI" || form.paymentMode === "CHEQUE") && !form.referenceNumber)
      e.referenceNumber = "Reference number required for UPI/Cheque";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    try {
      const payload = {
        retailerId:      selectedRetailer.id,
        salesId:         selectedInvoice?.id || null,
        amount:          parseFloat(form.amount),
        paymentMode:     form.paymentMode,
        referenceNumber: form.referenceNumber || null,
        paymentDate:     form.paymentDate,
        notes:           form.notes || null,
      };
      const res  = await fetch("http://localhost:8080/api/PaymentCollection/CollectPayment", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        toast.success("Payment collected successfully");
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

  const outstanding = selectedRetailer ? parseFloat(selectedRetailer.outstandingBalance || 0) : 0;
  const maxAmount   = selectedInvoice
    ? parseFloat(selectedInvoice.remainingAmount || 0)
    : outstanding;

  return (
    <div className="pyx-backdrop">
      <div className="pyx-modal">
        <div className="pyx-top-beam" />
        <div className="pyx-corner pyx-tl" /><div className="pyx-corner pyx-tr" />
        <div className="pyx-corner pyx-bl" /><div className="pyx-corner pyx-br" />

        {/* ── HEADER ── */}
        <div className="pyx-header">
          <div className="pyx-header-left">
            <div className="pyx-eyebrow"><span className="pyx-eyebrow-dot" />COLLECT PAYMENT</div>
            <h3 className="pyx-title"><span className="pyx-title-acc">//</span> Record Payment Collection</h3>
          </div>
          <button className="pyx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="pyx-divider" />

        {/* ── BODY ── */}
        <div className="pyx-body">
          {errors.general && <div className="pyx-alert">{errors.general}</div>}

          {/* ── RETAILER SELECT ── */}
          <div className="pyx-field pyx-field-full">
            <label className="pyx-label">Retailer <span className="pyx-req">*</span></label>
            <SearchDrop
              options={retailers} value={selectedRetailer?.id}
              onChange={handleRetailerSelect}
              placeholder="Search retailer with outstanding…"
              dropRef={retailerRef} open={retailerOpen} setOpen={setRetailerOpen}
            />
            {errors.retailer && <span className="pyx-error">{errors.retailer}</span>}
          </div>

          {/* ── OUTSTANDING DISPLAY ── */}
          {selectedRetailer && (
            <div className="pyx-outstanding-card">
              <div className="pyx-outstanding-row">
                <span className="pyx-outstanding-label">Total outstanding</span>
                <span className="pyx-outstanding-amount pyx-danger">₹{fmt(outstanding)}</span>
              </div>
              {selectedRetailer.phone && (
                <div className="pyx-outstanding-row">
                  <span className="pyx-outstanding-label">Phone</span>
                  <span className="pyx-outstanding-sub">{selectedRetailer.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* ── INVOICE LINK (optional) ── */}
          {selectedRetailer && (
            <div className="pyx-field pyx-field-full">
              <label className="pyx-label">Link to specific invoice <span className="pyx-opt">(optional)</span></label>
              <SearchDrop
                options={unpaidInvoices} value={selectedInvoice?.id}
                onChange={inv => {
                  setSelectedInvoice(inv);
                  setForm(p => ({ ...p, amount: String(inv.remainingAmount) }));
                }}
                placeholder={unpaidInvoices.length ? "Select invoice or leave blank for general payment" : "No unpaid invoices"}
                dropRef={invoiceRef} open={invoiceOpen} setOpen={setInvoiceOpen}
              />
              {selectedInvoice && (
                <div className="pyx-invoice-tag">
                  Invoice <strong>{selectedInvoice.invoiceNumber}</strong> — remaining
                  <strong className="pyx-danger"> ₹{fmt(selectedInvoice.remainingAmount)}</strong>
                  {selectedInvoice.dueDate && <span> · Due: {selectedInvoice.dueDate}</span>}
                </div>
              )}
            </div>
          )}

          {/* ── AMOUNT + DATE ── */}
          <div className="pyx-grid">
            <div className="pyx-field">
              <label className="pyx-label">
                Amount (₹) <span className="pyx-req">*</span>
                {maxAmount > 0 && <span className="pyx-max"> max ₹{fmt(maxAmount)}</span>}
              </label>
              <input className={`pyx-input ${errors.amount ? "pyx-input-err" : ""}`}
                type="number" min="0.01" step="0.01"
                value={form.amount}
                onChange={e => set("amount", e.target.value)}
                placeholder="0.00"
              />
              {errors.amount && <span className="pyx-error">{errors.amount}</span>}
            </div>

            <div className="pyx-field">
              <label className="pyx-label">Payment Date <span className="pyx-req">*</span></label>
              <input className={`pyx-input ${errors.paymentDate ? "pyx-input-err" : ""}`}
                type="date" value={form.paymentDate}
                onChange={e => set("paymentDate", e.target.value)}
              />
              {errors.paymentDate && <span className="pyx-error">{errors.paymentDate}</span>}
            </div>

            {/* ── PAYMENT MODE ── */}
            <div className="pyx-field pyx-field-full">
              <label className="pyx-label">Payment Mode <span className="pyx-req">*</span></label>
              <div className="pyx-mode-row">
                {PAYMENT_MODES.map(m => (
                  <button key={m} type="button"
                    className={`pyx-mode-btn ${form.paymentMode === m ? "pyx-mode-active" : ""}`}
                    onClick={() => set("paymentMode", m)}
                  >{m}</button>
                ))}
              </div>
              {errors.paymentMode && <span className="pyx-error">{errors.paymentMode}</span>}
            </div>

            {/* ── REFERENCE (UPI/CHEQUE) ── */}
            {(form.paymentMode === "UPI" || form.paymentMode === "CHEQUE") && (
              <div className="pyx-field pyx-field-full">
                <label className="pyx-label">
                  {form.paymentMode === "UPI" ? "UPI Transaction ID" : "Cheque Number"}
                  <span className="pyx-req"> *</span>
                </label>
                <input className={`pyx-input ${errors.referenceNumber ? "pyx-input-err" : ""}`}
                  value={form.referenceNumber}
                  onChange={e => set("referenceNumber", e.target.value)}
                  placeholder={form.paymentMode === "UPI" ? "e.g. 987654321098" : "e.g. 123456"}
                />
                {errors.referenceNumber && <span className="pyx-error">{errors.referenceNumber}</span>}
              </div>
            )}

            {/* ── NOTES ── */}
            <div className="pyx-field pyx-field-full">
              <label className="pyx-label">Notes <span className="pyx-opt">(optional)</span></label>
              <textarea className="pyx-input pyx-textarea" rows={2}
                value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Any additional notes about this payment…"
              />
            </div>
          </div>

          {/* ── SUMMARY BEFORE SAVE ── */}
          {selectedRetailer && form.amount && parseFloat(form.amount) > 0 && (
            <div className="pyx-summary">
              <div className="pyx-summary-row">
                <span>Current outstanding</span>
                <span className="pyx-danger">₹{fmt(outstanding)}</span>
              </div>
              <div className="pyx-summary-row">
                <span>Collecting</span>
                <span className="pyx-success">−₹{fmt(form.amount)}</span>
              </div>
              <div className="pyx-summary-divider" />
              <div className="pyx-summary-row pyx-summary-net">
                <span>Remaining after this payment</span>
                <span>₹{fmt(Math.max(0, outstanding - parseFloat(form.amount || 0)))}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="pyx-footer">
          <button type="button" className="pyx-btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="pyx-btn-primary" onClick={submit} disabled={loading}>
            {loading
              ? <><span className="pyx-spinner" /> Recording…</>
              : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> Collect Payment</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
