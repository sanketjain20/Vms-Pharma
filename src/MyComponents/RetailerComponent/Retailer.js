import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

return ( <div className="i-container"> <h2 className="i-title"> <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#FFFFFF"> <path d="M450-154v-309L180-619v309l270 156Zm60 0 270-156v-310L510-463v309Zm-60 69L150-258q-14-8-22-22t-8-30v-340q0-16 8-30t22-22l300-173q14-8 30-8t30 8l300 173q14 8 22 22t8 30v340q0 16-8 30t-22 22L510-85q-14 8-30 8t-30-8Zm194-525 102-59-266-154-102 59 266 154Zm-164 96 104-61-267-154-104 60 267 155Z"/> </svg>
 RETAILERS </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/Retailer/GetAll"
    Module="Retailer"
    ModuleId ="10"
  />

  {/* Toast container here */}
  <ToastContainer position="top-center" autoClose={2000} />
</div>

);
}
