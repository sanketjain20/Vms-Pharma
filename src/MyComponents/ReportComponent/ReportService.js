// src/MyComponents/Services/reportServices.js
import { ReportEntity } from "../Enums/ReportEntity";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";


// Each function constructs payload and calls the respective API
export const runReportByModule = async (moduleId, filters) => {
  let apiUrl = "";
  
  // Map moduleId to API URL
  switch (moduleId) {
    case ReportEntity.Vendor:
      apiUrl = `${API_BASE_URL}/api/Vendor/report`;
      break;
    case ReportEntity.ProductType:
      apiUrl = `${API_BASE_URL}/api/ProductType/Report`;
      break;
    case ReportEntity.Product:
      apiUrl = `${API_BASE_URL}/api/Product/Report`;
      break;
    case ReportEntity.Inventory:
      apiUrl = `${API_BASE_URL}/api/Inventory/Report`;
      break;
    case ReportEntity.Sales:
      apiUrl = `${API_BASE_URL}/api/Sales/Report`;
      break;
    case ReportEntity.Roles:
      apiUrl = `${API_BASE_URL}/api/Roles/GenerateReport`;
      break;
    case ReportEntity.Reports:
      apiUrl = `${API_BASE_URL}/api/Reports/GenerateReport`;
      break;
    case ReportEntity.Revenue:
      apiUrl = `${API_BASE_URL}/api/Reports/RevenueReport`;
      break;
    case ReportEntity.StockMovement:
      apiUrl = `${API_BASE_URL}/api/Inventory/InvMovementFileReport`;
      break;
    case ReportEntity.Outstanding:
        apiUrl = `${API_BASE_URL}/api/Reports/OutstandingReport`;
        break;
    case ReportEntity.RetailerCustomer:
        apiUrl = `${API_BASE_URL}/api/Reports/CustomerReport`;
        break;
    case ReportEntity.Purchase:
        apiUrl = `${API_BASE_URL}/api/Purchase/PurchaseReport`;
        break;
    case ReportEntity.Supplier:
        apiUrl = `${API_BASE_URL}/api/Supplier/SupplierReport`;
        break;
    case ReportEntity.PaymentCollection:
        apiUrl = `${API_BASE_URL}/api/PaymentCollection/PaymentCollectionReport`;
        break;
    case ReportEntity.DayBook:
        apiUrl = `${API_BASE_URL}/api/Reports/DayBookReport`;
        break;
    case ReportEntity.GSTR1:
        apiUrl = `${API_BASE_URL}/api/Reports/GstReport`;
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

  const res = await apiClient(apiUrl, {
    method: "POST",
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

