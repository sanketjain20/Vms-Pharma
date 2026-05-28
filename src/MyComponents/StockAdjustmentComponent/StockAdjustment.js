import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
export default function StockAdjustment() {
  const columns = [
    { header: "Adjustment ID", field: "id", width: "150px" },
    { header: "Inventory Code", field: "inventoryCode", width: "170px" },
    { header: "Product Name", field: "productName", width: "170px" },
    { header: "Adjustment Type", field: "movementType", width: "170px" },
    { header: "Quantity Adjusted", field: "quantity", width: "180px" },
    {header:"Old Quantity", field:"oldQuantity", width:"150px"},
    {header:"New Quantity", field:"newQuantity", width:"150px"},
    { header: "Note", field: "note", width: "180px" },
    { header: "Created Date", field: "createdAt", width: "180px" },
    {header:"ACTIONS", field:"Action", width:"120px"},
  ];

  return (
    <div className="i-container">
      <h2 className="i-title">STOCK ADJUSTMENT</h2>

      <DynamicGrid
        columns={columns}
        apiUrl={`${API_BASE_URL}/api/Inventory/GetAllStockAdjustments`}
        Module="Stock Adjustment"
        ModuleId="22"
        noPagination={true}
      />

    </div>
  );
}
