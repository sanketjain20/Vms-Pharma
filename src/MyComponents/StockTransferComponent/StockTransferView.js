import React, { useState, useEffect } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/* ── Read-only detail view for a Stock Transfer. ──
   Props: uKey (string), onClose (), onEdit (uKey) — passed up by the list
   row action so the parent can open StockTransferEdit. */

const fmt = n => (n == null || n === "" ? "—" : n);

const statusBadge = s => {
  if (!s) return null;
  let style = { color: "var(--afx-accent)", background: "var(--afx-accent-soft)" };
  if (s === "DRAFT") style = { color: "var(--afx-accent)", background: "var(--afx-accent-soft)" };
  if (s === "IN_TRANSIT") style = { color: "var(--afx-warning)", background: "var(--afx-warning-soft)" };
  if (s === "RECEIVED") style = { color: "var(--afx-success)", background: "var(--afx-success-soft)" };
  if (s === "CANCELLED") style = { color: "var(--afx-danger)", background: "var(--afx-danger-soft)" };
  return <span className="afx-tag" style={style}>{s}</span>;
};

export default function StockTransferView({ uKey, onClose, onEdit }) {
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    let alive = true;
    setLoading(true);
    apiClient(`${API_BASE_URL}/api/StockTransfer/GetStockTransferByUKey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        if (!alive) return;
        if (json?.status === 200 && json.data) setTransfer(json.data);
        else setError(json?.message || "Failed to load stock transfer");
      })
      .catch(err => { if (alive) setError(err.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [uKey]);

  const totalUnits = (transfer?.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Stock Transfer</div>
            <h3 className="afx-title">{transfer ? transfer.transferNumber : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {transfer && transfer.status === "DRAFT" && onEdit && (
              <button type="button" className="afx-btn" onClick={() => { onClose(); onEdit(uKey); }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10h2l5-5-2-2-5 5v2ZM8.5 1.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit
              </button>
            )}
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
              <span className="afx-view-value--muted" style={{ marginTop: 12, display: "block" }}>Loading stock transfer…</span>
            </div>
          ) : (
            <>
              {error && <div className="afx-alert">{error}</div>}

              {transfer && (
                <>
                  <div className="afx-meta-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">From godown</span>
                      <span className="afx-meta-card-val">{fmt(transfer.fromGodownName)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">To godown</span>
                      <span className="afx-meta-card-val">{fmt(transfer.toGodownName)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Transfer date</span>
                      <span className="afx-meta-card-val">{fmt(transfer.transferDate)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Vehicle number</span>
                      <span className="afx-meta-card-val">{fmt(transfer.vehicleNumber)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Status</span>
                      <span className="afx-meta-card-val">{statusBadge(transfer.status)}</span>
                    </div>
                    <div className="afx-meta-card">
                      <span className="afx-meta-card-label">Total units</span>
                      <span className="afx-meta-card-val">{totalUnits}</span>
                    </div>
                  </div>

                  {transfer.notes && (
                    <div className="afx-field afx-field--full">
                      <label className="afx-label">Notes</label>
                      <div className="afx-view-value">{transfer.notes}</div>
                    </div>
                  )}

                  <div className="afx-section-title">Transfer Items ({transfer.items?.length || 0})</div>
                  {!transfer.items?.length ? (
                    <div className="afx-items-empty">
                      <p>No line items found on this record.</p>
                    </div>
                  ) : (
                    <div className="afx-line-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Quantity</th>
                            <th>Batch number</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(transfer.items || []).map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td style={{ fontWeight: 600, color: "var(--afx-text-1)" }}>{item.productName || `Product #${item.productId}`}</td>
                              <td>{item.quantity ?? "—"}</td>
                              <td style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11 }}>{fmt(item.batchNumber)}</td>
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
