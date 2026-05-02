import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function PaymentCollection() {
const columns = [
  { header: "Payment Date", field: "paymentDate", width: "160px" },
  { header: "Retailer", field: "retailerShopName", width: "200px" },
  { header: "Invoice No", field: "invoiceNumber", width: "150px" },
  { header: "Amount (₹)", field: "amount", width: "140px" },
  { header: "Mode", field: "paymentMode", width: "120px" },
  { header: "Reference", field: "referenceNumber", width: "180px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 💳
 PAYMENT COLLECTION </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/PaymentCollection/GetAllPayments"
    Module="Payment Collection"
    ModuleId ="13"
  />

  {/* Toast container here */}
  <ToastContainer position="top-center" autoClose={2000} />
</div>

);
}
