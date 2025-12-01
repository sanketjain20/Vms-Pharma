import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductView.css";

export default function ProductTypeView({ uKey, onClose }) {
  const [productType, setProductType] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uKey) return;

    fetch(`http://localhost:8080/api/ProductType/GetProdTypeByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
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
          setError(data.message || "Failed to fetch");
        }
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setError(err.message);
      });
  }, [uKey]);

  if (!uKey) return null;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!productType) return <p>Loading...</p>;

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h3>Product Type | {productType.typeCode}</h3>
          </div>
          <div className="modal-controls">
            <button className="btn-ghost" onClick={onClose}>✖</button>
          </div>
        </div>

        <div className="modal-body scrollable">
          <div className="product-view">
            <div className="product-row">
              <label>Name :</label>
              <span>{productType.name}</span>
            </div>

            <div className="product-row">
              <label>Description :</label>
              <span>{productType.description || "-"}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer-fixed"></div>
      </div>
    </div>
  );
}
