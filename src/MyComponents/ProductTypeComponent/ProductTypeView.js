import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
export default function ProductTypeView({ uKey, onClose }) {
  const [productType, setProductType] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/ProductType/GetProdTypeByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
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
    <div className="modal-backdrop show">
      <div className="modal">

        
        <div className="modal-header">
          <div className="modal-title">
            <h3>View Product Type {productType?.typeCode && `· ${productType.typeCode}`}</h3>
            <div className="small-muted">Read-only view of product type record</div>
          </div>
          <button className="btn-ghost" onClick={onClose} title="Close">✕ ESC</button>
        </div>

        
        <div className="modal-body">
          {error && <div className="mf-error">{error}</div>}
          {!productType && !error && <div className="mf-loading">Loading…</div>}

          {productType && (
            <div className="form-col">
              <div className="form-grid">

                <div>
                  <label>Name</label>
                  <div className="view-value">
                    <input type="text" value={productType.name || ""} readOnly />
                  </div>
                </div>

                <div>
                  <label>Description</label>
                  <div className="view-value">
                    <input type="text" value={productType.description || ""} readOnly />
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        
        <div className="modal-footer-fixed">
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

      </div>
    </div>
  );
}
