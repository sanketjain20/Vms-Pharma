// src/MyComponents/Services/reportServices.js
import { ReportEntity } from "../Enums/ReportEntity";

// Each function constructs payload and calls the respective API
export const runReportByModule = async (moduleId, filters) => {
  let apiUrl = "";
  
  // Map moduleId to API URL
  switch (moduleId) {
    case ReportEntity.Vendor:
      apiUrl = "http://localhost:8080/api/Vendor/report";
      break;
    case ReportEntity.ProductType:
      apiUrl = "http://localhost:8080/api/ProductType/Report";
      break;
    case ReportEntity.Product:
      apiUrl = "http://localhost:8080/api/Product/Report";
      break;
    case ReportEntity.Inventory:
      apiUrl = "http://localhost:8080/api/Inventory/Report";
      break;
    case ReportEntity.Sales:
      apiUrl = "http://localhost:8080/api/Sales/Report";
      break;
    case ReportEntity.Roles:
      apiUrl = "http://localhost:8080/api/Roles/GenerateReport";
      break;
    case ReportEntity.Reports:
      apiUrl = "http://localhost:8080/api/Reports/GenerateReport";
      break;
    case ReportEntity.Revenue:
      apiUrl = "http://localhost:8080/api/Reports/RevenueReport";
      break;
    case ReportEntity.StockMovement:
      apiUrl = "http://localhost:8080/api/Inventory/InvMovementFileReport";
      break;
    case ReportEntity.Outstanding:
        apiUrl = "http://localhost:8080/api/Reports/OutstandingReport";
        break;
    case ReportEntity.RetailerCustomer:
        apiUrl = "http://localhost:8080/api/Reports/CustomerReport";
        break;
    case ReportEntity.Purchase:
        apiUrl = "http://localhost:8080/api/Purchase/PurchaseReport";
        break;
    case ReportEntity.Supplier:
        apiUrl = "http://localhost:8080/api/Supplier/SupplierReport";
        break;
    case ReportEntity.PaymentCollection:
        apiUrl = "http://localhost:8080/api/PaymentCollection/PaymentCollectionReport";
        break;
    case ReportEntity.DayBook:
        apiUrl = "http://localhost:8080/api/Reports/DayBookReport";
        break;
    case ReportEntity.GSTR1:
        apiUrl = "http://localhost:8080/api/Reports/GstReport";
        break;
    default:
      throw new Error("Invalid module ID");
  }

  // Convert empty string values to null
const payload = {};

Object.keys(filters).forEach((key) => {
  const value = filters[key];

  if (value === "" || value === undefined) {
    payload[key] = null;
  } else {
    payload[key] = value;
  }
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

