import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css";

export default function ProductTypeView({ uKey, onClose }) {
  const [productType, setProductType] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;

    fetch(
      `http://localhost:8080/api/ProductType/GetProdTypeByUkey/${uKey}`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text || "No response body"}`);
        }
        return res.json();
      })
      .then((data) => {
        if (data.status === 200) {
          setProductType(data.data);
        } else {
          setError(data.message || "Failed to fetch product type");
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* ---------- Header ---------- */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>View Product Type | {productType?.typeCode}</h3>
          </div>

          <button className="btn-ghost" onClick={onClose} title="Close">
            ✖
          </button>
        </div>

        {/* ---------- Body ---------- */}
        <div className="modal-body">
          {error && <p style={{ color: "red" }}>{error}</p>}
          {!productType && !error && <p>Loading...</p>}

          {productType && (
            <div className="form-col scrollable">
              <div className="form-grid">

                <div>
                  <label>Name</label>
                  <div className="view-value">
                    <input
                    type="text"
                    value={productType.name || ""}
                    readOnly
                  />
                  </div>
                </div>

                <div>
                  <label>Description</label>
                  <div className="view-value">
                    <input
                    type="text"
                    value={productType.description || ""}
                    readOnly
                  />
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* ---------- Footer ---------- */}
        <div className="modal-footer-fixed">
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
