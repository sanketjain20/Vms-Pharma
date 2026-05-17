import React, { useState } from "react";
import "../../Styles/SalesReturn/SalesReturnAdd.css";

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
      const res = await fetch(
        `http://localhost:8080/api/Purchase/GetPurchaseByPurchaseNumber/${purchaseNumber.trim()}`,
        { method: "GET", credentials: "include" }
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
      } else {
        setFetchErr(json.message || "Purchase not found");
      }
    } catch (e) {
      setFetchErr("Network error: " + e.message);
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
    if (Object.keys(errs).length > 0) return;

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

      const res = await fetch("http://localhost:8080/api/PurchaseReturn/AddPurchaseReturn", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.status === 200) {
        onSubmit?.();
        onClose?.();
      } else {
        setErrors({ submit: json.message || "Submission failed" });
      }
    } catch (e) {
      setErrors({ submit: "Network error: " + e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const expiryColor = (date) => {
    if (!date) return "#6ee7b7";
    const diff = (new Date(date) - new Date()) / 86400000;
    if (diff < 0) return "#fca5a5";
    if (diff < 90) return "#fbbf24";
    return "#6ee7b7";
  };

  return (
    <div className="sra-backdrop">
      <div className="sra-modal">
        <div className="sra-top-beam" />
        <div className="sra-corner sra-tl" /><div className="sra-corner sra-tr" />
        <div className="sra-corner sra-bl" /><div className="sra-corner sra-br" />

        <div className="sra-header">
          <div className="sra-header-left">
            <div className="sra-eyebrow">
              <span className="sra-eyebrow-dot" />
              {step === 1 ? "STEP 1 OF 2 - LOCATE PURCHASE" : "STEP 2 OF 2 - PROCESS RETURN"}
            </div>
            <h3 className="sra-title">
              <span className="sra-title-acc">{'//'}</span>
              {step === 1 ? "Find Original Purchase" : `Return - ${purchaseData?.purchaseNumber}`}
            </h3>
          </div>
          <button className="sra-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            ESC
          </button>
        </div>

        <div className="sra-progress">
          <div className={`sra-progress-step ${step >= 1 ? "active" : ""}`}>
            <span className="sra-progress-num">01</span>
            <span>Locate Purchase</span>
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
                Enter the purchase number from the original purchase record to begin the return process.
              </div>

              <label className="sra-label">Purchase Number</label>
              <div className="sra-ukey-row">
                <input
                  type="text"
                  className="sra-input"
                  placeholder="e.g. PUR000001"
                  value={purchaseNumber}
                  onChange={e => { setPurchaseNumber(e.target.value); setFetchErr(""); }}
                  onKeyDown={e => e.key === "Enter" && findPurchase()}
                />
                <button className="sra-btn-find" onClick={findPurchase} disabled={fetching}>
                  {fetching ? "Searching..." : "Find Purchase"}
                </button>
              </div>
              {fetchErr && <div className="sra-error-banner">{fetchErr}</div>}
            </div>
          )}

          {step === 2 && purchaseData && (
            <div className="sra-step">
              <div className="sra-sale-meta">
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Purchase</span>
                  <span className="sra-meta-val">{purchaseData.purchaseNumber}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Supplier Invoice</span>
                  <span className="sra-meta-val">{purchaseData.supplierInvoiceNumber || "-"}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Supplier</span>
                  <span className="sra-meta-val">{purchaseData.supplierName || "-"}</span>
                </div>
                <div className="sra-meta-card">
                  <span className="sra-meta-label">Net Amount</span>
                  <span className="sra-meta-val sra-meta-accent">Rs {Number(purchaseData.netAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <label className="sra-label">Return Reason <span className="sra-required">*</span></label>
              <textarea
                className="sra-textarea"
                rows={2}
                placeholder="e.g. Damaged stock, wrong item received, supplier replacement..."
                value={returnReason}
                onChange={e => setReturnReason(e.target.value)}
              />
              {errors.reason && <div className="sra-error">{errors.reason}</div>}

              <label className="sra-label">Refund Mode</label>
              <div className="sra-radio-group">
                {[
                  { val: "SUPPLIER_CREDIT", label: "Supplier Credit" },
                  { val: "CASH", label: "Cash" },
                  { val: "BANK", label: "Bank Transfer" },
                ].map(mode => (
                  <label key={mode.val} className={`sra-radio ${refundMode === mode.val ? "checked" : ""}`}>
                    <input type="radio" checked={refundMode === mode.val} onChange={() => setRefundMode(mode.val)} />
                    {mode.label}
                  </label>
                ))}
              </div>

              <div className="sra-items-header">
                <span className="sra-section-title">Select Return Quantities</span>
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
                      <th>Purchased Qty</th>
                      <th>Cost (Rs)</th>
                      <th>GST %</th>
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
                            {line.batchNumber || "-"}
                          </td>
                          <td>
                            <span style={{ color: expiryColor(line.expiryDate), fontFamily: "var(--sra-font-m)", fontSize: 10 }}>
                              {line.expiryDate || "-"}
                            </span>
                          </td>
                          <td className="sra-td-center">{line.max}</td>
                          <td className="sra-td-center">Rs {line.costPrice.toFixed(2)}</td>
                          <td className="sra-td-center">{line.gstRate}%</td>
                          <td>
                            <div className="sra-qty-control">
                              <button className="sra-qty-btn" onClick={() => updateQty(idx, line.returnQuantity - 1)} disabled={line.returnQuantity <= 0}>-</button>
                              <input
                                type="number"
                                className="sra-qty-input"
                                value={line.returnQuantity}
                                min={0}
                                max={line.max}
                                onChange={e => updateQty(idx, e.target.value)}
                              />
                              <button className="sra-qty-btn" onClick={() => updateQty(idx, line.returnQuantity + 1)} disabled={line.returnQuantity >= line.max}>+</button>
                            </div>
                          </td>
                          <td className={`sra-td-amount ${active ? "sra-amount-active" : ""}`}>
                            Rs {lineTotal(line).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="sra-total-preview">
                <span>Estimated Supplier Refund</span>
                <span className="sra-total-amt">Rs {totalReturnAmt.toFixed(2)}</span>
              </div>

              {errors.submit && <div className="sra-error-banner" style={{ marginTop: 12 }}>{errors.submit}</div>}
            </div>
          )}
        </div>

        <div className="sra-footer">
          {step === 2 && (
            <button className="sra-btn-back" onClick={() => { setStep(1); setPurchaseData(null); }}>
              Back
            </button>
          )}
          <button className="sra-btn-cancel" onClick={onClose}>Cancel</button>
          {step === 2 && (
            <button className="sra-btn-submit" onClick={handleSubmit} disabled={submitting || !anySelected}>
              {submitting ? "Processing..." : "Submit Return"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
