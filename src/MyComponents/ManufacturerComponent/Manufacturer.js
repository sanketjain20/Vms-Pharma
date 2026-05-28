import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";

export default function Manufacturer() {
const columns = [
  { header: "Code", field: "manufacturerCode", width: "130px" },
  { header: "Name", field: "name", width: "190px" },
  { header: "Contact Person", field: "contactPerson", width: "170px" },
  { header: "Phone", field: "phone", width: "140px" },
  { header: "GST Number", field: "gstNumber", width: "170px" },
  { header: "Drug License No.", field: "drugLicenseNumber", width: "180px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 🏭
 MANUFACTURERS </h2>

  <DynamicGrid
    columns={columns}
    apiUrl={`${API_BASE_URL}/api/Manufacturer/GetAllManufacturerPaged`}
    Module="Manufacturer"
    ModuleId ="11"
  />

  
</div>

);
}
