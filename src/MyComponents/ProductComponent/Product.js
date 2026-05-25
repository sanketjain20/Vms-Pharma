import React from "react";
import DynamicGrid from "../CommonComponent/DynamicGrid";
import "../../Styles/Inventory.css";

export default function Product() {
const columns = [
  { header: "Product Code", field: "productCode", width: "150px" },
  { header: "Name", field: "name", width: "180px" },
  { header: "Generic Name", field: "genericName", width: "180px" },
  { header: "Manufacturer", field: "manufacturerName", width: "180px" },
  { header: "Product Type", field: "productType", width: "160px" },
  { header: "HSN Code", field: "hsnCode", width: "120px" },
  { header: "Price (₹)", field: "price", width: "120px" },
  { header: "Unit", field: "unit", width: "100px" },
  { header: "Actions", field: "Action", width: "120px" },
];

return ( <div className="i-container"> <h2 className="i-title"> 💊
PRODUCTS </h2>

  <DynamicGrid
    columns={columns}
    apiUrl="http://localhost:8080/api/Product/GetAllProductPaged"
    Module="Product"
    ModuleId ="3"
  />

  {/* Toast container here */}
</div>

);
}
