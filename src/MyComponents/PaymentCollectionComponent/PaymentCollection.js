import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";
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
    apiUrl={`${API_BASE_URL}/api/PaymentCollection/GetAllPayments`}
    Module="Payment Collection"
    ModuleId ="13"
  />

  
</div>

);
}
