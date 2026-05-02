import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Inventory() {
const columns = [
  { header: "Code", field: "inventoryCode", width: "110px" },
  { header: "Product Name", field: "productName", width: "140px" },
  { header: "Current Qty", field: "currentQuantity", width: "140px" },
  { header: "Reorder Level", field: "reorderLevel", width: "150px" },
  { header: "Unit Cost Price (₹)", field: "unitCostPrice", width: "190px" },
  { header: "Unit Selling Price (₹)", field: "unitSellingPrice", width: "220px" },
  { header: "Total Stock Value (₹)", field: "totalStockValue", width: "200px" },
  { header: "Actions", field: "Action", width: "120px" }
  // { header: "Last Stock In", field: "lastStockInDate", width: "150px" },
  // { header: "Last Stock Out", field: "lastStockOutDate", width: "150px" },

  // Reserve space for actions now itself
  // { header: "Actions", field: "actions", width: "120px" }
];


  return (
    <div className="i-container">
      <h2 className="i-title">
🗄️
      INVENTORY</h2>
      
      
      <DynamicGrid 
        columns={columns} 
        apiUrl="http://localhost:8080/api/Inventory/GetAllInventory"
        Module="Inventory"
        ModuleId ="4"
      />

        <ToastContainer position="top-center" autoClose={2000} />

    </div>
  );
}
