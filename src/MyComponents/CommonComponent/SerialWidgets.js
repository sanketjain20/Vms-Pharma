// Serial numbers / IMEI on screen (Phase 6): typing or scanning the serials received on a purchase line, picking the
// serials sold (or returned) from the ones available, and a modal around the picker for the Quick Sale cart.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../../Styles/CommonAEUDForm/FormShell.css";
import "../../Styles/CommonComponent/Serials.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { normalizeSerial, parseSerials, serialProblem } from "../../utils/serials";

/* ═════════ Purchase: the serials received ═════════ */

/** One serial per unit received (paid + free): typed, pasted (one per line) or scanned (Enter after each). */
export function SerialEntry({ value, needed, onChange, label = "Serial numbers / IMEI" }) {
  const [text, setText] = useState((value || []).join("\n"));
  useEffect(() => {
    const parsed = parseSerials(text);
    if (parsed.join("\n") !== (value || []).join("\n")) setText((value || []).join("\n"));
    // only when the line's serials change from outside (an edit loading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const serials = parseSerials(text);
  const problem = serialProblem(serials, needed);
  return (
    <div className="srl-entry" data-testid="serial-entry">
      <span className="srl-cap">{label}</span>
      <textarea
        className={`afx-textarea srl-text ${problem && serials.length ? "srl-bad" : ""}`}
        rows={Math.min(Math.max(needed, 2), 6)}
        value={text}
        aria-label="Serial numbers"
        placeholder={`Scan or type ${needed} serial number${needed === 1 ? "" : "s"}, one per line`}
        onChange={(e) => { setText(e.target.value); onChange(parseSerials(e.target.value)); }}
      />
      <span className={`srl-count ${problem ? "" : "srl-ok"}`} data-testid="serial-count">
        {problem || `${needed} of ${needed} serial numbers entered`}
      </span>
    </div>
  );
}

/* ═════════ Sale / return: pick from the units available ═════════ */

/**
 * Chips of the available serials (click to pick or drop) and a box to scan one (Enter picks it).
 * @param options  [{ serialNo, hint }] — the units that may be picked
 * @param selected [serialNo]
 */
export function SerialPicker({ options, selected, onChange, max, emptyText = "No serial numbers available." }) {
  const [scan, setScan] = useState("");
  const [error, setError] = useState("");
  const chosen = new Set(selected || []);
  const toggle = (s) => {
    setError("");
    if (chosen.has(s)) { onChange((selected || []).filter((x) => x !== s)); return; }
    if (max != null && chosen.size >= max) { setError(`Only ${max} can be picked here.`); return; }
    onChange([...(selected || []), s]);
  };
  const pickScanned = (e) => {
    e.preventDefault();
    const s = normalizeSerial(scan);
    setScan("");
    if (!s) return;
    if (!options.some((o) => o.serialNo === s)) { setError(`${s} is not one of the units available here.`); return; }
    if (chosen.has(s)) { setError(`${s} is already picked.`); return; }
    toggle(s);
  };
  return (
    <div className="srl-picker" data-testid="serial-picker">
      <form className="srl-scan" onSubmit={pickScanned}>
        <input className="afx-input" value={scan} onChange={(e) => setScan(e.target.value)} aria-label="Scan a serial number"
          placeholder="Scan or type a serial number, then Enter" autoComplete="off" />
      </form>
      {options.length === 0 ? (
        <span className="srl-note">{emptyText}</span>
      ) : (
        <div className="srl-chips">
          {options.map((o) => (
            <button key={o.serialNo} type="button" className={`srl-chip ${chosen.has(o.serialNo) ? "srl-chip-primary" : ""}`}
              onClick={() => toggle(o.serialNo)} aria-pressed={chosen.has(o.serialNo)} title={o.hint || ""}>
              {o.serialNo}{o.hint && <span className="srl-chip-sub">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
      <span className="srl-count" data-testid="serial-picked">{error || `${chosen.size} picked`}</span>
    </div>
  );
}

/** The serials of a product in stock at the active godown (or at {@code godownId}), for a picker. */
export function useSerialsInStock(productId, godownId) {
  const [state, setState] = useState({ loading: false, options: [] });
  useEffect(() => {
    if (!productId) { setState({ loading: false, options: [] }); return undefined; }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    apiClient(`${API_BASE_URL}/api/Serial/InStock/${productId}${godownId ? `?godownId=${godownId}` : ""}`, { method: "GET" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        const rows = json?.status === 200 && Array.isArray(json.data) ? json.data : [];
        setState({ loading: false, options: rows.map((r) => ({ serialNo: r.serialNo, hint: r.batchNumber || "" })) });
      })
      .catch(() => alive && setState({ loading: false, options: [] }));
    return () => { alive = false; };
  }, [productId, godownId]);
  return state;
}

/**
 * Phase 7 — the units on one line of a transfer, an adjustment or an order being billed / received out of stock:
 * the line's quantity is the number picked. {@code extra} keeps units already on the line pickable.
 */
export function LineSerialPicker({ productId, godownId, selected, onChange, max, extra = [], testId = "line-serials" }) {
  const { loading, options } = useSerialsInStock(productId, godownId);
  const all = useMemo(() => {
    const have = new Set(options.map((o) => o.serialNo));
    return [...options, ...extra.filter((s) => !have.has(s)).map((s) => ({ serialNo: s, hint: "" }))];
  }, [options, extra]);
  return (
    <div className="srl-line" data-testid={testId}>
      <span className="srl-note">{loading ? "Loading the units in stock…" : `Pick the units (${(selected || []).length} picked)`}</span>
      <SerialPicker options={all} selected={selected} onChange={onChange} max={max}
        emptyText="No units of this product are in stock in this godown." />
    </div>
  );
}

/* ═════════ Quick Sale: the picker in a modal ═════════ */

export function SerialPickerModal({ product, initial, onDone, onClose }) {
  const { loading, options } = useSerialsInStock(product?.id);
  const [picked, setPicked] = useState(initial || []);
  // units already in this cart line stay pickable even though the server still has them in stock
  const all = useMemo(() => options, [options]);
  return createPortal(
    <div className="afx-backdrop srl-layer" data-testid="serial-modal">
      <div className="afx-modal afx-modal--md" role="dialog" aria-label={`Serial numbers of ${product?.name}`}>
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Pick serial numbers</div>
            <h3 className="afx-title">{product?.name}</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>ESC</button>
        </div>
        <div className="afx-body">
          {loading ? <span className="srl-note">Loading serial numbers…</span> : (
            <SerialPicker options={all} selected={picked} onChange={setPicked} emptyText="None of this product is in stock." />
          )}
        </div>
        <div className="afx-footer">
          <button type="button" className="afx-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="afx-btn afx-btn--primary" onClick={() => onDone(picked)}>
            {picked.length ? `Add ${picked.length} to cart` : "Remove from cart"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** "S/N: A1, A2" under a line, with its warranty. */
export function SerialList({ serials, warranty }) {
  if (!serials || serials.length === 0) return null;
  return (
    <span className="srl-line" data-testid="serial-list">
      S/N: {serials.join(", ")}{warranty ? ` · ${warranty}` : ""}
    </span>
  );
}
