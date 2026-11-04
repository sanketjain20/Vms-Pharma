// Sizes and colours (Phase 5) on screen: the size × colour editor of the product form, the quantity grid of the
// purchase entry, the size/colour picker of the Quick Sale catalog and the size/colour chips of Sales Add.
// The rules (grouping, ordering, which lines a grid makes) live in utils/variants.js.

import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/CommonComponent/Variants.css";
import {
  SIZE_PRESETS, combos, findVariant, gridToPurchaseLines, splitInput, variantAxes, variantKey, variantLabel,
} from "../../utils/variants";

// a chosen chip; "primary" in the class keeps the light theme from recolouring it (Theme.css spares those buttons)
const ON = "vgx-chip is-on vgx-chip-primary";

const Close = ({ onClick }) => (
  <button className="afx-close" type="button" onClick={onClick} title="Close">
    <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    ESC
  </button>
);

/** A modal of the form shell, put on <body> so it sits above the form that opened it. */
const Layer = ({ eyebrow, heading, onClose, children, footer, testId }) =>
  createPortal(
    <div className="afx-backdrop vgx-layer" data-testid={testId} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
      <div className="afx-modal afx-modal--lg" role="dialog" aria-label={heading}>
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />{eyebrow}</div>
            <h3 className="afx-title">{heading}</h3>
          </div>
          <Close onClick={onClose} />
        </div>
        <div className="afx-body">{children}</div>
        {footer && <div className="afx-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );

/** The size × colour table: rows are sizes, columns colours; a style with only one of them gets a single row/column. */
function Matrix({ sizes, colors, cell, testId }) {
  const rows = sizes.length ? sizes : [null];
  const cols = colors.length ? colors : [null];
  return (
    <div className="vgx-scroll">
      <table className="vgx-grid" data-testid={testId}>
        <thead>
          <tr>
            <th className="vgx-side">{sizes.length ? "Size" : ""}</th>
            {cols.map((c) => <th key={c ?? "-"}>{c ?? "Qty"}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s ?? "-"}>
              <td className="vgx-side">{s ?? "—"}</td>
              {cols.map((c) => <td key={c ?? "-"}>{cell(s, c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═════════ Product form: the sizes and colours of a new style ═════════ */

function ValueList({ caption, values, onChange, presets, placeholder, testId }) {
  const [text, setText] = useState("");
  const add = (more) => { onChange(splitInput([...values, ...more].join(","))); setText(""); };
  return (
    <div className="vgx-axis" data-testid={testId}>
      <span className="vgx-cap">{caption}</span>
      <div className="vgx-chips">
        {values.map((v) => (
          <button key={v} type="button" className={ON} title={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}>
            {v} <span className="vgx-chip-x">✕</span>
          </button>
        ))}
        {values.length === 0 && <span className="vgx-note">None yet</span>}
      </div>
      <div className="vgx-add">
        <input className="afx-input" value={text} placeholder={placeholder} aria-label={`Add ${caption.toLowerCase()}`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(splitInput(text)); } }} />
        <button type="button" className="afx-btn" onClick={() => add(splitInput(text))} disabled={!text.trim()}>Add</button>
      </div>
      {presets && (
        <div className="vgx-chips">
          {presets.map((p) => (
            <button key={p.label} type="button" className="vgx-preset" onClick={() => add(p.values)}>+ {p.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Sizes, colours and the variants to make, each at the style's price unless given its own.
 * @param value { sizes: [], colors: [], prices: { "m|blue": "649" }, skipped: { "xl|red": true } }
 */
export function StyleMatrixEditor({ value, onChange, basePrice }) {
  const { sizes, colors, prices, skipped } = value;
  const set = (patch) => onChange({ ...value, ...patch });
  const all = combos(sizes, colors);
  const making = all.filter((c) => !skipped[variantKey(c.size, c.color)]);
  const ownPriced = making.filter((c) => String(prices[variantKey(c.size, c.color)] ?? "").trim() !== "");

  return (
    <div className="afx-field afx-field--full" style={{ display: "flex", flexDirection: "column", gap: 16 }} data-testid="style-matrix-editor">
      <ValueList caption="Sizes" values={sizes} onChange={(v) => set({ sizes: v })} presets={SIZE_PRESETS}
        placeholder="Type sizes, e.g. S, M, L" testId="style-sizes" />
      <ValueList caption="Colours" values={colors} onChange={(v) => set({ colors: v })}
        placeholder="Type colours, e.g. Blue, Black" testId="style-colors" />

      {all.length > 0 ? (
        <>
          <Matrix sizes={sizes} colors={colors} testId="style-matrix" cell={(s, c) => {
            const key = variantKey(s, c);
            const on = !skipped[key];
            return (
              <div className={`vgx-cell ${on ? "" : "is-off"}`}>
                <label className="vgx-toggle">
                  <input type="checkbox" checked={on} aria-label={`Make ${[s, c].filter(Boolean).join(" / ")}`}
                    onChange={() => set({ skipped: { ...skipped, [key]: on } })} />
                  make
                </label>
                <input type="number" min="0" step="0.01" disabled={!on} aria-label={`Price of ${[s, c].filter(Boolean).join(" / ")}`}
                  className={String(prices[key] ?? "").trim() !== "" ? "is-set" : ""}
                  placeholder={basePrice ? String(basePrice) : "price"} value={prices[key] ?? ""}
                  onChange={(e) => set({ prices: { ...prices, [key]: e.target.value } })} />
              </div>
            );
          }} />
          <div className="vgx-sum" data-testid="style-summary">
            <span><strong>{making.length}</strong> variant{making.length === 1 ? "" : "s"} will be created as products, each with its own code and barcode.</span>
            <span>{ownPriced.length > 0 ? `${ownPriced.length} with their own price; the rest at the style price.` : "All at the style price — type a price in a box to change one."}</span>
          </div>
        </>
      ) : (
        <span className="vgx-note">Add sizes and/or colours to see the variants that will be created.</span>
      )}
    </div>
  );
}

/** What the server's /api/ProductStyle/Create takes for the editor's value. */
export function styleMatrixPayload({ sizes, colors, prices, skipped }) {
  const all = combos(sizes, colors);
  return {
    sizes,
    colors,
    overrides: all
      .filter((c) => !skipped[variantKey(c.size, c.color)] && String(prices[variantKey(c.size, c.color)] ?? "").trim() !== "")
      .map((c) => ({ size: c.size, color: c.color, price: parseFloat(prices[variantKey(c.size, c.color)]) })),
    exclude: all.filter((c) => skipped[variantKey(c.size, c.color)]).map((c) => ({ size: c.size, color: c.color })),
  };
}

/* ═════════ Purchase entry: quantities for a whole style at once ═════════ */

/**
 * Pick a style, type a quantity per size/colour and one cost / MRP / GST; "Add" hands back one purchase line per
 * variant with a quantity. A blank MRP takes each variant's own price.
 */
export function VariantQtyGrid({ styles, gstRates, onAdd, onClose }) {
  const [styleId, setStyleId] = useState(styles[0]?.styleId ?? "");
  const [qty, setQty] = useState({});
  const [common, setCommon] = useState({ costPrice: "", mrp: "", gstRate: 0 });
  const [tried, setTried] = useState(false);
  const style = styles.find((s) => String(s.styleId) === String(styleId));
  const { sizes, colors } = useMemo(() => variantAxes(style?.variants), [style]);
  const lines = style ? gridToPurchaseLines(style.variants, qty, common) : [];
  const units = lines.reduce((n, l) => n + l.quantity, 0);
  const costMissing = !(parseFloat(common.costPrice) > 0);

  const add = () => {
    setTried(true);
    if (lines.length === 0 || costMissing) return;
    onAdd(lines);
  };

  return (
    <Layer eyebrow="Sizes & colours" heading="Add a style by size and colour" onClose={onClose} testId="variant-qty-grid"
      footer={<>
        <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="afx-btn afx-btn--primary" onClick={add} disabled={lines.length === 0}>
          Add {lines.length} line{lines.length === 1 ? "" : "s"}{units ? ` · ${units} pcs` : ""}
        </button>
      </>}>
      {styles.length === 0 ? (
        <span className="vgx-note">No styles yet. Create one in Products → Add Product → Sizes & colours.</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="afx-grid">
            <div className="afx-field">
              <label className="afx-label" htmlFor="vgx-style">Style</label>
              <div className="afx-select-wrap">
                <select id="vgx-style" className="afx-select" value={styleId}
                  onChange={(e) => { setStyleId(e.target.value); setQty({}); }}>
                  {styles.map((s) => <option key={s.styleId} value={s.styleId}>{s.name} ({s.variants.length})</option>)}
                </select>
              </div>
            </div>
            <div className="afx-field">
              <label className="afx-label" htmlFor="vgx-cost">Cost per piece (₹)<span className="afx-req">*</span></label>
              <input id="vgx-cost" type="number" min="0" className={`afx-input ${tried && costMissing ? "afx-input--err" : ""}`}
                value={common.costPrice} placeholder="0.00" onChange={(e) => setCommon({ ...common, costPrice: e.target.value })} />
              {tried && costMissing && <div className="afx-error">Enter the cost</div>}
            </div>
            <div className="afx-field">
              <label className="afx-label" htmlFor="vgx-mrp">MRP (₹)</label>
              <input id="vgx-mrp" type="number" min="0" className="afx-input" value={common.mrp}
                placeholder="Each variant's price" onChange={(e) => setCommon({ ...common, mrp: e.target.value })} />
            </div>
            <div className="afx-field">
              <label className="afx-label" htmlFor="vgx-gst">GST %</label>
              <select id="vgx-gst" className="afx-select" value={common.gstRate}
                onChange={(e) => setCommon({ ...common, gstRate: e.target.value })}>
                {gstRates.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>

          <Matrix sizes={sizes} colors={colors} testId="variant-qty-matrix" cell={(s, c) => {
            const v = findVariant(style.variants, s, c);
            if (!v) return <span className="vgx-none" title="This size/colour is not made">—</span>;
            return (
              <div className="vgx-cell">
                <input type="number" min="0" aria-label={`Quantity of ${variantLabel(v)}`}
                  className={parseInt(qty[v.id], 10) > 0 ? "is-set" : ""} value={qty[v.id] ?? ""} placeholder="0"
                  onChange={(e) => setQty({ ...qty, [v.id]: e.target.value })} />
                <span className="vgx-stock">{v.price ? `₹${v.price}` : ""}{v.stock != null ? ` · ${v.stock} in stock` : ""}</span>
              </div>
            );
          }} />
          <span className="vgx-note">Each size/colour with a quantity becomes its own purchase line. Leave MRP blank to use each variant's own price.</span>
        </div>
      )}
    </Layer>
  );
}

/* ═════════ Quick Sale: choose the size and colour of a style ═════════ */

export function VariantPicker({ style, qtyFor, stockFor, priceFor, onAdjust, onClose }) {
  const { sizes, colors } = useMemo(() => variantAxes(style.variants), [style]);
  const inCart = style.variants.reduce((n, v) => n + (qtyFor(v.id) || 0), 0);
  return (
    <Layer eyebrow="Choose size & colour" heading={style.name} onClose={onClose} testId="variant-picker"
      footer={<>
        <span className="vgx-note" style={{ marginRight: "auto" }}>{inCart} in cart</span>
        <button type="button" className="afx-btn afx-btn--primary" onClick={onClose}>Done</button>
      </>}>
      <Matrix sizes={sizes} colors={colors} testId="variant-picker-matrix" cell={(s, c) => {
        const v = findVariant(style.variants, s, c);
        if (!v) return <span className="vgx-none">—</span>;
        const stock = stockFor(v.id);
        const price = priceFor(v.id);
        const q = qtyFor(v.id) || 0;
        const out = stock !== null && stock <= 0;
        const blocked = out || !price;
        return (
          <div className="vgx-cell">
            <span className="vgx-price">{price ? `₹${price}` : stock === null ? "Not stocked yet" : "No price"}</span>
            <span className={`vgx-stock ${out ? "is-out" : stock !== null && stock <= 5 ? "is-low" : ""}`}>
              {stock === null ? "" : out ? "Out of stock" : `${stock} left`}
            </span>
            {q > 0 && stock !== null && q >= stock && <span className="vgx-stock is-low" data-testid="variant-max">All in cart</span>}
            {q > 0 ? (
              <div className="vgx-step">
                <button type="button" onClick={() => onAdjust(v, -1)} aria-label={`One less ${variantLabel(v)}`}>−</button>
                <span>{q}</span>
                <button type="button" onClick={() => onAdjust(v, 1)} aria-label={`One more ${variantLabel(v)}`}
                  disabled={stock !== null && q >= stock}>+</button>
              </div>
            ) : (
              <button type="button" className="vgx-grab" disabled={blocked} onClick={() => onAdjust(v, 1)}
                aria-label={`Add ${variantLabel(v)}`}>Add</button>
            )}
          </div>
        );
      }} />
    </Layer>
  );
}

/* ═════════ Sales Add: switch the picked variant by size / colour ═════════ */

/** Size and colour chips for the style of the picked variant; choosing one picks the matching variant. */
export function VariantChips({ variants, selectedId, onSelect }) {
  const current = variants.find((v) => String(v.id) === String(selectedId));
  const { sizes, colors } = useMemo(() => variantAxes(variants), [variants]);
  if (!current) return null;

  const pickSize = (s) => {
    const v = findVariant(variants, s, current.variantColor) || variants.find((x) => x.variantSize === s);
    if (v) onSelect(v.id);
  };
  const pickColor = (c) => {
    const v = findVariant(variants, current.variantSize, c);
    if (v) onSelect(v.id);
  };

  return (
    <div className="afx-card" data-testid="variant-chips" style={{ gap: 10 }}>
      {sizes.length > 0 && (
        <div className="vgx-axis">
          <span className="vgx-cap">Size</span>
          <div className="vgx-chips">
            {sizes.map((s) => (
              <button key={s} type="button" className={s === current.variantSize ? ON : "vgx-chip"} onClick={() => pickSize(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}
      {colors.length > 0 && (
        <div className="vgx-axis">
          <span className="vgx-cap">Colour</span>
          <div className="vgx-chips">
            {colors.map((c) => {
              const v = sizes.length ? findVariant(variants, current.variantSize, c) : findVariant(variants, null, c);
              return (
                <button key={c} type="button" className={c === current.variantColor ? ON : "vgx-chip"}
                  disabled={!v} onClick={() => pickColor(c)} title={v ? "" : `Not made in ${current.variantSize}`}>
                  {c}{v?.stock != null && <span className="vgx-chip-sub">{v.stock}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
