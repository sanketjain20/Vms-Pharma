import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";

export default function ProductType() {
const columns = [
  { header: "Product Type Code", field: "typeCode", width: "240px" },
  { header: "Name", field: "name", width: "260px" },
  { header: "Description", field: "description", width: "500px" },
  { header: "Actions", field: "Action", width: "160px" },
];

  return (
    <div className="i-container">
      <h2 className="i-title">
🏷️
PRODUCT TYPES</h2>
      
      
      <DynamicGrid 
        columns={columns} 
        apiUrl={`${API_BASE_URL}/api/ProductType/GetAllProductTypePaged`} 
        Module="Product Type"
        ModuleId ="2"
      />

    </div>
  );
}

