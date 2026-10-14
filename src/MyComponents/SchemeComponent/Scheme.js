import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";

export default function Scheme() {
  const columns = [
    { header: "Name", field: "name", width: "190px" },
    { header: "Offer", field: "description", width: "170px" },
    { header: "Product", field: "productName", width: "160px" },
    { header: "Retailer", field: "retailerName", width: "150px" },
    { header: "Valid From", field: "validFrom", width: "110px" },
    { header: "Valid To", field: "validTo", width: "110px" },
    { header: "Status", field: "status", width: "100px" },
    { header: "Actions", field: "Action", width: "120px" },
  ];

  return (
    <div className="i-container">
      <h2 className="i-title">🏷️ SCHEMES &amp; DISCOUNTS</h2>

      <DynamicGrid
        columns={columns}
        apiUrl={`${API_BASE_URL}/api/Scheme/GetAll`}
        noPagination
        Module="Scheme"
        ModuleId="34"
      />
    </div>
  );
}
