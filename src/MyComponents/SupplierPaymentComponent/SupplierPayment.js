import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";

export default function Supplier() {
const columns = [
  { header: " Code", field: "paymentCode", width: "120px" },
  { header: "Supplier Name", field: "supplierShopName", width: "155px" },

  { header: "Purchase Number", field: "purchaseNumber", width: "175px" },

  { header: "Payment Date", field: "paymentDate", width: "150px" },
  { header: "Payment Mode", field: "paymentMode", width: "140px" },

  { header: "Amount (₹)", field: "amount", width: "130px" },

  { header: "Reference Number", field: "referenceNumber", width: "180px" },

  { header: "Actions", field: "Action", width: "110px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 🏦
 SUPPLIERS PAYMENT </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/SupplierPayment/GetAll"
    Module="Supplier Payment"
    ModuleId ="15"
  />

  {/* Toast container here */}
</div>

);
}
