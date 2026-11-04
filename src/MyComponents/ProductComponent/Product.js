import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
import { useBusinessProfile } from "../../utils/businessProfile";

// The columns a shop sees: a pharmacy's generic name only for a pharmacy. The price is the selling price; the cost is
// the average of what was paid for the stock on hand.
export function productColumns(isPharma) {
  return [
    { header: "Product Code", field: "productCode", width: "150px" },
    { header: "Name", field: "name", width: "180px" },
    { header: "Product Type", field: "productType", width: "160px" },
    ...(isPharma ? [{ header: "Generic Name", field: "genericName", width: "180px" }] : []),
    { header: isPharma ? "Manufacturer" : "Brand / Manufacturer", field: "manufacturerName", width: "180px" },
    { header: "Selling Price (₹)", field: "price", width: "150px" },
    { header: "Avg Cost (₹)", field: "costPrice", width: "130px" },
    { header: "HSN Code", field: "hsnCode", width: "120px" },
    { header: "GST", field: "gstLabel", width: "110px" },
    { header: "Unit", field: "unit", width: "100px" },
    { header: "Actions", field: "Action", width: "120px" },
  ];
}

export default function Product() {
  const { isPharma } = useBusinessProfile();
  const columns = productColumns(isPharma);

  return (
    <div className="i-container">
      <h2 className="i-title">{isPharma ? "💊" : "📦"} PRODUCTS</h2>

      <DynamicGrid
        columns={columns}
        apiUrl={`${API_BASE_URL}/api/Product/GetAllProductPaged`}
        Module="Product"
        ModuleId="3"
      />
    </div>
  );
}
