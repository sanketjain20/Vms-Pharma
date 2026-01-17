import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css"; // reuse ADD CSS

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
        if (data.status === 200) {
          setProduct(data.data);
        } else {
          console.error("Fetch error:", data.message);
        }
      })
      .catch((err) => console.error("API Error:", err));
  }, [uKey]);

  if (!uKey) return null;
  if (!product) return <p>Loading...</p>;

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* ================= HEADER ================= */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>View Product | {product.productCode}</h3>
          </div>

          <div className="modal-controls">
            <div className="tab-row">
              {["details", "pricingUnit"].map((tab) => (
                <div
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "details" ? "Details" : "Pricing & Units"}
                </div>
              ))}
            </div>

            <button className="btn-ghost" onClick={onClose} title="Close">
              ✖
            </button>
          </div>
        </div>

        {/* ================= BODY ================= */}
        <div className="modal-body">
          <div className="form-col scrollable">
            {/* ---------- DETAILS TAB ---------- */}
            {activeTab === "details" && (
              <div className="form-grid">
                <div>
                  <label>Name</label>
                  <input
                    type="text"
                    value={product.name || ""}
                    readOnly
                  />
                </div>

                <div>
                  <label>Product Type</label>
                  <input
                    type="text"
                    value={product.productType || ""}
                    readOnly
                  />
                </div>

                <div>
                  <label>Description</label>
                  <textarea
                    value={product.description || ""}
                    rows={4}
                    readOnly
                  />
                </div>
              </div>
            )}

            {/* ---------- PRICING TAB ---------- */}
            {activeTab === "pricingUnit" && (
              <div className="form-grid">
                <div>
                  <label>Price</label>
                  <input
                    type="text"
                    value={`₹ ${product.price}`}
                    readOnly
                  />
                </div>

                <div>
                  <label>Unit</label>
                  <input
                    type="text"
                    value={product.unit || ""}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= FOOTER ================= */}
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
