import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
import { useBusinessProfile } from "../../utils/businessProfile";

// One row per batch number: a batch number belongs to one purchase and may cover several products. View lists them all.
export function batchColumns(trackExpiry) {
  return [
    { header: "Batch No", field: "batchNumber", width: "150px" },
    { header: "Purchase No", field: "purchaseNumber", width: "160px" },
    { header: "Supplier", field: "supplier", width: "180px" },
    { header: "Products", field: "productCount", width: "110px" },
    { header: "Purchased Qty", field: "purchased", width: "140px" },
    { header: "Available Qty", field: "available", width: "140px" },
    ...(trackExpiry ? [
      { header: "MFG Date", field: "manufacturingDate", width: "130px" },
      { header: "Earliest Expiry", field: "expiryDate", width: "150px" },
    ] : []),
    { header: "Action", field: "Action", width: "150px" },
  ];
}

export default function Batch() {
  const { trackExpiry } = useBusinessProfile(); // no expiry anywhere when the shop doesn't track it

  return (
    <div className="i-container">
      <h2 className="i-title">BATCHES</h2>

      <DynamicGrid
        columns={batchColumns(trackExpiry)}
        apiUrl={`${API_BASE_URL}/api/Batch/GetBatchGroups`}
        Module="Batch"
        ModuleId="20"
      />
    </div>
  );
}
