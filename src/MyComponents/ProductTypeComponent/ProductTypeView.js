import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
export default function ProductTypeView({ uKey, onClose }) {
  const [productType, setProductType] = useState(null);
  const [error, setError] = useState("");
  const loading = !productType && !error;

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByUkey/${uKey}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === 200) setProductType(data.data);
        else setError(data.message || "Failed to fetch product type");
      })
      .catch((err) => { console.error("Fetch error:", err); setError(err.message); });
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--sm">
        {loading ? (
          <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Product Type</div>
                <h3 className="afx-title">View Product Type{productType?.typeCode && ` · ${productType.typeCode}`}</h3>
                <div className="afx-subtitle">Read-only view of product type record</div>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <div className="afx-body">
              {error && <div className="afx-alert">{error}</div>}

              {productType && (
                <div className="afx-grid">
                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Name</label>
                    <div className="afx-view-value">{productType.name || <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field afx-field--full">
                    <label className="afx-label">Description</label>
                    <div className="afx-view-value">{productType.description || <span className="afx-view-value--empty">—</span>}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="afx-footer">
              <button className="afx-btn" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
