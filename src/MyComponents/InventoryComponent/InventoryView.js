import React, { useEffect, useState } from "react";
import "../../Styles/Product/ProductView.css"; // reuse existing CSS

export default function InventoryView({ uKey, onClose }) {
  const [inventory, setInventory] = useState(null);

  useEffect(() => {
    if (!uKey) return;

    fetch(`http://localhost:8080/api/Inventory/GetInventoryByUkey/${uKey}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched Inventory Data:", data);
        if (data.status === 200) setInventory(data.data);
        else console.error("Error fetching inventory:", data.message);
      })
      .catch((err) => console.error("Fetch error:", err));
  }, [uKey]);

  if (!uKey) return null;
  if (!inventory) return <p>Loading...</p>;

  return (
    <div className="modal-backdrop show">
      <div className="modal">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <h3>Inventory | {inventory.inventoryCode}</h3>
          </div>
          <div className="modal-controls">
            <button className="btn-ghost" onClick={onClose} title="Close">
              ✖
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body scrollable">
          <div className="product-view">
            <div className="product-row">
              <label>Product ID :</label>
              <span>{inventory.productId}</span>
            </div>
            <div className="product-row">
              <label>Current Quantity :</label>
              <span>{inventory.currentQuantity}</span>
            </div>
            <div className="product-row">
              <label>Reorder Level :</label>
              <span>{inventory.reorderLevel}</span>
            </div>
            <div className="product-row">
              <label>Unit Cost Price :</label>
              <span>₹ {inventory.unitCostPrice}</span>
            </div>
            <div className="product-row">
              <label>Unit Selling Price :</label>
              <span>₹ {inventory.unitSellingPrice}</span>
            </div>
            <div className="product-row">
              <label>Total Stock Value :</label>
              <span>₹ {inventory.totalStockValue}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer-fixed">
          <div className="modal-actions"></div>
        </div>
      </div>
    </div>
  );
}
