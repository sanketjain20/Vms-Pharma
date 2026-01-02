// src/MyComponents/Services/reportServices.js
import { VmsEntity } from "../Enums/VmsEntity";

// Each function constructs payload and calls the respective API
export const runReportByModule = async (moduleId, filters) => {
  let apiUrl = "";
  
  // Map moduleId to API URL
  switch (moduleId) {
    case VmsEntity.Vendor:
      apiUrl = "http://localhost:8080/api/Vendor/report";
      break;
    case VmsEntity.ProductType:
      apiUrl = "http://localhost:8080/api/ProductType/Report";
      break;
    case VmsEntity.Product:
      apiUrl = "http://localhost:8080/api/Product/Report";
      break;
    case VmsEntity.Inventory:
      apiUrl = "http://localhost:8080/api/Inventory/Report";
      break;
    case VmsEntity.Sales:
      apiUrl = "http://localhost:8080/api/Sales/Report";
      break;
    case VmsEntity.Roles:
      apiUrl = "http://localhost:8080/api/Roles/GenerateReport";
      break;
    case VmsEntity.Reports:
      apiUrl = "http://localhost:8080/api/Reports/GenerateReport";
      break;
    default:
      throw new Error("Invalid module ID");
  }

  // Convert empty string values to null
  const payload = {};
  Object.keys(filters).forEach((key) => {
    payload[key] = filters[key] && filters[key].trim() !== "" ? filters[key] : null;
  });

  const res = await fetch(apiUrl, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to generate report");
  }

  const blob = await res.blob();
  return blob;
};

