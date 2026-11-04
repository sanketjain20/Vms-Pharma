import React from "react";

// The kinds of shop (same list as the server's BusinessType). Grocery and pharmacy track expiry by default; a pharmacy
// always does.
export const BUSINESS_TYPES = [
  { value: "PHARMA", label: "Pharmacy / medical", tracksExpiryByDefault: true },
  { value: "GROCERY", label: "Grocery / FMCG", tracksExpiryByDefault: true },
  { value: "CLOTHING", label: "Clothing / textiles", tracksExpiryByDefault: false },
  { value: "ELECTRONICS", label: "Electronics", tracksExpiryByDefault: false },
  { value: "GENERAL", label: "General store", tracksExpiryByDefault: false },
];

export const businessTypeLabel = (value) => BUSINESS_TYPES.find((t) => t.value === value)?.label || "Pharmacy / medical";

/** Picking a type also picks its usual expiry setting; the switch can then be changed (except for a pharmacy). */
export default function BusinessTypeFields({ businessType, trackExpiry, onChange }) {
  const type = BUSINESS_TYPES.find((t) => t.value === businessType) || BUSINESS_TYPES[0];
  const pharma = type.value === "PHARMA";
  return (
    <>
      <div className="afx-field">
        <label className="afx-label" htmlFor="vendor-business-type">Business type<span className="afx-req">*</span></label>
        <div className="afx-select-wrap">
          <select id="vendor-business-type" className="afx-select" value={type.value}
            onChange={(e) => {
              const next = BUSINESS_TYPES.find((t) => t.value === e.target.value);
              onChange({ businessType: next.value, trackExpiry: next.tracksExpiryByDefault });
            }}>
            {BUSINESS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <label className="afx-checkbox-label afx-field" style={{ display: "flex", gap: 10, alignItems: "center", cursor: pharma ? "default" : "pointer" }}>
        <input type="checkbox" data-testid="vendor-track-expiry" checked={pharma || !!trackExpiry} disabled={pharma}
          onChange={(e) => onChange({ businessType: type.value, trackExpiry: e.target.checked })} />
        <span>{pharma ? "Expiry dates are tracked (always, for a pharmacy)" : "Track expiry dates on stock"}</span>
      </label>
    </>
  );
}
