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
      <h2 className="i-title"><svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#fcf8f8ff"><path d="M620-159 460-319l43-43 117 117 239-239 43 43-282 282Zm220-414h-60v-207h-60v90H240v-90h-60v600h251v60H180q-26 0-43-17t-17-43v-600q0-26 17-43t43-17h202q7-35 34.5-57.5T480-920q36 0 63.5 22.5T578-840h202q26 0 43 17t17 43v207ZM480-780q17 0 28.5-11.5T520-820q0-17-11.5-28.5T480-860q-17 0-28.5 11.5T440-820q0 17 11.5 28.5T480-780Z"/></svg>
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
