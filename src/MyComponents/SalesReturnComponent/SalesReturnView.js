import React, { useState, useEffect } from "react";
import "../../Styles/SalesReturn/SalesReturnView.css";

export default function SalesReturnView({ uKey, onClose }) {
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uKey) return;
    setLoading(true); setError("");
    fetch(`http://localhost:8080/api/SalesReturn/GetByUkey/${uKey}`, {
      method: "GET", credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        if (json.status === 200) setData(json.data);
        else setError(json.message || "Failed to fetch return");
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [uKey]);

  const refundBadgeStyle = (mode) => {
    const map = {
      CASH:        { color: "#6ee7b7", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)"  },
      CREDIT_NOTE: { color: "#93c5fd", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)"  },
      BANK:        { color: "#fbbf24", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)"  },
    };
    return map[mode] || { color: "var(--srv-text-2)", bg: "transparent", border: "transparent" };
  };

  const expiryColor = (d) => {
    if (!d) return { color: "#6ee7b7", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)" };
    const diff = (new Date(d) - new Date()) / (1000 * 60 * 60 * 24);
    if (diff < 0)  return { color: "#fca5a5", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.25)"  };
    if (diff < 90) return { color: "#fbbf24", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" };
    return               { color: "#6ee7b7", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" };
  };

  if (!uKey) return null;

  return (
    <div className="srv-backdrop">
      <div className="srv-modal">
        <div className="srv-top-beam" />
        <div className="srv-corner srv-tl"/><div className="srv-corner srv-tr"/>
        <div className="srv-corner srv-bl"/><div className="srv-corner srv-br"/>

        
        <div className="srv-header">
          <div className="srv-header-left">
            <div className="srv-eyebrow">
              <span className="srv-eyebrow-dot" />
              RETURN RECORD
            </div>
            <h3 className="srv-title">
              <span className="srv-title-acc"></span>
              {data ? `Return · ${data.returnNumber}` : "Loading…"}
            </h3>
          </div>
          <button className="srv-close" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="srv-divider" />

        <div className="srv-body">
          {loading && (
            <div className="srv-loading">
              <div className="srv-loader"><div/><div/><div/><div/></div>
              Loading return data…
            </div>
          )}
          {error && (
            <div className="srv-error">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 4.5V7.5M7 9.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {data && (
            <>
              
              <div className="srv-meta-grid">
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Return Number</span>
                  <span className="srv-meta-value srv-mono">{data.returnNumber}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Original Invoice</span>
                  <span className="srv-meta-value srv-mono">{data.originalInvoiceNumber || "—"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Date</span>
                  <span className="srv-meta-value">{data.createdAt || "—"}</span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Party</span>
                  <span className="srv-meta-value">
                    {data.retailerName
                      ? <><b>{data.retailerName}</b><span style={{ fontSize: 11, color: "var(--srv-text-2)", marginLeft: 6 }}>· {data.retailerCode}</span></>
                      : data.customerName || <span style={{ color: "var(--srv-text-2)" }}>Walk-in</span>}
                  </span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Refund Mode</span>
                  <span className="srv-meta-value">
                    {(() => {
                      const s = refundBadgeStyle(data.refundMode);
                      return (
                        <span style={{
                          padding: "3px 10px", borderRadius: 100,
                          fontFamily: "var(--srv-font-m)", fontSize: 9.5, fontWeight: 600,
                          letterSpacing: "0.1em", textTransform: "uppercase",
                          color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                        }}>{data.refundMode || "—"}</span>
                      );
                    })()}
                  </span>
                </div>
                <div className="srv-meta-card">
                  <span className="srv-meta-label">Status</span>
                  <span className="srv-meta-value">
                    <span className={`srv-badge ${data.status === "COMPLETED" ? "srv-badge-green" : "srv-badge-amber"}`}>
                      {data.status}
                    </span>
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
                  <div className="srv-table-title">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="1" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="1" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                      <rect x="7" y="7" width="4" height="4" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
                    </svg>
                    Returned Items
                  </div>
                  <span className="srv-item-count">{data.items?.length || 0} item{data.items?.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="srv-table-wrap">
                  <table className="srv-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Batch No</th>
                        <th>Expiry</th>
                        <th>HSN</th>
                        <th>Return Qty</th>
                        <th>Unit Price (₹)</th>
                        <th>Tax (₹)</th>
                        <th>Return Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items?.map((item, idx) => {
                        const ec = expiryColor(item.expiryDateSnapshot);
                        return (
                          <tr key={idx} style={{ animationDelay: `${idx * 0.03}s` }}>
                            <td style={{ fontWeight: 500 }}>{item.productName}</td>
                            <td style={{ fontFamily: "var(--srv-font-m)", fontSize: 10.5, color: "#93c5fd" }}>
                              {item.batchNumberSnapshot || "—"}
                            </td>
                            <td>
                              {item.expiryDateSnapshot ? (
                                <span style={{
                                  padding: "2px 7px", borderRadius: 100, fontSize: 10,
                                  fontFamily: "var(--srv-font-m)",
                                  color: ec.color, background: ec.bg, border: `1px solid ${ec.border}`,
                                }}>{item.expiryDateSnapshot}</span>
                              ) : "—"}
                            </td>
                            <td style={{ fontSize: 10, color: "var(--srv-text-2)" }}>{item.hsnCodeSnapshot || "—"}</td>
                            <td style={{ color: "#fbbf24", fontWeight: 600, fontFamily: "var(--srv-font-m)" }}>
                              {item.returnQuantity}
                            </td>
                            <td>₹{item.sellingPrice}</td>
                            <td>₹{Number(item.taxAmount || 0).toFixed(2)}</td>
                            <td className="srv-td-highlight">₹{Number(item.returnSubtotal || 0).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              
              <div className="srv-totals">
                <div className="srv-totals-row">
                  <span>Items Subtotal</span>
                  <span>₹{Number(data.totalReturnAmount || 0).toFixed(2)}</span>
                </div>
                <div className="srv-totals-row">
                  <span>Total Tax</span>
                  <span>₹{Number(data.totalReturnTax || 0).toFixed(2)}</span>
                </div>
                <div className="srv-totals-divider" />
                <div className="srv-totals-row srv-totals-net">
                  <span>Net Refund Amount</span>
                  <span>₹{Number(data.netReturnAmount || 0).toFixed(2)}</span>
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