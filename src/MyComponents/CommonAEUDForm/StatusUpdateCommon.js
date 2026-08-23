import React, { useState } from "react";
import { toast } from "react-toastify";
import ModalShell from "../CommonComponent/ModalShell";
import "../../Styles/StatusUpdateCommon.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export default function StatusUpdateCommon({ moduleName, uKey, isDisable, onClose }) {
  const [loading, setLoading] = useState(false);

  const isActivating = isDisable === 1;

  const handleStatusUpdate = async () => {
    setLoading(true);

    const apiMap = {
      "Product":      `${API_BASE_URL}/api/Product/ToggleProductDisable/${uKey}/${isDisable}`,
      "Vendor":       `${API_BASE_URL}/api/Vendor/ToggleVendorDisable/${uKey}/${isDisable}`,
      "Inventory":    `${API_BASE_URL}/api/Inventory/ToggleInventoryDisable/${uKey}/${isDisable}`,
      "Sales":        `${API_BASE_URL}/api/sales/ToggleStatus?uKey=${uKey}&isDisable=${isDisable}`,
      "Product Type": `${API_BASE_URL}/api/ProductType/ToggleProdTypeDisable/${uKey}/${isDisable}`,
      "Roles":        `${API_BASE_URL}/api/Roles/ToggleRoleDisable/${uKey}/${isDisable}`,
      "Manufacturer": `${API_BASE_URL}/api/Manufacturer/ToggleManufacturer/${uKey}/${isDisable}`,
      "Retailer":     `${API_BASE_URL}/api/Retailer/ToggleDisable/${uKey}/${isDisable}`,
      "Supplier":     `${API_BASE_URL}/api/Supplier/ToggleDisable/${uKey}/${isDisable}`,
    };

    const apiUrl = apiMap[moduleName];
    if (!apiUrl) {
      toast.error("Invalid module name");
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const result = await response.json();
      setLoading(false);

      if (result.status === 200) {
        toast.success(result.message || "Status updated successfully");
        onClose?.();
      } else {
        toast.error(result.message || "Failed to update status");
      }
    } catch (error) {
      setLoading(false);
      toast.error("API request failed");
      console.error(error);
    }
  };

  const tone = isActivating ? "success" : "danger";

  const icon = isActivating ? (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
      <path d="M4 11.5L8.5 16L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 7v5M11 15h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );

  return (
    <ModalShell
      open
      onClose={loading ? undefined : onClose}
      tone={tone}
      icon={icon}
      title={isActivating ? "Activate Record" : "Deactivate Record"}
      size="sm"
      busy={loading}
      footer={
        <>
          <button className="ms-btn" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={`ms-btn ${isActivating ? "ms-btn--success" : "ms-btn--danger"}`}
            onClick={handleStatusUpdate}
            disabled={loading}
          >
            {loading ? <span className="ms-spinner" /> : isActivating ? "Activate" : "Deactivate"}
          </button>
        </>
      }
    >
      Are you sure you want to{" "}
      <span className={`su-verb ${isActivating ? "su-verb-green" : "su-verb-red"}`}>
        {isActivating ? "activate" : "deactivate"}
      </span>{" "}
      this <strong className="su-module">{moduleName}</strong>?
      {!isActivating && (
        <div className="su-warning-note">This will disable access to this record.</div>
      )}
    </ModalShell>
  );
}
