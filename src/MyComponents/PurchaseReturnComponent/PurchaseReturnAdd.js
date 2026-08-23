import React, { useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { getApiMessage, toastApiError } from "../../utils/toastMessage";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function PurchaseReturnAdd({ onClose, onSubmit }) {
  const [step, setStep] = useState(1);
  const [purchaseNumber, setPurchaseNumber] = useState("");
  const [purchaseData, setPurchaseData] = useState(null);
  const [fetchErr, setFetchErr] = useState("");
  const [fetching, setFetching] = useState(false);
  const [returnLines, setReturnLines] = useState([]);
  const [returnReason, setReturnReason] = useState("");
  const [refundMode, setRefundMode] = useState("SUPPLIER_CREDIT");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const findPurchase = async () => {
    if (!purchaseNumber.trim()) {
      setFetchErr("Enter a purchase number");
      return;
    }

    setFetching(true);
    setFetchErr("");
    setPurchaseData(null);

    try {
      const res = await apiClient(
        `${API_BASE_URL}/api/Purchase/GetPurchaseByPurchaseNumber/${purchaseNumber.trim()}`,
        { method: "GET" }
      );
      const json = await res.json();

      if (json.status === 200 && json.data) {
        const purchase = json.data;
        setPurchaseData(purchase);
        setReturnLines(
          (purchase.items || []).map(item => ({
            purchaseItemId: item.id,
            productName: item.productName || item.product || "",
            costPrice: Number(item.costPrice || 0),
            gstRate: Number(item.gstRate || 0),
            max: Number(item.quantity || 0),
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            returnQuantity: 0,
          }))
        );
        setStep(2);
        toast.success("Purchase loaded successfully");
      } else {
        const message = getApiMessage(json, "Purchase not found");
        setFetchErr(message);
        toastApiError(json, "Purchase not found");
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
    const parsed = parseInt(val, 10) || 0;
    lines[idx].returnQuantity = Math.min(Math.max(0, parsed), lines[idx].max);
    setReturnLines(lines);
  };

  const lineTotal = (line) => {
    const base = line.returnQuantity * line.costPrice;
    return base + (base * line.gstRate) / 100;
  };

  const totalReturnAmt = returnLines.reduce((sum, line) => sum + lineTotal(line), 0);
  const anySelected = returnLines.some(line => line.returnQuantity > 0);

  const handleSubmit = async () => {
    const errs = {};
    if (!anySelected) errs.lines = "Select at least one item to return";
    if (!returnReason.trim()) errs.reason = "Return reason is required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(Object.values(errs)[0]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        purchaseUKey: purchaseData.uKey,
        returnReason: returnReason.trim(),
        refundMode,
        items: returnLines
          .filter(line => line.returnQuantity > 0)
          .map(line => ({
            purchaseItemId: line.purchaseItemId,
            returnQuantity: line.returnQuantity,
          })),
      };

      const res = await apiClient(`${API_BASE_URL}/api/PurchaseReturn/AddPurchaseReturn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.status === 200) {
        toast.success(json?.message || "Purchase return submitted successfully");
        onSubmit?.();
        onClose?.();
      } else {
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

  const expiryColor = (date) => {
    if (!date) return "var(--afx-success)";
    const diff = (new Date(date) - new Date()) / 86400000;
    if (diff < 0) return "var(--afx-danger)";
    if (diff < 90) return "var(--afx-warning)";
    return "var(--afx-success)";
  };

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />
              {step === 1 ? "Step 1 of 2 · Locate Purchase" : "Step 2 of 2 · Process Return"}
            </div>
            <h3 className="afx-title">
              {step === 1 ? "Find Original Purchase" : `Return · ${purchaseData?.purchaseNumber}`}
            </h3>
          </div>
          <button className="afx-close" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            ESC
          </button>
        </div>

        <div className="afx-progress">
          <div className={`afx-progress-step ${step >= 1 ? "is-active" : ""}`}>
            <span className="afx-progress-num">01</span>
            <span>Locate Purchase</span>
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
                Enter the purchase number from the original purchase record to begin the return process.
              </div>

              <label className="afx-label">Purchase Number</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  className="afx-input"
                  placeholder="e.g. PUR000001"
                  value={purchaseNumber}
                  onChange={e => { setPurchaseNumber(e.target.value); setFetchErr(""); }}
                  onKeyDown={e => e.key === "Enter" && findPurchase()}
                />
                <button className="afx-btn afx-btn--primary" style={{ flexShrink: 0 }} onClick={findPurchase} disabled={fetching}>
                  {fetching ? <><span className="afx-spinner" /> Searching…</> : "Find Purchase"}
                </button>
              </div>
              {fetchErr && <div className="afx-alert" style={{ marginTop: 10 }}>{fetchErr}</div>}
            </div>
          )}

          {step === 2 && purchaseData && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="afx-meta-cards">
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Purchase</span>
                  <span className="afx-meta-card-val">{purchaseData.purchaseNumber}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Supplier Invoice</span>
                  <span className="afx-meta-card-val">{purchaseData.supplierInvoiceNumber || "—"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Supplier</span>
                  <span className="afx-meta-card-val">{purchaseData.supplierName || "—"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Net Amount</span>
                  <span className="afx-meta-card-val" style={{ color: "var(--afx-accent)" }}>₹{Number(purchaseData.netAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="afx-field">
                <label className="afx-label">Return Reason<span className="afx-req">*</span></label>
                <textarea
                  className="afx-textarea"
                  rows={2}
                  placeholder="e.g. Damaged stock, wrong item received, supplier replacement…"
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                />
                {errors.reason && <div className="afx-error">{errors.reason}</div>}
              </div>

              <div className="afx-field">
                <label className="afx-label">Refund Mode</label>
                <div className="afx-radio-group">
                  {[
                    { val: "SUPPLIER_CREDIT", label: "Supplier Credit" },
                    { val: "CASH", label: "Cash" },
                    { val: "BANK", label: "Bank Transfer" },
                  ].map(mode => (
                    <label key={mode.val} className={`afx-radio ${refundMode === mode.val ? "is-checked" : ""}`}>
                      <input type="radio" checked={refundMode === mode.val} onChange={() => setRefundMode(mode.val)} />
                      {mode.label}
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
                        <th>Purchased</th>
                        <th>Cost (₹)</th>
                        <th>GST %</th>
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
                            <td style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{line.batchNumber || "—"}</td>
                            <td>
                              <span style={{ color: expiryColor(line.expiryDate), fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>
                                {line.expiryDate || "—"}
                              </span>
                            </td>
                            <td>{line.max}</td>
                            <td>₹{line.costPrice.toFixed(2)}</td>
                            <td>{line.gstRate}%</td>
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
                              ₹{lineTotal(line).toFixed(2)}
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
                  <span>Estimated Supplier Refund</span>
                  <span>₹{totalReturnAmt.toFixed(2)}</span>
                </div>
              </div>

              {errors.submit && <div className="afx-alert">{errors.submit}</div>}
            </div>
          )}
        </div>

        <div className="afx-footer">
          {step === 2 && (
            <button className="afx-btn" onClick={() => { setStep(1); setPurchaseData(null); }}>← Back</button>
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
