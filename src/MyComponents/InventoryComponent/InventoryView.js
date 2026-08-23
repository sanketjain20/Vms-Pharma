import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function InventoryView({ uKey, onClose }) {
  const [inventory, setInventory] = useState(null);
  const [error, setError]         = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/Inventory/GetInventoryByUkey/${uKey}`, {
      method: "GET",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        {loading ? (
          <div className="afx-loading">
            <div className="afx-loader-ring"><div/><div/><div/></div>
          </div>
        ) : (
          <>
            <div className="afx-header">
              <div>
                <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Read-only Inventory Record</div>
                <h3 className="afx-title">View Inventory {inventory?.inventoryCode && `· ${inventory.inventoryCode}`}</h3>
              </div>
              <button className="afx-close" onClick={onClose} title="Close">
                <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                ESC
              </button>
            </div>

            <div className="afx-body">
              {error && <div className="afx-alert">{error}</div>}

              <div className="afx-tabs">
                {["details", "stock"].map(tab => (
                  <button type="button" key={tab} className={`afx-tab ${activeTab === tab ? "is-active" : ""}`}
                    onClick={() => setActiveTab(tab)}>
                    {tab === "details" ? "Product" : "Stock & Pricing"}
                  </button>
                ))}
              </div>

              {inventory && activeTab === "details" && (
                <div className="afx-grid">
                  <div className="afx-field">
                    <label className="afx-label">Product Type</label>
                    <div className="afx-view-value">{inventory.productTypeName || <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Product Name</label>
                    <div className="afx-view-value">{inventory.productName || <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Inventory Code</label>
                    <div className="afx-view-value afx-view-value--mono">{inventory.inventoryCode || <span className="afx-view-value--empty">—</span>}</div>
                  </div>
                </div>
              )}

              {inventory && activeTab === "stock" && (
                <div className="afx-grid">
                  <div className="afx-field">
                    <label className="afx-label">Current Quantity</label>
                    <div className="afx-view-value">{inventory.currentQuantity ?? <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Reorder Level</label>
                    <div className="afx-view-value">{inventory.reorderLevel ?? <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Unit Cost Price (₹)</label>
                    <div className="afx-view-value">{inventory.unitCostPrice != null ? `₹ ${inventory.unitCostPrice}` : <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Unit Selling Price (₹)</label>
                    <div className="afx-view-value">{inventory.unitSellingPrice != null ? `₹ ${inventory.unitSellingPrice}` : <span className="afx-view-value--empty">—</span>}</div>
                  </div>

                  <div className="afx-field">
                    <label className="afx-label">Total Stock Value (₹)</label>
                    <div className="afx-view-value">{inventory.totalStockValue != null ? `₹ ${inventory.totalStockValue}` : <span className="afx-view-value--empty">—</span>}</div>
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
