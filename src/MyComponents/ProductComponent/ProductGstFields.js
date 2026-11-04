import React, { useEffect, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { GST_RATES } from "../../utils/salesSchemes";

/** The form value of a product's GST rate ("" = not set yet). */
export const gstRateValue = (rate) => (rate === null || rate === undefined ? "" : String(Number(rate)));

/** The payload value: a number, or null when not set. */
export const gstRatePayload = (value) => (value === "" || value === null || value === undefined ? null : Number(value));

/** "Pick the product's GST rate" when it is missing (the product form asks for it on add and on edit). */
export const gstRateError = (value) => (value === "" || value === null || value === undefined ? "Pick the GST rate" : "");

/**
 * Product-wise GST on the product form: the rate (from the allowed list, required), whether the selling price already
 * includes GST, and a warning when the shop's other products with this HSN code carry a different rate (a likely
 * mistake, but not refused).
 */
export default function ProductGstFields({ gstRate, priceIncludesGst, hsnCode, productId, onChange, error, missingOnEdit }) {
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    const hsn = (hsnCode || "").trim();
    if (!hsn || gstRate === "" || gstRate === null || gstRate === undefined) { setConflicts([]); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      const query = new URLSearchParams({ hsnCode: hsn, gstRate: String(gstRate) });
      if (productId) query.set("productId", productId);
      apiClient(`${API_BASE_URL}/api/Product/GstCheck?${query}`, { method: "GET" })
        .then((r) => r.json())
        .then((res) => { if (alive) setConflicts(res?.status === 200 && Array.isArray(res.data) ? res.data : []); })
        .catch(() => { if (alive) setConflicts([]); });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [hsnCode, gstRate, productId]);

  return (
    <>
      <div className="afx-field">
        <label className="afx-label" htmlFor="product-gst-rate">GST Rate (%)<span className="afx-req">*</span></label>
        <select id="product-gst-rate" data-testid="product-gst-rate" className={`afx-input ${error ? "afx-input--err" : ""}`}
          value={gstRate} onChange={(e) => onChange({ gstRate: e.target.value })}>
          <option value="">Select GST rate</option>
          {GST_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
        </select>
        {error && <div className="afx-error">{error}</div>}
        {missingOnEdit && !error && gstRate === "" && (
          <div className="afx-hint" data-testid="gst-missing-hint" style={{ color: "var(--afx-warning)" }}>
            This product has no GST rate yet — bills use the common rate and flag it until you set one.
          </div>
        )}
        {conflicts.length > 0 && (
          <div className="afx-hint" data-testid="gst-hsn-conflict" style={{ color: "var(--afx-warning)" }}>
            Other products with HSN {hsnCode} use a different rate: {conflicts.map((c) => `${c.name} (${Number(c.gstRate)}%)`).join(", ")}.
            Check the rate is right.
          </div>
        )}
        <div className="afx-hint">HSN code is required when your shop has a GSTIN.</div>
      </div>

      <label className="afx-checkbox-label afx-field" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" data-testid="price-includes-gst" checked={!!priceIncludesGst}
          onChange={(e) => onChange({ priceIncludesGst: e.target.checked })} />
        <span>
          Selling price includes GST
          <span className="afx-hint" style={{ display: "block" }}>
            On: the price is the tag/MRP price and the bill works the GST out of it. Off: GST is added on top.
          </span>
        </span>
      </label>
    </>
  );
}
