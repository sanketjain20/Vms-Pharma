import React, { useState } from "react";
import { GST_RATES } from "../../utils/salesSchemes";
import useModuleActions from "../../utils/useModuleActions";
import GstMissingNote from "./GstMissingNote";

/** Sales (module 5): a role holding "Override GST Rate" may bill a product at another rate, with a reason. */
export const SALES_MODULE_ID = 5;
export const OVERRIDE_GST_ACTION = "Override GST Rate";

/** Whether the logged-in user may change a product's GST rate on a bill (the server checks again on save). */
export function useCanOverrideGst() {
  const { can } = useModuleActions(SALES_MODULE_ID);
  return can(OVERRIDE_GST_ACTION);
}

/**
 * The GST % cell of a bill line: the rate charged, a flag when the product has no rate yet (common rate used) or the
 * rate was overridden, an "incl." tag for a price that includes GST, and — for a user allowed to — a way to bill
 * the product at another rate with a reason (every override is recorded in the audit log).
 *
 * @param line     the bill line (productGstRate, overrideRate, overrideReason, priceIncludesGst, custom)
 * @param row      its totals row from computeTotals (rate, gstRate, gstSource, inclusive)
 * @param onChange patch => the line with the patch applied
 */
export default function LineGstCell({ line, row, canOverride, onChange, hideRate = false }) {
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const shown = row ? Number((row.rate * 100).toFixed(2)) : 0;
  const source = row?.gstSource;

  const start = () => {
    setRate(String(line.overrideRate ?? line.productGstRate ?? ""));
    setReason(line.overrideReason || "");
    setError("");
    setEditing(true);
  };

  const apply = () => {
    if (rate === "") { setError("Pick a rate"); return; }
    if (Number(rate) === Number(line.productGstRate)) {
      onChange({ overrideRate: null, overrideReason: "" }); // back to the product's own rate
      setEditing(false);
      return;
    }
    if (!reason.trim()) { setError("Give a reason (it goes in the audit log)"); return; }
    onChange({ overrideRate: Number(rate), overrideReason: reason.trim().slice(0, 200) });
    setEditing(false);
  };

  return (
    <div data-testid="line-gst-cell">
      {!hideRate && <span data-testid="line-rate">{shown}%</span>}
      {row?.inclusive && <span className="afx-line-meta" data-testid="line-incl-tag" title="The price includes GST">{hideRate ? "Price includes GST" : " incl."}</span>}
      {source === "COMMON" && !line.custom && (
        <GstMissingNote testId="line-gst-flag" />
      )}
      {source === "OVERRIDE" && (
        <div className="afx-line-meta" data-testid="line-gst-override" style={{ color: "var(--afx-warning)" }}
          title={line.overrideReason}>
          Changed from {line.productGstRate ?? "its own rate"}{line.productGstRate != null ? "%" : ""} · {line.overrideReason}
        </div>
      )}
      {canOverride && source !== "COMMON" && !line.custom && line.productGstRate != null && !editing && (
        <button type="button" className="afx-link-btn" data-testid="line-gst-change" onClick={start}>Change</button>
      )}
      {editing && (
        <div data-testid="line-gst-editor" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          <select className="afx-select" aria-label="GST rate for this line" value={rate} onChange={(e) => setRate(e.target.value)}>
            {GST_RATES.map((r) => (
              <option key={r} value={r}>{r}%{Number(r) === Number(line.productGstRate) ? " (product)" : ""}</option>
            ))}
          </select>
          <input className="afx-input" aria-label="Reason for the GST change" placeholder="Reason (required)" maxLength={200}
            value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div className="afx-error">{error}</div>}
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="afx-btn afx-btn--primary" onClick={apply}>Apply</button>
            <button type="button" className="afx-btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
