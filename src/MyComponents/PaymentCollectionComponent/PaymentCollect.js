import React, { useState, useEffect, useRef } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const SearchDrop = ({ options, value, onChange, placeholder, dropRef, open, setOpen, displayKey = "name" }) => {
  const [search, setSearch] = useState("");
  const selected = options.find(o => String(o.id) === String(value));
  const filtered = options.filter(o =>
    (o[displayKey] || "").toLowerCase().includes(search.toLowerCase())
  );
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

const PAYMENT_MODES = ["CASH", "UPI", "CARD", "CHEQUE"];
const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PaymentCollect({
  onClose,
  onSubmit,
  prefillRetailerId = null,
  prefillSalesId = null,
  prefillSalesUKey = null,
  prefillInvoiceNumber = null,
  prefillAmount = null,
}) {
  const [retailers, setRetailers]       = useState([]);
  const [unpaidInvoices, setUnpaid]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [errors, setErrors]             = useState({});
  const [salesPrefill, setSalesPrefill] = useState(null);

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

  const effectiveRetailerId = salesPrefill?.retailerId || prefillRetailerId;
  const effectiveSalesId = salesPrefill?.id || prefillSalesId;
  const effectiveInvoiceNumber = salesPrefill?.invoiceNumber || prefillInvoiceNumber;
  const effectiveAmount = salesPrefill?.remainingAmount || prefillAmount;

  useEffect(() => {
    if (!prefillSalesUKey || prefillRetailerId) return;

    apiClient(`${API_BASE_URL}/api/Sales/GetSalesByUkey/${prefillSalesUKey}`)
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) setSalesPrefill(json.data);
      })
      .catch(() => {});
  }, [prefillSalesUKey, prefillRetailerId]);

  /* ── FETCH RETAILERS WITH OUTSTANDING ── */
  useEffect(() => {
    apiClient(`${API_BASE_URL}/api/PaymentCollection/GetRetailersOutstanding`)
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
      })
      .catch(() => {});
  }, []);

  /* ── LOAD UNPAID INVOICES WHEN RETAILER SELECTED ── */
  const handleRetailerSelect = (retailer, prefill = {}) => {
    setSelectedRetailer(retailer);
    setSelectedInvoice(null);
    setForm(p => ({ ...p, amount: prefill.amount ? String(prefill.amount) : "" }));
    setErrors({});

    apiClient(`${API_BASE_URL}/api/Sales/GetUnpaidInvoice/${retailer.id}`)
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

        const matchedInvoice = list.find(inv =>
          (prefill.salesId && String(inv.id) === String(prefill.salesId)) ||
          (prefill.invoiceNumber && String(inv.invoiceNumber) === String(prefill.invoiceNumber))
        );

        if (matchedInvoice) {
          setSelectedInvoice(matchedInvoice);
          setForm(p => ({ ...p, amount: String(prefill.amount || matchedInvoice.remainingAmount || "") }));
        } else if (prefill.salesId) {
          setSelectedInvoice({
            id: prefill.salesId,
            name: `${prefill.invoiceNumber || "Invoice"} - Rs ${fmt(prefill.amount)} due`,
            sub: prefill.dueDate ? `Due: ${prefill.dueDate}` : "Selected invoice",
            invoiceNumber: prefill.invoiceNumber,
            remainingAmount: prefill.amount,
            dueDate: prefill.dueDate,
          });
        }
      })
      .catch(() => {
        setUnpaid([]);
        if (prefill.salesId) {
          setSelectedInvoice({
            id: prefill.salesId,
            name: `${prefill.invoiceNumber || "Invoice"} - Rs ${fmt(prefill.amount)} due`,
            sub: prefill.dueDate ? `Due: ${prefill.dueDate}` : "Selected invoice",
            invoiceNumber: prefill.invoiceNumber,
            remainingAmount: prefill.amount,
            dueDate: prefill.dueDate,
          });
        }
      });
  };

  useEffect(() => {
    if (!effectiveRetailerId || selectedRetailer) return;
    if (!retailers.length && !salesPrefill?.retailerId) return;

    const found = retailers.find(r => String(r.id) === String(effectiveRetailerId));
    if (found) {
      handleRetailerSelect(found, {
        salesId: effectiveSalesId,
        invoiceNumber: effectiveInvoiceNumber,
        amount: effectiveAmount,
        dueDate: salesPrefill?.dueDate,
      });
    } else if (salesPrefill?.retailerId) {
      handleRetailerSelect({
        id: salesPrefill.retailerId,
        name: salesPrefill.retailerName || "Retailer",
        sub: `${salesPrefill.retailerCode || "Retailer"} - Outstanding: Rs ${fmt(effectiveAmount)}`,
        outstandingBalance: effectiveAmount,
        retailerCode: salesPrefill.retailerCode,
      }, {
        salesId: effectiveSalesId,
        invoiceNumber: effectiveInvoiceNumber,
        amount: effectiveAmount,
        dueDate: salesPrefill?.dueDate,
      });
    }
  }, [retailers, effectiveRetailerId, effectiveSalesId, effectiveInvoiceNumber, effectiveAmount, selectedRetailer, salesPrefill]);

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
      const res  = await apiClient(`${API_BASE_URL}/api/PaymentCollection/CollectPayment`, {
        method: "POST",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Collect Payment</div>
            <h3 className="afx-title">Record Payment Collection</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {errors.general && <div className="afx-alert">{errors.general}</div>}

          <div className="afx-field">
            <label className="afx-label">Retailer<span className="afx-req">*</span></label>
            <SearchDrop
              options={retailers} value={selectedRetailer?.id}
              onChange={handleRetailerSelect}
              placeholder="Search retailer with outstanding…"
              dropRef={retailerRef} open={retailerOpen} setOpen={setRetailerOpen}
            />
            {errors.retailer && <span className="afx-error">{errors.retailer}</span>}
          </div>

          {selectedRetailer && (
            <div className="afx-card">
              <div className="afx-card-row">
                <span>Total outstanding</span>
                <strong className="afx-text-danger">₹{fmt(outstanding)}</strong>
              </div>
              {selectedRetailer.phone && (
                <div className="afx-card-row">
                  <span>Phone</span>
                  <span>{selectedRetailer.phone}</span>
                </div>
              )}
            </div>
          )}

          {selectedRetailer && (
            <div className="afx-field">
              <label className="afx-label">Link to specific invoice <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}>(optional)</span></label>
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
                <div className="afx-tag" style={{ marginTop: 6 }}>
                  Invoice <strong style={{ color: "var(--afx-text-1)" }}>&nbsp;{selectedInvoice.invoiceNumber}&nbsp;</strong> — remaining
                  <strong className="afx-text-danger">&nbsp;₹{fmt(selectedInvoice.remainingAmount)}</strong>
                  {selectedInvoice.dueDate && <span>&nbsp;· Due: {selectedInvoice.dueDate}</span>}
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
                  <button key={m} type="button"
                    className={`afx-seg-btn ${form.paymentMode === m ? "is-active" : ""}`}
                    onClick={() => set("paymentMode", m)}
                  >{m}</button>
                ))}
              </div>
              {errors.paymentMode && <span className="afx-error">{errors.paymentMode}</span>}
            </div>

            {(form.paymentMode === "UPI" || form.paymentMode === "CHEQUE") && (
              <div className="afx-field afx-field--full">
                <label className="afx-label">
                  {form.paymentMode === "UPI" ? "UPI Transaction ID" : "Cheque Number"}
                  <span className="afx-req">*</span>
                </label>
                <input className={`afx-input ${errors.referenceNumber ? "afx-input--err" : ""}`}
                  value={form.referenceNumber}
                  onChange={e => set("referenceNumber", e.target.value)}
                  placeholder={form.paymentMode === "UPI" ? "e.g. 987654321098" : "e.g. 123456"}
                />
                {errors.referenceNumber && <span className="afx-error">{errors.referenceNumber}</span>}
              </div>
            )}

            <div className="afx-field afx-field--full">
              <label className="afx-label">Notes <span style={{ color: "var(--afx-text-3)", fontWeight: 400 }}>(optional)</span></label>
              <textarea className="afx-textarea" rows={2}
                value={form.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Any additional notes about this payment…"
              />
            </div>
          </div>

          {selectedRetailer && form.amount && parseFloat(form.amount) > 0 && (
            <div className="afx-totals">
              <div className="afx-totals-row">
                <span>Current outstanding</span>
                <span className="afx-text-danger">₹{fmt(outstanding)}</span>
              </div>
              <div className="afx-totals-row">
                <span>Collecting</span>
                <span className="afx-text-success">−₹{fmt(form.amount)}</span>
              </div>
              <div className="afx-totals-divider" />
              <div className="afx-totals-row afx-totals-grand">
                <span>Remaining after this payment</span>
                <span>₹{fmt(Math.max(0, outstanding - parseFloat(form.amount || 0)))}</span>
              </div>
            </div>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="afx-spinner" /> Recording…</> : "Collect Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
