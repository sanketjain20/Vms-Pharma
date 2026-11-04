import React, { useEffect, useMemo, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { useBusinessProfile } from "../../utils/businessProfile";

const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const daysUntil = (value) => {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
};

const expiryMeta = (date) => {
  const days = daysUntil(date);
  if (days == null) return { label: "Unknown", fg: "var(--afx-accent)", bg: "var(--afx-accent-soft)", daysText: "-" };
  if (days < 0) return { label: "Expired", fg: "var(--afx-danger)", bg: "var(--afx-danger-soft)", daysText: `${Math.abs(days)} days ago` };
  if (days <= 30) return { label: "Critical", fg: "var(--afx-danger)", bg: "var(--afx-danger-soft)", daysText: `${days} days left` };
  if (days <= 90) return { label: "Expiring Soon", fg: "var(--afx-warning)", bg: "var(--afx-warning-soft)", daysText: `${days} days left` };
  return { label: "Healthy", fg: "var(--afx-success)", bg: "var(--afx-success-soft)", daysText: `${days} days left` };
};

const FieldCard = ({ label, value, accent, mono }) => (
  <div className="afx-field">
    <label className="afx-label">{label}</label>
    <div
      className={`afx-view-value ${mono ? "afx-view-value--mono" : ""}`}
      style={accent ? { color: "var(--afx-accent)", fontWeight: 700 } : undefined}
    >
      {value ?? <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

// A batch number may cover several products received on one purchase: the view shows them all.
const fetchBatch = async (uKey) => {
  const response = await apiClient(`${API_BASE_URL}/api/Batch/GetBatchGroup/${uKey}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.status === 200) return payload.data;
  throw new Error(payload?.message || `HTTP ${response.status}`);
};

export default function BatchView({ uKey, onClose }) {
  const { trackExpiry } = useBusinessProfile(); // no expiry anywhere when the shop doesn't track it
  const [batch, setBatch] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;

    setBatch(null);
    setError("");
    fetchBatch(uKey)
      .then(setBatch)
      .catch((err) => setError(err.message || "Failed to fetch batch"));
  }, [uKey]);

  const meta = useMemo(() => expiryMeta(batch?.expiryDate), [batch?.expiryDate]);
  const lines = batch?.lines || [];
  const sold = Math.max(Number(batch?.purchased || 0) - Number(batch?.available || 0), 0);
  const stockValue = lines.reduce((t, l) => t + Number(l.quantity || 0) * Number(l.costPrice || 0), 0);

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--lg">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Batch Record</div>
            <h3 className="afx-title">{batch?.batchNumber || "Loading…"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!batch && !error && (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div/><div/><div/></div>
            </div>
          )}

          {batch && (
            <>
              <div className="afx-option-row" style={{ justifyContent: "flex-start" }}>
                <span className="afx-tag afx-view-value--mono">{batch.batchNumber || "-"}</span>
                {trackExpiry && batch.expiryDate && <span className="afx-badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>}
                {trackExpiry && batch.expiryDate && <span style={{ color: "var(--afx-text-3)", fontSize: 11.5 }}>Earliest expiry: {fmtDate(batch.expiryDate)}</span>}
              </div>

              <div className="afx-grid">
                <FieldCard label="Purchase No" value={batch.purchaseNumber || "Opening / transferred stock"} mono />
                <FieldCard label="Supplier" value={batch.supplier || "-"} />
                <FieldCard label="Products" value={batch.productCount} accent />
                <FieldCard label="Purchased Quantity" value={batch.purchased} />
                <FieldCard label="Available Quantity" value={batch.available} accent />
                <FieldCard label="Sold / Used" value={sold} />
                <FieldCard label="Current Stock Value" value={`₹${fmtMoney(stockValue)}`} accent />
              </div>

              <div className="afx-section-title">Products in this batch</div>
              <div className="afx-line-table" style={{ overflowX: "auto" }}>
                <table data-testid="batch-lines">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Code</th>
                      <th>Godown</th>
                      <th>Purchased</th>
                      <th>Available</th>
                      <th>Sold</th>
                      <th>Cost (₹)</th>
                      <th>MRP (₹)</th>
                      {trackExpiry && <th>MFG</th>}
                      {trackExpiry && <th>Expiry</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.uKey || l.id}>
                        <td style={{ fontWeight: 600 }}>{l.productName}</td>
                        <td className="afx-view-value--mono">{l.productCode}</td>
                        <td>{l.godownName || "-"}</td>
                        <td>{l.originalQuantity ?? 0}</td>
                        <td>{l.quantity ?? 0}</td>
                        <td>{l.quantitySold ?? 0}</td>
                        <td>{fmtMoney(l.costPrice)}</td>
                        <td>{fmtMoney(l.mrp)}</td>
                        {trackExpiry && <td>{fmtDate(l.manufacturingDate)}</td>}
                        {trackExpiry && <td>{fmtDate(l.expiryDate)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {batch && (
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
