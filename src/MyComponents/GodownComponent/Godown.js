import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import API_BASE_URL from "../../Config/api.config";

export default function Godown() {
  const columns = [
    { header: "Code", field: "godownCode", width: "150px" },
    { header: "Name", field: "name", width: "190px" },
    { header: "City", field: "city", width: "150px" },
    { header: "Contact Person", field: "contactPerson", width: "170px" },
    { header: "Phone", field: "phone", width: "140px" },
    { header: "Default", field: "isDefault", width: "100px" },
    { header: "Actions", field: "Action", width: "120px" },
  ];

  return (
    <div className="i-container">
      <h2 className="i-title">🏬 GODOWNS</h2>

      <DynamicGrid
        columns={columns}
        apiUrl={`${API_BASE_URL}/api/Godown/GetAllGodownPaged`}
        Module="Godown"
        ModuleId="28"
      />
    </div>
  );
}
