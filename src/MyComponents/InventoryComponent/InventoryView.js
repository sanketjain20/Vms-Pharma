import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductView.css"; // reuse modal CSS

export default function InventoryView({ uKey, onClose }) {
  const [inventory, setInventory] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("product"); // product / stock

  useEffect(() => {
    if (!uKey) return;

    fetch(`http://localhost:8080/api/Inventory/GetInventoryByUkey/${uKey}`, {
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
        if (data.status === 200) setInventory(data.data);
        else setError(data.message || "Failed to fetch inventory");
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
        {/* ================= HEADER WITH TABS IN SAME ROW ================= */}
        <div
          className="modal-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap", // allow wrapping on smaller screens
            gap: "10px",
          }}
        >
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <h3 style={{ margin: 0 }}>
              View Inventory | {inventory?.inventoryCode}
            </h3>

            {/* Tabs */}
            <div className="tab-row" style={{ display: "flex", gap: "10px", marginLeft: "240px" }}>
              <div
                className={`tab ${activeTab === "product" ? "active" : ""}`}
                onClick={() => setActiveTab("product")}
              >
                Product Info
              </div>
              <div
                className={`tab ${activeTab === "stock" ? "active" : ""}`}
                onClick={() => setActiveTab("stock")}
              >
                Stock & Pricing
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button className="btn-ghost" onClick={onClose} title="Close">
            ✖
          </button>
        </div>

        {/* ================= BODY ================= */}
        <div className="modal-body scrollable">
          {error && <p style={{ color: "red" }}>{error}</p>}
          {!inventory && !error && <p>Loading...</p>}

          {inventory && activeTab === "product" && (
            <div className="form-col scrollable">
              <div className="form-grid">
                <div>
                  <label>Product Type Name</label>
                  <input
                    type="text"
                    value={inventory.productTypeName || ""}
                    readOnly
                  />
                </div>

                <div>
                  <label>Product Name</label>
                  <input
                    type="text"
                    value={inventory.productName || ""}
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}


          {inventory && activeTab === "stock" && (
            <div className="form-col scrollable">
              <div className="form-grid">
                <div>
                  <label>Current Quantity</label>
                  <input
                    type="text"
                    value={inventory.currentQuantity || ""}
                    readOnly
                  />
                </div>

                <div>
                  <label>Reorder Level</label>
                  <input
                    type="text"
                    value={inventory.reorderLevel || ""}
                    readOnly
                  />
                </div>

                <div>
                  <label>Unit Cost Price</label>
                  <input
                    type="text"
                    value={`₹ ${inventory.unitCostPrice || ""}`}
                    readOnly
                  />
                </div>

                <div>
                  <label>Unit Selling Price</label>
                  <input
                    type="text"
                    value={`₹ ${inventory.unitSellingPrice || ""}`}
                    readOnly
                  />
                </div>

                <div>
                  <label>Total Stock Value</label>
                  <input
                    type="text"
                    value={`₹ ${inventory.totalStockValue || ""}`}
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}
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
