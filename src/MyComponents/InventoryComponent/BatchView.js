import React, { useEffect, useMemo, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

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

const fetchBatch = async (uKey) => {
  const endpoints = [
    `${API_BASE_URL}/api/Batch/GetBatchByUkey/${uKey}`
  ];

  let lastError = "Failed to fetch batch";
  for (const endpoint of endpoints) {
    try {
      const response = await apiClient(endpoint, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.status === 200) return payload.data;
      lastError = payload?.message || `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
  }
  throw new Error(lastError);
};

export default function BatchView({ uKey, onClose }) {
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
  const availableQuantity = batch?.quantity ?? 0;
  const purchasedQuantity = batch?.originalQuantity ?? 0;
  const soldQuantity = batch?.quantitySold ?? Math.max(Number(purchasedQuantity || 0) - Number(availableQuantity || 0), 0);
  const stockValue = Number(availableQuantity || 0) * Number(batch?.costPrice || batch?.unitCostPrice || 0);

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
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
                <span className="afx-badge" style={{ background: meta.bg, color: meta.fg }}>{meta.label}</span>
                <span style={{ color: "var(--afx-text-3)", fontSize: 11.5 }}>Expiry: {fmtDate(batch.expiryDate)}</span>
              </div>

              <div className="afx-grid">
                <FieldCard label="Product" value={batch.productName || batch.product || "-"} />
                <FieldCard label="Product Code" value={batch.productCode || batch.inventoryCode || "-"} mono />
                <FieldCard label="Supplier" value={batch.supplierName || batch.supplier || "-"} />
                <FieldCard label="Purchase No" value={batch.purchaseNumber || batch.purchaseCode || "-"} mono />
                <FieldCard label="Manufacturing Date" value={fmtDate(batch.manufacturingDate)} />
                <FieldCard label="Expiry Date" value={fmtDate(batch.expiryDate)} />
                <FieldCard label="Days To Expiry" value={meta.daysText} accent />
                <FieldCard label="Available Quantity" value={availableQuantity} accent />
                <FieldCard label="Purchased Quantity" value={purchasedQuantity} />
                <FieldCard label="Sold Quantity" value={soldQuantity} />
                <FieldCard label="Cost Price" value={`₹${fmtMoney(batch.costPrice || batch.unitCostPrice)}`} />
                <FieldCard label="MRP" value={`₹${fmtMoney(batch.mrp || batch.unitSellingPrice)}`} />
                <FieldCard label="Current Stock Value" value={`₹${fmtMoney(stockValue)}`} accent />
                <FieldCard label="GST Rate" value={batch.gstRate != null ? `${batch.gstRate}%` : "-"} />
                <FieldCard label="Created At" value={fmtDate(batch.createdAt)} />
                <FieldCard label="Last Updated" value={fmtDate(batch.updatedAt)} />
              </div>

              {(batch.remarks || batch.notes) && (
                <>
                  <div className="afx-section-title">Notes</div>
                  <div className="afx-card">
                    <div className="afx-view-value">{batch.remarks || batch.notes}</div>
                  </div>
                </>
              )}
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
