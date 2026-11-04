import React, { useState } from "react";
import useModuleActions from "../../utils/useModuleActions";
import { SALES_MODULE_ID } from "./LineGstCell";

export const CHANGE_PRICE_ACTION = "Change Selling Price";

/** Whether the logged-in user may bill a line at a price other than the product's (the server checks again). */
export function useCanChangePrice() {
  const { can } = useModuleActions(SALES_MODULE_ID);
  return can(CHANGE_PRICE_ACTION);
}

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

/** The product's price for a line: what it was when an earlier change was saved, else the product's selling price now. */
export const listPriceOf = (line, product) => {
  const saved = Number(line?.listPrice);
  if (saved > 0) return saved;
  const p = Number(product?.sellingPrice ?? product?.price);
  return p > 0 ? p : null;
};

/** The before-GST value of a price, to compare with the average cost (which is before GST). */
const beforeGst = (price, line, product) => {
  if (!line?.priceIncludesGst) return Number(price);
  const rate = Number(line.overrideRate ?? line.productGstRate ?? line.gstRate ?? product?.gstRate ?? 0);
  return Number(price) / (1 + rate / 100);
};

/**
 * The price cell of a bill line. A role with "Change Selling Price" can bill it at another price, with a reason: never
 * above MRP (the server checks the batch MRP), and below the average cost only when confirmed. A changed line shows what
 * it was changed from and why.
 */
export default function LinePriceCell({ line, product, canChange, onChange, children }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [belowOk, setBelowOk] = useState(false);
  const [error, setError] = useState("");
  const list = listPriceOf(line, product);
  const cost = Number(product?.costPrice || 0);
  const changed = !!line.priceOverrideReason;

  const start = () => {
    setPrice(String(line.sellingPrice ?? ""));
    setReason(line.priceOverrideReason || "");
    setBelowOk(!!line.belowCostConfirmed);
    setError("");
    setEditing(true);
  };
  const typed = parseFloat(price);
  const below = cost > 0 && typed > 0 && beforeGst(typed, line, product) < cost - 0.0001;

  const apply = () => {
    if (!(typed > 0)) { setError("Enter a price above zero"); return; }
    if (list != null && Math.abs(typed - list) < 0.005) { // back to the product's price: nothing to explain
      onChange({ sellingPrice: list, priceOverrideReason: "", belowCostConfirmed: false });
      setEditing(false);
      return;
    }
    if (!reason.trim()) { setError("Give a reason for the price change"); return; }
    if (below && !belowOk) { setError(`That is below the average cost of ${money(cost)} (before GST) — tick to confirm`); return; }
    onChange({ sellingPrice: r2(typed), priceOverrideReason: reason.trim(), belowCostConfirmed: below });
    setEditing(false);
  };
  const reset = () => {
    onChange({ sellingPrice: list, priceOverrideReason: "", belowCostConfirmed: false });
    setEditing(false);
  };

  return (
    <div data-testid="line-price-cell">
      <span data-testid="line-price-value">{Number(line.sellingPrice || 0).toFixed(2)}</span>
      {children}
      {changed && !editing && (
        <div className="afx-line-meta" data-testid="line-price-changed" style={{ color: "var(--afx-warning)" }} title={line.priceOverrideReason}>
          {list != null ? `Changed from ${money(list)}` : "Price changed"} · {line.priceOverrideReason}{line.belowCostConfirmed ? " · below cost" : ""}
        </div>
      )}
      {canChange && !line.custom && !editing && (
        <button type="button" className="afx-link-btn" data-testid="line-price-change" onClick={start}>Change price</button>
      )}
      {editing && (
        <div data-testid="line-price-editor" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, minWidth: 180 }}>
          <input className="afx-input" type="number" min="0.01" step="0.01" aria-label="New price for this line"
            value={price} onChange={(e) => { setPrice(e.target.value); setError(""); }} />
          <div className="afx-line-meta">
            {list != null ? `Product price ${money(list)}` : "No product price"}{cost > 0 ? ` · avg cost ${money(cost)}` : ""}
          </div>
          <input className="afx-input" aria-label="Reason for the price change" placeholder="Reason (required)" maxLength={200}
            value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} />
          {below && (
            <label className="afx-line-meta" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={belowOk} onChange={(e) => setBelowOk(e.target.checked)} aria-label="Sell below cost" />
              Sell below cost ({money(cost)} before GST)
            </label>
          )}
          {error && <div className="afx-error" role="alert">{error}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="afx-btn afx-btn--primary" onClick={apply}>Apply</button>
            {changed && <button type="button" className="afx-btn" onClick={reset}>Use product price</button>}
            <button type="button" className="afx-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
