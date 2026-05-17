import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";

export default function PurchaseReturn() {
  const columns = [
    { header: "Return Number", field: "returnNumber", width: "170px" },
    { header: "Purchase Number", field: "originalPurchaseNumber", width: "170px" },
    { header: "Supplier", field: "supplierName", width: "190px" },
    { header: "Return Amount (₹)", field: "netReturnAmount", width: "200px" },
    { header: "Refund Mode", field: "refundMode", width: "160px" },
    { header: "Status", field: "status", width: "150px" },
    { header: "Date", field: "createdAt", width: "160px" },
    { header: "Actions", field: "Action", width: "120px" },
  ];

  return (
    <div className="i-container">
      <h2 className="i-title">PURCHASE RETURN</h2>

      <DynamicGrid
        columns={columns}
        apiUrl="http://localhost:8080/api/PurchaseReturn/GetAllPurchaseReturn"
        Module="Purchase Return"
        ModuleId="17"
      />
    </div>
  );
}
