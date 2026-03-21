import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductForm.css";

export default function InventoryView({ uKey, onClose }) {
  const [inventory, setInventory] = useState(null);
  const [error, setError]         = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/Inventory/GetInventoryByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.status === 200) setInventory(data.data);
        else setError(data.message || "Failed to fetch inventory");
      })
      .catch((err) => { console.error(err); setError(err.message); })
      .finally(() => setLoading(false));
  }, [uKey]);

  if (!uKey) return null;

  return (
    <div className="modal-backdrop show">
      <div className="modal">

        {/* ── HEADER ── */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>View Inventory {inventory?.inventoryCode && `· ${inventory.inventoryCode}`}</h3>
            <div className="small-muted">Read-only inventory record</div>
          </div>

          <div className="modal-controls">
            <div className="tab-row">
              {["details", "stock"].map(tab => (
                <div
                  key={tab}
                  className={`tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "details" ? "Product" : "Stock & Pricing"}
                </div>
              ))}
            </div>
            <button className="btn-ghost" onClick={onClose}>✕ ESC</button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="modal-body">
          <div className="form-col scrollable">

            {/* Loading */}
            {loading && (
              <div className="mf-loading">
                <div className="loader-ring"><div/><div/><div/><div/></div>
                Loading inventory…
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mf-error">{error}</div>
            )}

            {/* ── PRODUCT TAB ── */}
            {!loading && inventory && activeTab === "details" && (
              <div className="form-grid">

                <div>
                  <label>Product Type</label>
                  <div className="custom-select">
                    <div className="select-box">
                      <div className="selected">{inventory.productTypeName || "—"}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label>Product Name</label>
                  <div className="custom-select">
                    <div className="select-box">
                      <div className="selected">{inventory.productName || "—"}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label>Inventory Code</label>
                  <input type="text" value={inventory.inventoryCode || "—"} readOnly />
                </div>

              </div>
            )}

            {/* ── STOCK & PRICING TAB ── */}
            {!loading && inventory && activeTab === "stock" && (
              <div className="form-grid">

                <div>
                  <label>Current Quantity</label>
                  <input type="text" value={inventory.currentQuantity ?? "—"} readOnly />
                </div>

                <div>
                  <label>Reorder Level</label>
                  <input type="text" value={inventory.reorderLevel ?? "—"} readOnly />
                </div>

                <div>
                  <label>Unit Cost Price (₹)</label>
                  <input type="text" value={inventory.unitCostPrice != null ? `₹ ${inventory.unitCostPrice}` : "—"} readOnly />
                </div>

                <div>
                  <label>Unit Selling Price (₹)</label>
                  <input type="text" value={inventory.unitSellingPrice != null ? `₹ ${inventory.unitSellingPrice}` : "—"} readOnly />
                </div>

                <div>
                  <label>Total Stock Value (₹)</label>
                  <input type="text" value={inventory.totalStockValue != null ? `₹ ${inventory.totalStockValue}` : "—"} readOnly />
                </div>

              </div>
            )}

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="modal-footer-fixed">
          <div className="modal-actions">
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

      </div>
    </div>
  );
}
