import React, { useState } from "react";
import { createPortal } from "react-dom";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { CUSTOM_GST_SLABS, MAX_ITEM_NAME_LENGTH, checkCustomItem, formFromLine } from "../../utils/customItems";

/**
 * Add or edit a custom (run-time) item: something typed in at billing time that is not a product in stock.
 * Shared by Sales Add, Quick Sale and Sales Edit. It takes no stock and gets no scheme; see utils/customItems.js.
 *
 * @param line    the custom line being edited, or null to add a new one
 * @param onSave  called with the checked values { name, quantity, price, gstRate, hsnCode, costPrice }
 */
export default function CustomItemForm({ line = null, onSave, onCancel }) {
  const [form, setForm] = useState(() => formFromLine(line));
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = (e) => {
    e.preventDefault();
    const { errors: found, line: checked } = checkCustomItem(form);
    setErrors(found);
    if (checked) onSave(checked);
  };

  const field = (key, label, input, hint) => (
    <div className="afx-field">
      <label className="afx-label" htmlFor={`ci-${key}`}>
        {label}{hint && <span style={{ fontWeight: 400, color: "var(--afx-text-3)" }}> {hint}</span>}
      </label>
      {input}
      {errors[key] && <div className="afx-error">{errors[key]}</div>}
    </div>
  );

  // portalled to <body>: the sales screens animate with a transform, which would otherwise trap this fixed overlay inside them
  return createPortal(
    <div className="afx-backdrop" onMouseDown={onCancel} data-testid="custom-item-form">
      <form
        className="afx-modal afx-modal--sm"
        style={{ height: "auto", minHeight: 0 }}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={save}
        noValidate
      >
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Not in stock</div>
            <h3 className="afx-title">{line ? "Edit custom item" : "Add custom item"}</h3>
          </div>
          <button type="button" className="afx-close" onClick={onCancel} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="afx-body">
          {field("name", "Item name",
            <input id="ci-name" className="afx-input" type="text" value={form.name} onChange={set("name")}
              maxLength={MAX_ITEM_NAME_LENGTH} placeholder="e.g. Alteration charge" autoComplete="off" autoFocus />)}
          <div className="afx-grid">
            {field("quantity", "Quantity",
              <input id="ci-quantity" className="afx-input" type="number" min="1" step="1" value={form.quantity} onChange={set("quantity")} />)}
            {field("price", "Price per unit (₹)",
              <input id="ci-price" className="afx-input" type="number" min="0" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" />,
              "excl. GST")}
          </div>
          <div className="afx-grid">
            {field("gstRate", "GST %",
              <div className="afx-select-wrap">
                <select id="ci-gstRate" className="afx-select" value={form.gstRate} onChange={set("gstRate")}>
                  {CUSTOM_GST_SLABS.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
                </select>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>)}
            {field("hsnCode", "HSN",
              <input id="ci-hsnCode" className="afx-input" type="text" inputMode="numeric" value={form.hsnCode} onChange={set("hsnCode")} maxLength={10} placeholder="e.g. 6109" />,
              "(needed for e-invoice)")}
          </div>
          {field("costPrice", "Cost per unit (₹)",
            <input id="ci-costPrice" className="afx-input" type="number" min="0" step="0.01" value={form.costPrice} onChange={set("costPrice")} placeholder="Leave blank if unknown" />,
            "(optional, for profit reports)")}
          <div className="afx-line-meta" style={{ whiteSpace: "normal" }}>A custom item is billed as typed. It doesn't take stock and gets no scheme.</div>
        </div>

        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="afx-btn afx-btn--primary">{line ? "Update item" : "Add to bill"}</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
