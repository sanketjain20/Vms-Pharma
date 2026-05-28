import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import "../../Styles/SalesReturn/SalesReturnAdd.css";
import { getApiMessage, toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
/* ── Searchable Dropdown (reused pattern) ── */
const SearchableDropdown = ({
  label, options, selectedId, onSelect,
  search, setSearch, open, setOpen,
  placeholder, dropdownRef, error,
}) => {
  const selected = options.find(o => String(o.id) === String(selectedId));
  const display  = open ? search : (selected?.name ?? "");
  const filtered = options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="sra-dropdown" ref={dropdownRef}>
      <label>{label}</label>
      <div className={`sra-select-box ${open ? "active" : ""}`} onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}>
        <input
          type="text" value={display} placeholder={placeholder}
          onChange={e => setSearch(e.target.value)}
          onClick={e => { e.stopPropagation(); if (!open) setSearch(""); setOpen(true); }}
          className="sra-select-input"
        />
        {open && (
          <ul className="sra-options">
            {filtered.map(o => (
              <li key={o.id}
                onMouseDown={e => { e.preventDefault(); onSelect(o.id); setOpen(false); setSearch(""); }}
                style={String(o.id) === String(selectedId) ? { color: "#93c5fd", background: "rgba(59,130,246,0.1)" } : {}}
              >{o.name}</li>
            ))}
            {filtered.length === 0 && <li style={{ color: "#525667", fontStyle: "italic" }}>No results found</li>}
          </ul>
        )}
      </div>
      {error && <div className="sra-error">{error}</div>}
    </div>
  );
};

export default function SalesReturnAdd({ onClose, onSubmit }) {
  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1); // 1 = find sale, 2 = pick items & submit

  // ── Step 1: find sale by uKey or invoiceNumber ────────────────────────────
  const [salesInvoiceNumber, setSalesInvoiceNumber] = useState("");
  const [saleData, setSaleData]                     = useState(null);
  const [fetchErr, setFetchErr]                     = useState("");
  const [fetching, setFetching]                     = useState(false);

  // ── Step 2: return form ───────────────────────────────────────────────────
  const [returnLines, setReturnLines]   = useState([]); // { salesItemId, max, productName, returnQuantity, batchSnapshot, expirySnapshot }
  const [returnReason, setReturnReason] = useState("");
  const [refundMode, setRefundMode]     = useState("CASH");
  const [errors, setErrors]             = useState({});
  const [submitting, setSubmitting]     = useState(false);

  // ── Fetch original sale ───────────────────────────────────────────────────
  const findSale = async () => {
    if (!salesInvoiceNumber.trim()) { setFetchErr("Enter a sales invoice number"); return; }
    setFetching(true); setFetchErr(""); setSaleData(null);
    try {
      const res  = await fetch(
        `${API_BASE_URL}/api/Sales/GetSalesByInvoiceNumber/${salesInvoiceNumber.trim()}`,
        { method: "GET", credentials: "include" }
      );
      const json = await res.json();
      if (json.status === 200 && json.data) {
        setSaleData(json.data);
        // Pre-fill return lines — each item defaults to 0 qty return
        setReturnLines(
          json.data.items.map(item => ({
            salesItemId:    item.id,
            productName:    item.product,
            sellingPrice:   item.sellingPrice,
            max:            item.quantity,
            batchSnapshot:  item.batchNumberSnapshot,
            expirySnapshot: item.expiryDateSnapshot,
            hsnSnapshot:    item.hsnCodeSnapshot,
            returnQuantity: 0,
          }))
        );
        setStep(2);
        toast.success("Sale loaded successfully");
      } else {
        const message = getApiMessage(json, "Sale not found");
        setFetchErr(message);
        toastApiError(json, "Sale not found");
      }
    } catch (e) {
      const message = "Network error: " + e.message;
      setFetchErr(message);
      toast.error(message);
    } finally {
      setFetching(false);
    }
  };

  const updateQty = (idx, val) => {
    const lines = [...returnLines];
    const parsed = parseInt(val) || 0;
    lines[idx].returnQuantity = Math.min(Math.max(0, parsed), lines[idx].max);
    setReturnLines(lines);
  };

  // ── Totals preview ────────────────────────────────────────────────────────
  const totalReturnAmt = returnLines.reduce(
    (s, l) => s + (l.returnQuantity * l.sellingPrice), 0
  );
  const anySelected = returnLines.some(l => l.returnQuantity > 0);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const errs = {};
    if (!anySelected)    errs.lines      = "Select at least one item to return";
    if (!returnReason.trim()) errs.reason = "Return reason is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(Object.values(errs)[0]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        salesUKey:    saleData.uKey.trim(),
        returnReason: returnReason.trim(),
        refundMode,
        items: returnLines
          .filter(l => l.returnQuantity > 0)
          .map(l => ({ salesItemId: l.salesItemId, returnQuantity: l.returnQuantity })),
      };
      const res  = await fetch(`${API_BASE_URL}/api/SalesReturn/AddSalesReturn`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.status === 200) {
        toast.success(json?.message || "Sales return submitted successfully");
        onSubmit();
        onClose();
      }
      else {
        const message = getApiMessage(json, "Submission failed");
        setErrors({ submit: message });
        toastApiError(json, "Submission failed");
      }
    } catch (e) {
      const message = "Network error: " + e.message;
      setErrors({ submit: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const expiryColor = (d) => {
    if (!d) return "#6ee7b7";
    const exp = new Date(d);
    const now = new Date();
    const diff = (exp - now) / (1000 * 60 * 60 * 24);
    if (diff < 0)   return "#fca5a5";
    if (diff < 90)  return "#fbbf24";
    return "#6ee7b7";
  };

  return (
    <div className="sra-backdrop">
      <div className="sra-modal">
        <div className="sra-top-beam" />
        <div className="sra-corner sra-tl"/><div className="sra-corner sra-tr"/>
        <div className="sra-corner sra-bl"/><div className="sra-corner sra-br"/>

        
        <div className="sra-header">
          <div className="sra-header-left">
            <div className="sra-eyebrow">
              <span className="sra-eyebrow-dot" />
              {step === 1 ? "STEP 1 OF 2 · LOCATE SALE" : "STEP 2 OF 2 · PROCESS RETURN"}
            </div>
            <h3 className="sra-title">
              <span className="sra-title-acc"></span>
              {step === 1 ? "Find Original Sale" : `Return · ${saleData?.invoiceNumber}`}
            </h3>
          </div>
          <button className="sra-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        
        <div className="sra-progress">
          <div className={`sra-progress-step ${step >= 1 ? "active" : ""}`}>
            <span className="sra-progress-num">01</span>
            <span>Locate Sale</span>
          </div>
          <div className="sra-progress-line" />
          <div className={`sra-progress-step ${step >= 2 ? "active" : ""}`}>
            <span className="sra-progress-num">02</span>
            <span>Process Return</span>
          </div>
        </div>

        <div className="sra-body">

          
          {step === 1 && (
            <div className="sra-step">
              <div className="sra-info-banner">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6.5 5.5V9M6.5 4h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Enter the sales invoice number from the original invoice to begin the return process.
              </div>

              <label className="sra-label">Sales Invoice Number</label>
              <div className="sra-ukey-row">
                <input
                  type="text"
                  className="sra-input"
                  placeholder="e.g. INV000001"
                  value={salesInvoiceNumber}
                  onChange={e => { setSalesInvoiceNumber(e.target.value); setFetchErr(""); }}
                  onKeyDown={e => e.key === "Enter" && findSale()}
                />
                <button className="sra-btn-find" onClick={findSale} disabled={fetching}>
                  {fetching ? (
                    <div className="sra-mini-loader"><div/><div/></div>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M8.5 8.5L12 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {fetching ? "Searching…" : "Find Sale"}
                </button>
              </div>
              {fetchErr && (
                <div className="sra-error-banner">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M6 3.5V6.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {fetchErr}
                </div>
              )}
            </div>
          )}

          
          {step === 2 && saleData && (
            <div className="sra-step">

              
              <div className="sra-sale-meta">
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Invoice</span>
                  <span className="sra-meta-val">{saleData.invoiceNumber}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Date</span>
                  <span className="sra-meta-val">{saleData.createdAt}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Party</span>
                  <span className="sra-meta-val">{saleData.retailerName || saleData.customerName || "Walk-in"}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Net Amount</span>
                  <span className="sra-meta-val sra-meta-accent">₹{Number(saleData.netAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              
              <label className="sra-label">Return Reason <span className="sra-required">*</span></label>
              <textarea
                className="sra-textarea"
                rows={2}
                placeholder="e.g. Damaged product, wrong item delivered, customer changed mind…"
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
              />
              {errors.reason && <div className="sra-error">{errors.reason}</div>}

              
              <label className="sra-label">Refund Mode</label>
              <div className="sra-radio-group">
                {[
                  { val: "CASH",        label: "Cash",        icon: "💵" },
                  { val: "CREDIT_NOTE", label: "Credit Note", icon: "📄" },
                  { val: "BANK",        label: "Bank Transfer",icon: "🏦" },
                ].map(m => (
                  <label key={m.val} className={`sra-radio ${refundMode === m.val ? "checked" : ""}`}>
                    <input type="radio" checked={refundMode === m.val} onChange={() => setRefundMode(m.val)} />
                    <span>{m.icon}</span>
                    {m.label}
                  </label>
                ))}
              </div>

              
              <div className="sra-items-header">
                <span className="sra-section-title">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="1" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="6.5" y="1" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="1" y="6.5" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/>
                    <rect x="6.5" y="6.5" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/>
                  </svg>
                  Select Return Quantities
                </span>
                <span className="sra-items-note">Set 0 to skip an item</span>
              </div>

              {errors.lines && <div className="sra-error-banner" style={{ marginBottom: 12 }}>{errors.lines}</div>}

              <div className="sra-items-table-wrap">
                <table className="sra-items-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch No</th>
                      <th>Expiry</th>
                      <th>HSN</th>
                      <th>Sold Qty</th>
                      <th>Price (₹)</th>
                      <th>Return Qty</th>
                      <th>Return Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnLines.map((line, idx) => {
                      const active = line.returnQuantity > 0;
                      return (
                        <tr key={idx} className={active ? "sra-row-active" : ""}>
                          <td className="sra-td-product">{line.productName}</td>
                          <td style={{ fontFamily: "var(--sra-font-m)", fontSize: 10.5, color: "#93c5fd" }}>
                            {line.batchSnapshot || "—"}
                          </td>
                          <td>
                            {line.expirySnapshot ? (
                              <span style={{
                                color: expiryColor(line.expirySnapshot),
                                fontFamily: "var(--sra-font-m)", fontSize: 10,
                              }}>{line.expirySnapshot}</span>
                            ) : "—"}
                          </td>
                          <td style={{ fontSize: 10, color: "var(--sra-text-2)" }}>{line.hsnSnapshot || "—"}</td>
                          <td className="sra-td-center">{line.max}</td>
                          <td className="sra-td-center">₹{line.sellingPrice}</td>
                          <td>
                            <div className="sra-qty-control">
                              <button
                                className="sra-qty-btn"
                                onClick={() => updateQty(idx, line.returnQuantity - 1)}
                                disabled={line.returnQuantity <= 0}
                              >−</button>
                              <input
                                type="number"
                                className="sra-qty-input"
                                value={line.returnQuantity}
                                min={0}
                                max={line.max}
                                onChange={e => updateQty(idx, e.target.value)}
                              />
                              <button
                                className="sra-qty-btn"
                                onClick={() => updateQty(idx, line.returnQuantity + 1)}
                                disabled={line.returnQuantity >= line.max}
                              >+</button>
                            </div>
                          </td>
                          <td className={`sra-td-amount ${active ? "sra-amount-active" : ""}`}>
                            ₹{(line.returnQuantity * line.sellingPrice).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              
              <div className="sra-total-preview">
                <span>Estimated Refund</span>
                <span className="sra-total-amt">₹{totalReturnAmt.toFixed(2)}</span>
              </div>

              {errors.submit && (
                <div className="sra-error-banner" style={{ marginTop: 12 }}>{errors.submit}</div>
              )}
            </div>
          )}
        </div>

        
        <div className="sra-footer">
          {step === 2 && (
            <button className="sra-btn-back" onClick={() => { setStep(1); setSaleData(null); }}>
              ← Back
            </button>
          )}
          <button className="sra-btn-cancel" onClick={onClose}>Cancel</button>
          {step === 2 && (
            <button className="sra-btn-submit" onClick={handleSubmit} disabled={submitting || !anySelected}>
              {submitting ? "Processing…" : "Submit Return"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
