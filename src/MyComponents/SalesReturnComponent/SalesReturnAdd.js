import React, { useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { getApiMessage, toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

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
      const res  = await apiClient(
        `${API_BASE_URL}/api/Sales/GetSalesByInvoiceNumber/${salesInvoiceNumber.trim()}`,
        { method: "GET" }
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
      const res  = await apiClient(`${API_BASE_URL}/api/SalesReturn/AddSalesReturn`, {
        method: "POST",
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
    if (!d) return "var(--afx-success)";
    const exp = new Date(d);
    const now = new Date();
    const diff = (exp - now) / (1000 * 60 * 60 * 24);
    if (diff < 0)   return "var(--afx-danger)";
    if (diff < 90)  return "var(--afx-warning)";
    return "var(--afx-success)";
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />
              {step === 1 ? "Step 1 of 2 · Locate Sale" : "Step 2 of 2 · Process Return"}
            </div>
            <h3 className="afx-title">
              {step === 1 ? "Find Original Sale" : `Return · ${saleData?.invoiceNumber}`}
            </h3>
          </div>
          <button className="afx-close" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-progress">
          <div className={`afx-progress-step ${step >= 1 ? "is-active" : ""}`}>
            <span className="afx-progress-num">01</span>
            <span>Locate Sale</span>
          </div>
          <div className="afx-progress-line" />
          <div className={`afx-progress-step ${step >= 2 ? "is-active" : ""}`}>
            <span className="afx-progress-num">02</span>
            <span>Process Return</span>
          </div>
        </div>

        <div className="afx-body">
          {step === 1 && (
            <div>
              <div className="afx-info" style={{ marginBottom: 14 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M6.5 5.5V9M6.5 4h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Enter the sales invoice number from the original invoice to begin the return process.
              </div>

              <label className="afx-label">Sales Invoice Number</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  className="afx-input"
                  placeholder="e.g. INV000001"
                  value={salesInvoiceNumber}
                  onChange={e => { setSalesInvoiceNumber(e.target.value); setFetchErr(""); }}
                  onKeyDown={e => e.key === "Enter" && findSale()}
                />
                <button className="afx-btn afx-btn--primary" style={{ flexShrink: 0 }} onClick={findSale} disabled={fetching}>
                  {fetching ? <><span className="afx-spinner" /> Searching…</> : "Find Sale"}
                </button>
              </div>
              {fetchErr && <div className="afx-alert" style={{ marginTop: 10 }}>{fetchErr}</div>}
            </div>
          )}

          {step === 2 && saleData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="afx-meta-cards">
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Invoice</span>
                  <span className="afx-meta-card-val">{saleData.invoiceNumber}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Date</span>
                  <span className="afx-meta-card-val">{saleData.createdAt}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Party</span>
                  <span className="afx-meta-card-val">{saleData.retailerName || saleData.customerName || "Walk-in"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Net Amount</span>
                  <span className="afx-meta-card-val" style={{ color: "var(--afx-accent)" }}>₹{Number(saleData.netAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="afx-field">
                <label className="afx-label">Return Reason<span className="afx-req">*</span></label>
                <textarea
                  className="afx-textarea"
                  rows={2}
                  placeholder="e.g. Damaged product, wrong item delivered, customer changed mind…"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                />
                {errors.reason && <div className="afx-error">{errors.reason}</div>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Refund Mode</label>
                <div className="afx-radio-group">
                  {[
                    { val: "CASH",        label: "Cash" },
                    { val: "CREDIT_NOTE", label: "Credit Note" },
                    { val: "BANK",        label: "Bank Transfer" },
                  ].map(m => (
                    <label key={m.val} className={`afx-radio ${refundMode === m.val ? "is-checked" : ""}`}>
                      <input type="radio" checked={refundMode === m.val} onChange={() => setRefundMode(m.val)} />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="afx-section-title" style={{ marginBottom: 8 }}>Select Return Quantities</div>
                {errors.lines && <div className="afx-alert" style={{ marginBottom: 10 }}>{errors.lines}</div>}

                <div className="afx-line-table" style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch</th>
                        <th>Expiry</th>
                        <th>HSN</th>
                        <th>Sold</th>
                        <th>Price (₹)</th>
                        <th>Return Qty</th>
                        <th>Return Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnLines.map((line, idx) => {
                        const active = line.returnQuantity > 0;
                        return (
                          <tr key={idx} style={active ? { background: "var(--afx-accent-soft)" } : undefined}>
                            <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{line.productName}</td>
                            <td style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{line.batchSnapshot || "—"}</td>
                            <td>
                              {line.expirySnapshot ? (
                                <span style={{ color: expiryColor(line.expirySnapshot), fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{line.expirySnapshot}</span>
                              ) : "—"}
                            </td>
                            <td style={{ fontSize: 11 }}>{line.hsnSnapshot || "—"}</td>
                            <td>{line.max}</td>
                            <td>₹{line.sellingPrice}</td>
                            <td>
                              <div className="afx-qty">
                                <button className="afx-qty-btn" onClick={() => updateQty(idx, line.returnQuantity - 1)} disabled={line.returnQuantity <= 0}>−</button>
                                <input
                                  type="number"
                                  className="afx-qty-input"
                                  value={line.returnQuantity}
                                  min={0}
                                  max={line.max}
                                  onChange={e => updateQty(idx, e.target.value)}
                                />
                                <button className="afx-qty-btn" onClick={() => updateQty(idx, line.returnQuantity + 1)} disabled={line.returnQuantity >= line.max}>+</button>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, color: active ? "var(--afx-accent)" : "var(--afx-text-2)" }}>
                              ₹{(line.returnQuantity * line.sellingPrice).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="afx-totals">
                <div className="afx-totals-row afx-totals-grand">
                  <span>Estimated Refund</span>
                  <span>₹{totalReturnAmt.toFixed(2)}</span>
                </div>
              </div>

              {errors.submit && <div className="afx-alert">{errors.submit}</div>}
            </div>
          )}
        </div>

        <div className="afx-footer">
          {step === 2 && (
            <button className="afx-btn" onClick={() => { setStep(1); setSaleData(null); }}>← Back</button>
          )}
          <button className="afx-btn" onClick={onClose} style={step === 2 ? {} : { marginLeft: "auto" }}>Cancel</button>
          {step === 2 && (
            <button className="afx-btn afx-btn--primary" onClick={handleSubmit} disabled={submitting || !anySelected}>
              {submitting ? <><span className="afx-spinner" /> Processing…</> : "Submit Return"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
