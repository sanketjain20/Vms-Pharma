import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
export default function Role() {
const columns = [
  { header: "Role Code", field: "roleCode", width: "240px" },
  { header: "Role Name", field: "roleName", width: "260px" },
  { 
    header: "Permissions", 
    field: "permissions", 
    width: "500px",
    render: (row) => row.permissions.map(p => `${p.module}:${p.action}`).join(", ")
  },
  { header: "Actions", field: "Action", width: "160px" },
];



  return (
    <div className="i-container">
      <h2 className="i-title">
<svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#FFFFFF"><path d="M480-450q-45 0-77.5-32.5T370-560q0-45 32.5-77.5T480-670q45 0 77.5 32.5T590-560q0 45-32.5 77.5T480-450ZM244-40v-304q-45-47-64.5-103T160-560q0-136 92-228t228-92q136 0 228 92t92 228q0 57-19.5 113T716-344v304l-236-79-236 79Zm236-260q109 0 184.5-75.5T740-560q0-109-75.5-184.5T480-820q-109 0-184.5 75.5T220-560q0 109 75.5 184.5T480-300ZM304-124l176-55 176 55v-171q-40 29-86 42t-90 13q-44 0-90-13t-86-42v171Zm176-86Z"/></svg>ROLES</h2>
      
      
      <DynamicGrid 
        columns={columns} 
        apiUrl="http://localhost:8080/api/Roles/GetAllPaged" 
        Module="Roles"
        ModuleId ="6"
      />
      
      <ToastContainer position="top-center" autoClose={2000} />
    </div>
  );
}

