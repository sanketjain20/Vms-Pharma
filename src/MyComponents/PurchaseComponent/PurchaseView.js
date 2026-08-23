import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const statusStyle = s => {
  if (s === "PAID")    return { color: "var(--afx-success)", background: "var(--afx-success-soft)" };
  if (s === "CREDIT")  return { color: "var(--afx-danger)",  background: "var(--afx-danger-soft)"  };
  if (s === "PARTIAL") return { color: "var(--afx-warning)", background: "var(--afx-warning-soft)" };
  return { color: "var(--afx-accent)", background: "var(--afx-accent-soft)" };
};

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

// Product name comes back under different keys/shapes depending on the
// endpoint — cover string fields under any likely name, and a nested
// { name } object, instead of trusting one exact shape.
const productLabel = (item) => {
  const v = item.productName ?? item.product ?? item.productDetails ?? item.Product ?? item.name;
  if (v == null || v === "") return "—";
  if (typeof v === "object") return v.name || v.productName || v.product || "—";
  return v;
};

export default function PurchaseView({ uKey, onClose, onEdit }) {
  const [purchase, setPurchase] = useState(null);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Purchase/GetPurchaseByUKey/${uKey}`, {
      method: "GET",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Purchase Record</div>
            <h3 className="afx-title">{purchase ? purchase.purchaseNumber : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {purchase && onEdit && (
              <button type="button" className="afx-btn" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
            <button className="afx-close" type="button" onClick={onClose} title="Close">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!purchase && !error && (
            <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
          )}

          {purchase && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="afx-badge">{purchase.purchaseNumber}</span>
                <span className="afx-tag" style={statusStyle(purchase.paymentStatus)}>{purchase.paymentStatus}</span>
                {purchase.dueDate && <span className="afx-view-value--muted" style={{ fontSize: 12 }}>Due: {purchase.dueDate}</span>}
              </div>

              <div className="afx-grid">
                <div className="afx-field">
                  <label className="afx-label">Supplier</label>
                  <div className="afx-view-value">{purchase.supplierName}</div>
                  <div className="afx-view-value--muted" style={{ fontSize: 11 }}>{purchase.supplierCode}</div>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Supplier Invoice No</label>
                  <div className="afx-view-value afx-view-value--mono">{purchase.supplierInvoiceNumber || "—"}</div>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Invoice Date</label>
                  <div className="afx-view-value">{purchase.invoiceDate || "—"}</div>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Amount Paid</label>
                  <div className="afx-view-value" style={{ color: "var(--afx-accent)" }}>₹{fmt(purchase.amountPaid)}</div>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Remaining Amount</label>
                  <div className={parseFloat(purchase.remainingAmount || 0) > 0 ? "afx-view-value afx-text-danger" : "afx-view-value afx-text-success"}>
                    ₹{fmt(purchase.remainingAmount)}
                  </div>
                </div>
                <div className="afx-field">
                  <label className="afx-label">Created At</label>
                  <div className="afx-view-value">
                    {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </div>
                </div>
                {purchase.notes && (
                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Notes</label>
                    <div className="afx-view-value">{purchase.notes}</div>
                  </div>
                )}
              </div>

              <div className="afx-section-title">Purchase Items ({purchase.items?.length || 0})</div>
              {!purchase.items?.length ? (
                <div className="afx-items-empty">
                  <p>No line items found on this record.</p>
                </div>
              ) : (
              <div className="afx-line-table" style={{ overflowX: "auto" }}>
                <table>
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
                    {(() => {
                      try {
                        return (purchase.items || []).map((item, idx) => {
                          if (!item) return null;
                          const base = (parseFloat(item.costPrice) || 0) * (parseInt(item.quantity) || 0);
                          const gstAmt = base * (parseFloat(item.gstRate) || 0) / 100;
                          const lineTotal = base + gstAmt;
                          return (
                            <tr key={idx}>
                              <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{productLabel(item)}</td>
                              <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{item.batchNumber || "—"}</td>
                              <td style={{ fontSize: 11 }}>{item.manufacturingDate || "—"}</td>
                              <td style={{ fontSize: 11 }}>{item.expiryDate || "—"}</td>
                              <td>{item.quantity ?? "—"}</td>
                              <td>₹{fmt(item.costPrice)}</td>
                              <td>₹{fmt(item.mrp)}</td>
                              <td>{item.gstRate ?? 0}%</td>
                              <td>₹{fmt(gstAmt)}</td>
                              <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>₹{fmt(lineTotal)}</td>
                            </tr>
                          );
                        });
                      } catch (e) {
                        console.error("Failed to render purchase line items:", e, purchase.items);
                        return (
                          <tr><td colSpan={10} className="afx-alert" style={{ display: "table-cell" }}>
                            Couldn't display line items — unexpected data shape. Check the console for details.
                          </td></tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
              )}

              <div className="afx-totals">
                <div className="afx-totals-row"><span>Subtotal</span><span>₹{fmt(grandTotal - totalGst)}</span></div>
                <div className="afx-totals-row"><span>Total GST</span><span>₹{fmt(totalGst)}</span></div>
                <div className="afx-totals-divider" />
                <div className="afx-totals-row afx-totals-grand"><span>Grand Total</span><span>₹{fmt(grandTotal)}</span></div>
                {parseFloat(purchase.remainingAmount || 0) > 0 && (
                  <div className="afx-totals-row"><span>Amount Due</span><span className="afx-text-danger">₹{fmt(purchase.remainingAmount)}</span></div>
                )}
              </div>
            </>
          )}
        </div>

        {purchase && (
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
