import React, { useEffect, useState } from "react";
import "../../Styles/Purchase/Purchase.css";

const statusColor = s => {
  if (s === "PAID")    return "pfx-badge-green";
  if (s === "CREDIT")  return "pfx-badge-red";
  if (s === "PARTIAL") return "pfx-badge-amber";
  return "pfx-badge-blue";
};

const expiryColor = date => {
  if (!date) return "";
  const days = Math.floor((new Date(date) - new Date()) / 86400000);
  if (days < 0)   return "pfx-expiry-expired";
  if (days < 90)  return "pfx-expiry-soon";
  return "pfx-expiry-ok";
};

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function PurchaseView({ uKey, onClose, onEdit }) {
  const [purchase, setPurchase] = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Purchase/GetPurchaseByUKey/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.status === 200) setPurchase(data.data);
        else setError(data.message || "Failed to fetch purchase");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  if (!uKey) return null;

  const grandTotal = (purchase?.items || []).reduce((s, i) => {
    const base = (parseFloat(i.costPrice) || 0) * (parseInt(i.quantity) || 0);
    return s + base + base * (parseFloat(i.gstRate) || 0) / 100;
  }, 0);

  const totalGst = (purchase?.items || []).reduce((s, i) => {
    const base = (parseFloat(i.costPrice) || 0) * (parseInt(i.quantity) || 0);
    return s + base * (parseFloat(i.gstRate) || 0) / 100;
  }, 0);

  return (
    <div className="pfx-backdrop">
      <div className="pfx-modal pfx-modal-view">
        <div className="pfx-top-beam" />

        {/* ── HEADER ── */}
        <div className="pfx-header">
          <div className="pfx-header-left">
            <div className="pfx-eyebrow"><span className="pfx-eyebrow-dot" />PURCHASE RECORD</div>
            <h2 className="pfx-title">
              <span className="pfx-title-acc">//</span>
              {purchase ? purchase.purchaseNumber : "Loading…"}
            </h2>
          </div>
          <div className="pfx-header-right" style={{ gap: 8 }}>
            {purchase && onEdit && (
              <button type="button" className="pfx-btn-ghost" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
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

          {error && <div className="pfx-alert pfx-alert-error">{error}</div>}

          {!purchase && !error && (
            <div className="pfx-loading">
              <div className="pfx-loader"><div/><div/><div/><div/></div>
              Loading purchase data…
            </div>
          )}

          {purchase && (
            <>
              {/* ── STATUS ROW ── */}
              <div className="pfx-view-status-row">
                <span className="pfx-code-tag">{purchase.purchaseNumber}</span>
                <span className={`pfx-badge ${statusColor(purchase.paymentStatus)}`}>
                  {purchase.paymentStatus}
                </span>
                {purchase.dueDate && (
                  <span className="pfx-due-tag">Due: {purchase.dueDate}</span>
                )}
              </div>

              {/* ── META GRID ── */}
              <div className="pfx-view-meta">
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Supplier</span>
                  <span className="pfx-view-value">{purchase.supplierName}</span>
                  <span className="pfx-view-sub">{purchase.supplierCode}</span>
                </div>
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Supplier Invoice No</span>
                  <span className="pfx-view-value pfx-mono">{purchase.supplierInvoiceNumber || "—"}</span>
                </div>
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Invoice Date</span>
                  <span className="pfx-view-value">{purchase.invoiceDate || "—"}</span>
                </div>
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Amount Paid</span>
                  <span className="pfx-view-value pfx-accent">₹{fmt(purchase.amountPaid)}</span>
                </div>
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Remaining Amount</span>
                  <span className={`pfx-view-value ${parseFloat(purchase.remainingAmount || 0) > 0 ? "pfx-danger" : "pfx-success"}`}>
                    ₹{fmt(purchase.remainingAmount)}
                  </span>
                </div>
                <div className="pfx-view-card">
                  <span className="pfx-view-label">Created At</span>
                  <span className="pfx-view-value">
                    {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </span>
                </div>
                {purchase.notes && (
                  <div className="pfx-view-card pfx-view-card-full">
                    <span className="pfx-view-label">Notes</span>
                    <span className="pfx-view-value">{purchase.notes}</span>
                  </div>
                )}
              </div>

              {/* ── ITEMS TABLE ── */}
              <div className="pfx-view-table-section">
                <div className="pfx-view-table-header">
                  <div className="pfx-view-table-title">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    </svg>
                    Purchase Items
                  </div>
                  <span className="pfx-view-count">{purchase.items?.length || 0} items</span>
                </div>

                <div className="pfx-view-table-wrap">
                  <table className="pfx-view-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch No</th>
                        <th>MFG Date</th>
                        <th>Expiry</th>
                        <th>Qty</th>
                        <th>Cost (₹)</th>
                        <th>MRP (₹)</th>
                        <th>GST %</th>
                        <th>GST (₹)</th>
                        <th>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchase.items?.map((item, idx) => {
                        const base = (parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0);
                        const gstAmt = base * (parseFloat(item.gstRate) || 0) / 100;
                        const lineTotal = base + gstAmt;
                        const expClass = expiryColor(item.expiryDate);
                        return (
                          <tr key={idx}>
                            <td className="pfx-td-product">{item.productName || item.product || "—"}</td>
                            <td><span className="pfx-batch-tag">{item.batchNumber}</span></td>
                            <td className="pfx-td-date">{item.manufacturingDate || "—"}</td>
                            <td>
                              <span className={`pfx-expiry-tag ${expClass}`}>{item.expiryDate || "—"}</span>
                            </td>
                            <td className="pfx-td-num">{item.quantity}</td>
                            <td className="pfx-td-num">₹{fmt(item.costPrice)}</td>
                            <td className="pfx-td-num">₹{fmt(item.mrp)}</td>
                            <td className="pfx-td-num">{item.gstRate}%</td>
                            <td className="pfx-td-num">₹{fmt(gstAmt)}</td>
                            <td className="pfx-td-num pfx-td-total">₹{fmt(lineTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TOTALS ── */}
              <div className="pfx-view-totals">
                <div className="pfx-view-totals-row"><span>Subtotal</span><span>₹{fmt(grandTotal - totalGst)}</span></div>
                <div className="pfx-view-totals-row"><span>Total GST</span><span>₹{fmt(totalGst)}</span></div>
                <div className="pfx-view-totals-divider" />
                <div className="pfx-view-totals-row pfx-view-totals-grand">
                  <span>Grand Total</span>
                  <span>₹{fmt(grandTotal)}</span>
                </div>
                {parseFloat(purchase.remainingAmount || 0) > 0 && (
                  <div className="pfx-view-totals-row pfx-view-totals-due">
                    <span>Amount Due</span>
                    <span>₹{fmt(purchase.remainingAmount)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {purchase && (
          <div className="pfx-footer">
            <button type="button" className="pfx-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
