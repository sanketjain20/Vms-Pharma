import React, { useEffect, useMemo, useState } from "react";
import "../../Styles/Purchase/Purchase.css";
import API_BASE_URL from "../../Config/api.config";

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
  if (days == null) return { label: "Unknown", className: "pfx-badge-blue", daysText: "-" };
  if (days < 0) return { label: "Expired", className: "pfx-badge-red", daysText: `${Math.abs(days)} days ago` };
  if (days <= 30) return { label: "Critical", className: "pfx-badge-red", daysText: `${days} days left` };
  if (days <= 90) return { label: "Expiring Soon", className: "pfx-badge-amber", daysText: `${days} days left` };
  return { label: "Healthy", className: "pfx-badge-green", daysText: `${days} days left` };
};

const FieldCard = ({ label, value, accent, mono }) => (
  <div className="pfx-view-card">
    <span className="pfx-view-label">{label}</span>
    <span className={`pfx-view-value ${accent ? "pfx-accent" : ""} ${mono ? "pfx-mono" : ""}`}>
      {value ?? "-"}
    </span>
  </div>
);

const fetchBatch = async (uKey) => {
  const endpoints = [
    `${API_BASE_URL}/api/Batch/GetBatchByUkey/${uKey}`
  ];

  let lastError = "Failed to fetch batch";
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
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
    <div className="pfx-backdrop">
      <div className="pfx-modal pfx-modal-view">
        <div className="pfx-top-beam" />

        <div className="pfx-header">
          <div className="pfx-header-left">
            <div className="pfx-eyebrow"><span className="pfx-eyebrow-dot" />BATCH RECORD</div>
            <h2 className="pfx-title">
              <span className="pfx-title-acc"></span>
              {batch?.batchNumber || "Loading..."}
            </h2>
          </div>
          <button className="pfx-close-btn" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pfx-divider" />

        <div className="pfx-body">
          {error && <div className="pfx-alert pfx-alert-error">{error}</div>}

          {!batch && !error && (
            <div className="pfx-loading">
              <div className="pfx-loader"><div /><div /><div /><div /></div>
              Loading batch data...
            </div>
          )}

          {batch && (
            <>
              <div className="pfx-view-status-row">
                <span className="pfx-code-tag">{batch.batchNumber || "-"}</span>
                <span className={`pfx-badge ${meta.className}`}>{meta.label}</span>
                <span className="pfx-due-tag">Expiry: {fmtDate(batch.expiryDate)}</span>
              </div>

              <div className="pfx-view-meta">
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
                <div className="pfx-view-table-section">
                  <div className="pfx-view-table-header">
                    <div className="pfx-view-table-title">Notes</div>
                  </div>
                  <div className="pfx-view-card pfx-view-card-full" style={{ margin: 12 }}>
                    <span className="pfx-view-value">{batch.remarks || batch.notes}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {batch && (
          <div className="pfx-footer">
            <button type="button" className="pfx-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
