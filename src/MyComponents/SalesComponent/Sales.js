import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";

export default function sales() {
const columns = [
  { header: "Invoice Number", field: "invoiceNumber", width: "200px" },
  { header: "Net Amount (₹)", field: "netAmount", width: "205px" },
  { header: "Due Amount (₹)", field: "remainingAmount", width: "205px" },
  { header: "Billing Mode", field: "billingMode", width: "205px" },
  { header: "Date", field: "createdAt", width: "205px" },
  { header: "Actions", field: "Action", width: "170px" },
];


  return (
    <div className="i-container">
      <h2 className="i-title">
🧾
SALES</h2>
      
      
      <DynamicGrid 
        columns={columns} 
        apiUrl="http://localhost:8080/api/Sales/GetAllSales" 
        Module="Sales"
        ModuleId ="5"
      />
    </div>
  );
}

