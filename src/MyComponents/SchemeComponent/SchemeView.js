import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const Field = ({ label, value, full }) => (
  <div className={`afx-field ${full ? "afx-field--full" : ""}`}>
    <label className="afx-label">{label}</label>
    <div className="afx-view-value">{value || <span className="afx-view-value--empty">—</span>}</div>
  </div>
);

export default function SchemeView({ uKey, onClose }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Scheme/GetByUKey/${uKey}`, { method: "GET" })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200) setData(json.data);
        else setError(json?.message || "Failed to fetch the scheme");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Scheme</div>
            <h3 className="afx-title">{data ? data.name : "Loading…"}</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose}>
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>
        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}
          {data && (
            <div className="afx-grid">
              <Field label="Offer" value={data.description} full />
              <Field label="Product" value={data.productName || "All products"} />
              <Field label="Retailer" value={data.retailerName || "All retailers"} />
              <Field label="Valid from" value={data.validFrom} />
              <Field label="Valid to" value={data.validTo || "No end date"} />
              <Field label="Status" value={data.status} />
              {data.schemeType === "FREE_QUANTITY" && <Field label="Repeats" value={data.repeatable ? "Yes, for every full set" : "Once per bill line"} />}
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
