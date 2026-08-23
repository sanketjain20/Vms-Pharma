import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
export default function PurchaseReturnView({ uKey, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uKey) return;
    setLoading(true);
    setError("");

    apiClient(`${API_BASE_URL}/api/PurchaseReturn/GetByUkey/${uKey}`, {
      method: "GET",
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

  // Product name comes back under different keys/shapes depending on the
  // endpoint — cover string fields under any likely name, and a nested
  // { name } object, instead of trusting one exact shape.
  const productLabel = (item) => {
    const v = item.productName ?? item.product ?? item.productDetails ?? item.Product ?? item.name;
    if (v == null || v === "") return "—";
    if (typeof v === "object") return v.name || v.productName || v.product || "—";
    return v;
  };

  const statusColor = (s) => s === "COMPLETED"
    ? { color: "#6ee7b7", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" }
    : { color: "#fbbf24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" };

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Purchase Return Record</div>
            <h3 className="afx-title">{data ? `Return - ${data.returnNumber}` : "Loading..."}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {loading && (
            <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
          )}

          {error && <div className="afx-alert">{error}</div>}

          {data && (
            <>
              <div className="afx-meta-cards">
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Return Number</span>
                  <span className="afx-meta-card-val afx-view-value--mono">{data.returnNumber}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Original Purchase</span>
                  <span className="afx-meta-card-val afx-view-value--mono">{data.originalPurchaseNumber || data.purchaseNumber || "-"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Date</span>
                  <span className="afx-meta-card-val">{data.createdAt || "-"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Supplier</span>
                  <span className="afx-meta-card-val">{data.supplierName || "-"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Refund Mode</span>
                  <span className="afx-meta-card-val">{data.refundMode || "-"}</span>
                </div>
                <div className="afx-meta-card">
                  <span className="afx-meta-card-label">Status</span>
                  <span className="afx-meta-card-val">
                    {(() => {
                      const s = statusColor(data.status);
                      return (
                        <span className="afx-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
                          {data.status || "-"}
                        </span>
                      );
                    })()}
                  </span>
                </div>
              </div>

              {data.returnReason && (
                <div className="afx-info">
                  <div>
                    <strong>Return Reason</strong>
                    <p style={{ margin: "4px 0 0" }}>{data.returnReason}</p>
                  </div>
                </div>
              )}

              <div className="afx-section-title">
                Returned Items
                <span style={{ marginLeft: "auto" }} />
                <span className="afx-badge">{data.items?.length || 0} item{data.items?.length !== 1 ? "s" : ""}</span>
              </div>

              {!data.items?.length ? (
                <div className="afx-items-empty">
                  <p>No returned items found on this record.</p>
                </div>
              ) : (
              <div className="afx-line-table" style={{ overflowX: "auto" }}>
                <table>
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
                    {(() => {
                      try {
                        return (data.items || []).map((item, idx) => {
                          if (!item) return null;
                          return (
                            <tr key={idx}>
                              <td style={{ color: "var(--afx-text-1)", fontWeight: 600 }}>{productLabel(item)}</td>
                              <td style={{ color: "var(--afx-accent)", fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>
                                {item.batchNumberSnapshot || item.batchNumber || "-"}
                              </td>
                              <td style={{ fontSize: 11 }}>{item.expiryDateSnapshot || item.expiryDate || "-"}</td>
                              <td>{item.returnQuantity ?? "-"}</td>
                              <td>Rs {money(item.costPrice)}</td>
                              <td>Rs {money(item.taxAmount)}</td>
                              <td style={{ fontWeight: 700, color: "var(--afx-text-1)" }}>Rs {money(item.returnSubtotal)}</td>
                            </tr>
                          );
                        });
                      } catch (e) {
                        console.error("Failed to render purchase return items:", e, data.items);
                        return (
                          <tr><td colSpan={7} className="afx-alert" style={{ display: "table-cell" }}>
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
                <div className="afx-totals-row">
                  <span>Items Subtotal</span>
                  <span>Rs {money(data.totalReturnAmount)}</span>
                </div>
                <div className="afx-totals-row">
                  <span>Total Tax</span>
                  <span>Rs {money(data.totalReturnTax)}</span>
                </div>
                <div className="afx-totals-divider" />
                <div className="afx-totals-row afx-totals-grand">
                  <span>Net Supplier Refund</span>
                  <span>Rs {money(data.netReturnAmount)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="afx-footer">
            <button className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
