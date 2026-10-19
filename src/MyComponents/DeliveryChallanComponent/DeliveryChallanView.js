import React, { useState, useEffect } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Read-only detail view for a Delivery Challan. ──
   Props: uKey (string), onClose (). No Edit button (per user: DC has no update
   endpoint and starts at ISSUED). */

const fmt = n => (n == null || n === "" ? "—" : n);
const BILLING_LABELS = { CASH: "Cash", ONLINE: "Online / UPI", CARD: "Card" };

const statusBadge = s => {
  let style = { color: "var(--afx-accent)", background: "var(--afx-accent-soft)" };
  if (!s) return null;
  if (s === "ISSUED") style = { color: "var(--afx-warning)", background: "var(--afx-warning-soft)" };
  if (s === "PARTIALLY_RETURNED") style = { color: "var(--afx-warning)", background: "var(--afx-warning-soft)" };
  if (s === "CANCELLED") style = { color: "var(--afx-danger)", background: "var(--afx-danger-soft)" };
  if (s === "INVOICED") style = { color: "var(--afx-success)", background: "var(--afx-success-soft)" };
  return <span className="afx-tag" style={style}>{s}</span>;
};

export default function DeliveryChallanView({ uKey, onClose }) {
  const [challan, setChallan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    let alive = true;
    setLoading(true);
    apiClient(`${API_BASE_URL}/api/DeliveryChallan/GetDeliveryChallanByUKey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        if (!alive) return;
        if (json?.status === 200 && json.data) setChallan(json.data);
        else setError(json?.message || "Failed to load delivery challan");
      })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false };
  }, [uKey]);

  const lineTotal = (item) => (Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2);
  const grandTotal = (challan?.items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unitPrice || 0), 0);

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Delivery Challan</div>
            <h3 className="afx-title">{challan ? challan.challanNumber : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="afx-close" type="button" onClick={onClose}>
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {loading ? (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div /><div /><div /></div>
              <span className="afx-view-value--muted" style={{ marginTop: 12, display: "block" }}>Loading delivery challan…</span>
            </div>
          ) : (
            <>
              {error && <div className="afx-alert">{error}</div>}

              {challan && (
                <>
                  <div className="afx-meta-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Retailer</span>
                      <span className="afx-meta-card-val">{fmt(challan.retailerName)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Godown</span>
                      <span className="afx-meta-card-val">{fmt(challan.godownName)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Challan date</span>
                      <span className="afx-meta-card-val">{fmt(challan.challanDate)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Purpose</span>
                      <span className="afx-meta-card-val">{fmt(challan.purpose)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Vehicle number</span>
                      <span className="afx-meta-card-val">{fmt(challan.vehicleNumber)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Transporter</span>
                      <span className="afx-meta-card-val">{fmt(challan.transporter)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Status</span>
                      <span className="afx-meta-card-val">{statusBadge(challan.status)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Total value</span>
                      <span className="afx-meta-card-val">₹{(grandTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Sales invoice</span>
                      <span className="afx-meta-card-val" data-testid="challan-sales-invoice">{challan.salesInvoiceNumber || "Not invoiced yet"}</span>
                    </div>
                  </div>

                  <div className="afx-section-title">Invoice settings</div>
                  <div className="afx-meta-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Billing mode</span>
                      <span className="afx-meta-card-val">{BILLING_LABELS[challan.billingMode] || fmt(challan.billingMode)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Payment type</span>
                      <span className="afx-meta-card-val">{fmt(challan.paymentType)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Due date</span>
                      <span className="afx-meta-card-val">{fmt(challan.dueDate)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Amount paid</span>
                      <span className="afx-meta-card-val">₹{Number(challan.amountPaid || 0).toFixed(2)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Invoice discount</span>
                      <span className="afx-meta-card-val">₹{Number(challan.totalDiscount || 0).toFixed(2)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Auto-apply schemes</span>
                      <span className="afx-meta-card-val">{challan.autoApplySchemes === false ? "No" : "Yes"}</span>
                    </div>
                  </div>

                  {challan.notes && (
                    <div className="afx-field afx-field--full">
                      <label className="afx-label">Notes</label>
                      <div className="afx-view-value">{challan.notes}</div>
                    </div>
                  )}

                  <div className="afx-section-title">Challan Items ({challan.items?.length || 0})</div>
                  {!challan.items?.length ? (
                    <div className="afx-items-empty">
                      <p>No line items found on this record.</p>
                    </div>
                  ) : (
                    <div className="afx-line-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Batch No</th>
                            <th>Expiry</th>
                            <th>Qty</th>
                            <th>Unit Price (₹)</th>
                            <th>GST %</th>
                            <th>Line Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(challan.items || []).map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td style={{ fontWeight: 600, color: "var(--afx-text-1)" }}>{item.productName || `Product #${item.productId}`}</td>
                              <td style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{fmt(item.batchNumber)}</td>
                              <td style={{ fontSize: 11 }}>{fmt(item.expiryDate)}</td>
                              <td>{item.quantity ?? "—"}</td>
                              <td>₹{(Number(item.unitPrice || 0)).toFixed(2)}</td>
                              <td>{item.gstRate != null ? `${Number(item.gstRate)}%` : "—"}</td>
                              <td style={{ fontWeight: 700 }}>₹{lineTotal(item)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
