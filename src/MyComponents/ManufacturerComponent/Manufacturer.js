import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
    apiUrl="http://localhost:8080/api/Manufacturer/GetAllManufacturerPaged"
    Module="Manufacturer"
    ModuleId ="11"
  />

  {/* Toast container here */}
  <ToastContainer position="top-center" autoClose={2000} />
</div>

);
}
