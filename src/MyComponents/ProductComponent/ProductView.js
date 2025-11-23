import React, { useEffect, useState } from "react";
import "../../Styles/ProductView.css"; // reuse existing CSS

export default function ProductView({ uKey, onClose }) {
  const [product, setProduct] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    if (!uKey) return;

    fetch(`http://localhost:8080/api/Product/GetProductByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched Product Data:", data);
        if (data.status === 200) setProduct(data.data);
        else console.error("Error fetching product:", data.message);
      })
      .catch((err) => console.error("Fetch error:", err));
  }, [uKey]);

  if (!uKey) return null;
  if (!product) return <p>Loading...</p>;

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>
              Product | {product.productCode}
            </h3>
          </div>
          <div className="modal-controls">
            <div className="tab-row">
              <div
                className={`tab ${activeTab === "details" ? "active" : ""}`}
                onClick={() => setActiveTab("details")}
              >
                Details
              </div>
            </div>
            <button className="btn-ghost" onClick={onClose} title="Close">
              ✖
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body scrollable">
          {activeTab === "details" && (
            <div className="product-view">
              <div className="product-row">
                <label>Name : </label>
                <span className="read-only">{product.name}</span>
              </div>
              <div className="product-row">
                <label>Description :</label>
                <span>{product.description || "-"}</span>
              </div>
              <div className="product-row">
                <label>Price :</label>
                <span>₹{product.price}</span>
              </div>
              <div className="product-row">
                <label>Unit :</label>
                <span>{product.unit}</span>
              </div>
              <div className="product-row">
                <label>Product Type :</label>
                <span>{product.productType}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer-fixed">
          <div className="modal-actions">
          </div>
        </div>
      </div>
    </div>
  );
}
