import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
export default function Retailer() {
const columns = [
  { header: "Retailer Code", field: "retailerCode", width: "150px" },
  { header: "Shop Name", field: "shopName", width: "180px" },
  { header: "Owner Name", field: "ownerName", width: "160px" },
  { header: "Phone", field: "phone", width: "140px" },
  { header: "Outstanding (₹)", field: "outstandingBalance", width: "140px" },
  { header: "Credit Limit (₹)", field: "creditLimit", width: "150px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 🛒
 RETAILERS </h2>

  <DynamicGrid
    columns={columns}
    apiUrl={`${API_BASE_URL}/api/Retailer/GetAll`}
    Module="Retailer"
    ModuleId ="10"
  />

  
</div>

);
}
