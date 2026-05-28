import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";

export default function Batch() {
  const columns = [
    { header: "Batch No", field: "batchNumber", width: "150px" },
    { header: "Product Name", field: "productName", width: "190px" },
    { header: "Product Code", field: "productCode", width: "150px" },
    {header:"Purchase Quantity", field:"originalQuantity", width:"150px"},
    { header: "Available Qty", field: "quantity", width: "150px" },
    { header: "MFG Date", field: "manufacturingDate", width: "150px" },
    { header: "Expiry Date", field: "expiryDate", width: "150px" },
    { header: "Cost Price", field: "costPrice", width: "130px" },
    { header: "MRP", field: "mrp", width: "120px" },
    { header: "Supplier", field: "supplier", width: "180px" },
    {header:"Action", field:"Action", width:"150px" }
  ];

  return (
    <div className="i-container">
      <h2 className="i-title">BATCHES</h2>

      <DynamicGrid
        columns={columns}
        apiUrl={`${API_BASE_URL}/api/Batch/GetAllBatch`} 
        Module="Batch"
        ModuleId="20"
      />
    </div>
  );
}
