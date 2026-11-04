import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

// One stock adjustment (a stock movement): opened from the Stock Adjustment grid by the adjustment's id.

const TYPE_LABEL = { BREAKAGE: "Breakage", SAMPLE: "Sample", OPENING_STOCK_CORRECTION: "Opening stock correction", DAMAGE: "Damage", ADJUSTMENT: "Adjustment" };

const fmtDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value)
    : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const money = (v) => (v == null ? "—" : `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const Field = ({ label, value, accent, testId }) => (
  <div className="afx-field">
    <label className="afx-label">{label}</label>
    <div className="afx-view-value" data-testid={testId} style={accent ? { color: "var(--afx-accent)", fontWeight: 700 } : undefined}>
      {value ?? <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

export default function StockAdjustmentView({ uKey, onClose }) {
  const [row, setRow] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (uKey == null) return;
    setRow(null);
    setError("");
    apiClient(`${API_BASE_URL}/api/Inventory/StockMovement/${uKey}`, { method: "GET" })
      .then((r) => r.json())
      .then((j) => { if (j?.status === 200 && j.data) setRow(j.data); else setError(j?.message || "Could not load the adjustment."); })
      .catch(() => setError("Could not load the adjustment."));
  }, [uKey]);

  const change = row ? Number(row.newQuantity ?? 0) - Number(row.oldQuantity ?? 0) : 0;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md" role="dialog" aria-label="Stock adjustment">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Stock Adjustment</div>
            <h3 className="afx-title">{row ? `Adjustment #${row.id}` : "Loading…"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">ESC</button>
        </div>
        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}
          {!row && !error && <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>}
          {row && (
            <div className="afx-grid" data-testid="adjustment-view">
              <Field label="Product" value={row.productName} />
              <Field label="Inventory Code" value={row.inventoryCode} />
              <Field label="Adjustment Type" value={TYPE_LABEL[row.movementType] || row.movementType} testId="adjustment-type" />
              <Field label="Quantity" value={row.quantity} accent />
              <Field label="Stock Before" value={row.oldQuantity} />
              <Field label="Stock After" value={row.newQuantity} />
              <Field label="Change" value={`${change > 0 ? "+" : ""}${change}`} accent testId="adjustment-change" />
              <Field label="Unit Cost" value={money(row.unitCostPrice)} />
              <Field label="Value of the change" value={money(Math.abs(change) * Number(row.unitCostPrice || 0))} />
              <Field label="Date" value={fmtDateTime(row.createdAt)} />
              <div className="afx-field afx-field--full">
                <label className="afx-label">Note</label>
                <div className="afx-view-value">{row.note || <span className="afx-view-value--empty">—</span>}</div>
              </div>
            </div>
          )}
        </div>
        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
