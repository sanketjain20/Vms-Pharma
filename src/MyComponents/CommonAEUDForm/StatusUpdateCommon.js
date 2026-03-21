import React, { useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/StatusUpdateCommon.css";

export default function StatusUpdateCommon({ moduleName, uKey, isDisable, onClose }) {
  const [loading, setLoading] = useState(false);

  const isActivating = isDisable === 1;

  const handleStatusUpdate = async () => {
    setLoading(true);

    const apiMap = {
      "Product":      `http://localhost:8080/api/Product/ToggleProductDisable/${uKey}/${isDisable}`,
      "Vendor":       `http://localhost:8080/api/Vendor/ToggleVendorDisable/${uKey}/${isDisable}`,
      "Inventory":    `http://localhost:8080/api/Inventory/ToggleInventoryDisable/${uKey}/${isDisable}`,
      "Sales":        `/api/sales/ToggleStatus?uKey=${uKey}&isDisable=${isDisable}`,
      "Product Type": `http://localhost:8080/api/ProductType/ToggleProdTypeDisable/${uKey}/${isDisable}`,
      "Roles":        `http://localhost:8080/api/Roles/ToggleRoleDisable/${uKey}/${isDisable}`,
    };

    const apiUrl = apiMap[moduleName];
    if (!apiUrl) {
      toast.error("Invalid module name");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        credentials: "include",
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

  return (
    <div className="su-overlay">
      <div className="su-modal">

        {/* Top beam */}
        <div className="su-top-beam" />
        {/* Corners */}
        <div className="su-corner su-tl" /><div className="su-corner su-tr" />
        <div className="su-corner su-bl" /><div className="su-corner su-br" />

        {/* Icon */}
        <div className={`su-icon-ring ${isActivating ? "su-ring-green" : "su-ring-red"}`}>
          {isActivating ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 11.5L8.5 16L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M11 7v5M11 15h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* Title */}
        <div className="su-heading">
          {isActivating ? "Activate Record" : "Deactivate Record"}
        </div>

        {/* Body text */}
        <p className="su-body-text">
          Are you sure you want to{" "}
          <span className={isActivating ? "su-green" : "su-red"}>
            {isActivating ? "activate" : "deactivate"}
          </span>{" "}
          this <span className="su-module-name">{moduleName}</span>?
          {!isActivating && (
            <span className="su-warning-note">
              <br />This will disable access to this record.
            </span>
          )}
        </p>

        {/* Actions */}
        <div className="su-actions">
          <button className="su-btn-cancel" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`su-btn-confirm ${isActivating ? "su-btn-activate" : "su-btn-disable"}`}
            onClick={handleStatusUpdate}
            disabled={loading}
          >
            {loading ? (
              <span className="su-spinner" />
            ) : isActivating ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6.5L5 9.5L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Activate {moduleName}
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/>
                  <path d="M6 3.5V6.5M6 8.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Deactivate {moduleName}
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
