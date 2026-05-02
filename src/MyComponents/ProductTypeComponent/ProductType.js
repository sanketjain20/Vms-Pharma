import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function ProductType() {
const columns = [
  { header: "ProductType Code", field: "typeCode", width: "240px" },
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
        apiUrl="http://localhost:8080/api/ProductType/GetAllProductTypePaged" 
        Module="Product Type"
        ModuleId ="2"
      />

      <ToastContainer position="top-center" autoClose={2000} />
    </div>
  );
}

