import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/CommonComponent/Serials.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { SerialEntry, LineSerialPicker } from "./SerialWidgets";
import { serialProblem } from "../../utils/serials";

// Phase 7 — turning an order into a purchase or an invoice: a product that tracks serial numbers needs its units named.
// Receiving goods (a purchase order) types them in; billing (a sales order) picks them from the stock in the godown.

/** Units still to receive / bill on an order line. */
export const pendingOf = (item) => {
  if (item.pendingQuantity != null) return Number(item.pendingQuantity);
  const done = Number(item.receivedQuantity ?? item.fulfilledQuantity ?? 0);
  return Math.max(Number(item.quantity || 0) - done, 0);
};

/** The ids of the products that track serial numbers. */
export async function serialProductIds() {
  try {
    const res = await apiClient(`${API_BASE_URL}/api/Product/GetAllProduct`, { method: "GET" });
    const json = await res.json();
    const data = json?.data;
    const list = Array.isArray(data) ? data : data && typeof data === "object" ? Object.values(data).find(Array.isArray) || [] : [];
    return new Set(list.filter((p) => p.trackSerial).map((p) => String(p.id)));
  } catch {
    return new Set();
  }
}

/** The order lines that need serial numbers (product tracks them and something is pending). */
export const serialLinesOf = (order, ids) => (order?.items || [])
  .filter((it) => ids.has(String(it.productId)) && pendingOf(it) > 0)
  .map((it) => ({ itemId: it.id, productId: it.productId, productName: it.productName || `Product ${it.productId}`, quantity: pendingOf(it) }));

/**
 * @param mode     "receive" (type the units in) or "pick" (choose units in stock)
 * @param lines    [{ itemId, productId, productName, quantity }]
 * @param onDone   called with { [itemId]: [serial] } once every line has exactly its quantity
 */
export default function OrderSerialsModal({ mode, lines, godownId, onDone, onClose, busy }) {
  const [serials, setSerials] = useState({});
  const [error, setError] = useState("");
  const set = (itemId, v) => { setError(""); setSerials((p) => ({ ...p, [itemId]: v })); };

  const submit = () => {
    for (const l of lines) {
      const picked = serials[l.itemId] || [];
      const problem = mode === "receive" ? serialProblem(picked, l.quantity)
        : picked.length !== l.quantity ? `Pick ${l.quantity} unit${l.quantity === 1 ? "" : "s"} of ${l.productName} (${picked.length} picked).` : null;
      if (problem) { setError(`${l.productName}: ${problem}`); return; }
    }
    onDone(serials);
  };

  return createPortal(
    <div className="afx-backdrop srl-layer" data-testid="order-serials">
      <div className="afx-modal afx-modal--md" role="dialog" aria-label="Serial numbers of the order">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Serial numbers / IMEI</div>
            <h3 className="afx-title">{mode === "receive" ? "Units being received" : "Units being billed"}</h3>
          </div>
          <button className="afx-close" onClick={onClose} title="Close">ESC</button>
        </div>
        <div className="afx-body">
          {lines.map((l) => (
            <div key={l.itemId} className="afx-field afx-field--full" style={{ marginBottom: 14 }}>
              <label className="afx-label">{l.productName} — {l.quantity} unit{l.quantity === 1 ? "" : "s"}</label>
              {mode === "receive" ? (
                <SerialEntry value={serials[l.itemId] || []} needed={l.quantity} onChange={(v) => set(l.itemId, v)} />
              ) : (
                <LineSerialPicker productId={l.productId} godownId={godownId} selected={serials[l.itemId] || []} max={l.quantity}
                  onChange={(v) => set(l.itemId, v)} testId={`order-serials-${l.itemId}`} />
              )}
            </div>
          ))}
          {error && <div className="afx-alert" role="alert">{error}</div>}
        </div>
        <div className="afx-footer">
          <button className="afx-btn" type="button" onClick={onClose}>Cancel</button>
          <button className="afx-btn afx-btn--primary" type="button" disabled={busy} onClick={submit}>
            {mode === "receive" ? "Receive goods" : "Create invoice"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
