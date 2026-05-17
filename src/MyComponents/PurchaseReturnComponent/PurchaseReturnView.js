import React, { useEffect, useState } from "react";
import "../../Styles/SalesReturn/SalesReturnView.css";

export default function PurchaseReturnView({ uKey, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uKey) return;
    setLoading(true);
    setError("");

    fetch(`http://localhost:8080/api/PurchaseReturn/GetByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.status === 200) setData(json.data);
        else setError(json.message || "Failed to fetch purchase return");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [uKey]);

  const money = value => Number(value || 0).toFixed(2);

  if (!uKey) return null;

  return (
    <div className="srv-backdrop">
      <div className="srv-modal">
        <div className="srv-top-beam" />
        <div className="srv-corner srv-tl" /><div className="srv-corner srv-tr" />
        <div className="srv-corner srv-bl" /><div className="srv-corner srv-br" />

        <div className="srv-header">
          <div className="srv-header-left">
            <div className="srv-eyebrow">
              <span className="srv-eyebrow-dot" />
              PURCHASE RETURN RECORD
            </div>
            <h3 className="srv-title">
              <span className="srv-title-acc">{'//'}</span>
              {data ? `Return - ${data.returnNumber}` : "Loading..."}
            </h3>
          </div>
          <button className="srv-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            ESC
          </button>
        </div>

        <div className="srv-divider" />

        <div className="srv-body">
          {loading && (
            <div className="srv-loading">
              <div className="srv-loader"><div /><div /><div /><div /></div>
              Loading purchase return data...
            </div>
          )}

          {error && <div className="srv-error">{error}</div>}

          {data && (
            <>
              <div className="srv-meta-grid">
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Return Number</span>
                  <span className="srv-meta-value srv-mono">{data.returnNumber}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Original Purchase</span>
                  <span className="srv-meta-value srv-mono">{data.originalPurchaseNumber || data.purchaseNumber || "-"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Date</span>
                  <span className="srv-meta-value">{data.createdAt || "-"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Supplier</span>
                  <span className="srv-meta-value">{data.supplierName || "-"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Refund Mode</span>
                  <span className="srv-meta-value">{data.refundMode || "-"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Status</span>
                  <span className={`srv-badge ${data.status === "COMPLETED" ? "srv-badge-green" : "srv-badge-amber"}`}>
                    {data.status || "-"}
                  </span>
                </div>
              </div>

              {data.returnReason && (
                <div className="srv-reason-card">
                  <span className="srv-reason-label">Return Reason</span>
                  <p className="srv-reason-text">{data.returnReason}</p>
                </div>
              )}

              <div className="srv-table-section">
                <div className="srv-table-header">
                  <div className="srv-table-title">Returned Items</div>
                  <span className="srv-item-count">{data.items?.length || 0} item{data.items?.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="srv-table-wrap">
                  <table className="srv-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch No</th>
                        <th>Expiry</th>
                        <th>Return Qty</th>
                        <th>Cost (Rs)</th>
                        <th>Tax (Rs)</th>
                        <th>Return Total (Rs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items?.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500 }}>{item.productName || item.product || "-"}</td>
                          <td style={{ fontFamily: "var(--srv-font-m)", fontSize: 10.5, color: "#93c5fd" }}>
                            {item.batchNumberSnapshot || item.batchNumber || "-"}
                          </td>
                          <td>{item.expiryDateSnapshot || item.expiryDate || "-"}</td>
                          <td style={{ color: "#fbbf24", fontWeight: 600, fontFamily: "var(--srv-font-m)" }}>
                            {item.returnQuantity}
                          </td>
                          <td>Rs {money(item.costPrice)}</td>
                          <td>Rs {money(item.taxAmount)}</td>
                          <td className="srv-td-highlight">Rs {money(item.returnSubtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="srv-totals">
                <div className="srv-totals-row">
                  <span>Items Subtotal</span>
                  <span>Rs {money(data.totalReturnAmount)}</span>
                </div>
                <div className="srv-totals-row">
                  <span>Total Tax</span>
                  <span>Rs {money(data.totalReturnTax)}</span>
                </div>
                <div className="srv-totals-divider" />
                <div className="srv-totals-row srv-totals-net">
                  <span>Net Supplier Refund</span>
                  <span>Rs {money(data.netReturnAmount)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="srv-footer">
            <button className="srv-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
