import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Purchase() {
const columns = [
  { header: "Purchase Number", field: "purchaseNumber", width: "160px" },
  { header: "Supplier", field: "supplierName", width: "170px" },
  { header: "Invoice No", field: "supplierInvoiceNumber", width: "160px" },
  { header: "Total (₹)", field: "", width: "130px" },
  { header: "Net Amount (₹)", field: "netAmount", width: "150px" },
  { header: "Balance (₹)", field: "remainingAmount", width: "140px" },
  { header: "Status", field: "paymentStatus", width: "120px" },
  { header: "Due Date", field: "dueDate", width: "140px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 📥
 PURCAHSE </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/Purchase/GetAllPurchases"
    Module="Purchase"
    ModuleId ="14"
  />

  {/* Toast container here */}
  <ToastContainer position="top-center" autoClose={2000} />
</div>

);
}
