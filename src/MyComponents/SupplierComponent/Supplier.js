import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";

export default function Supplier() {
const columns = [
  { header: "Code", field: "supplierCode", width: "130px" },
  { header: "Shop Name", field: "shopName", width: "140px" },
  { header: "Contact Person", field: "contactPerson", width: "150px" },
  { header: "Phone No.", field: "phone", width: "130px" },
  { header: "Outstanding (₹)", field: "outstandingBalance", width: "160px" },
  { header: "Drug License No. ", field: "drugLicenseNumber", width: "180px" },
  { header: "GST Number", field: "gstNumber", width: "150px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 🏪
 SUPPLIERS </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/Supplier/GetAllSupplierPaged"
    Module="Supplier"
    ModuleId ="12"
  />

  {/* Toast container here */}
</div>

);
}
