import React, { useState } from "react";
import { toast } from "react-toastify";
import "../../Styles/StatusUpdateCommon.css";

export default function StatusUpdateCommon({ moduleName, uKey, isDisable, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleStatusUpdate = async () => {
    console.log("Status Update Called for ", moduleName, uKey, isDisable);
    setLoading(true);

    let apiUrl = "";

    switch (moduleName) {
      case "Product":
        apiUrl = `http://localhost:8080/api/Product/ToggleProductDisable/${uKey}/${isDisable}`;
        break;
      case "Vendor":
        apiUrl = `/api/vendor/ToggleStatus?uKey=${uKey}&isDisable=${isDisable}`;
        break;
      case "Inventory":
        apiUrl = `/api/inventory/ToggleStatus?uKey=${uKey}&isDisable=${isDisable}`;
        break;
      case "Sales":
        apiUrl = `/api/sales/ToggleStatus?uKey=${uKey}&isDisable=${isDisable}`;
        break;
      case "Product Type":
        apiUrl = `http://localhost:8080/api/ProductType/ToggleProdTypeDisable/${uKey}/${isDisable}`;
        break;
      default:
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
        onClose && onClose(); // Close modal + refresh grid
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
  <div className="modal-overlay">
  <div className="modal-box">
    <>
      {/* Close Button */}
      <button
        className="close-btn"
        onClick={onClose} // Use onClose prop
        title="Close"
      >
        ✖
      </button>

      <div className="status-text">
        Are you sure you want to{" "}
        <span className={isDisable === 1 ? "green-text" : "red-text"}>
          {isDisable === 1 ? "Active" : "InActive"}
        </span>{" "}
        the <b>{moduleName}</b>?
      </div>

      <button
        onClick={handleStatusUpdate}
        disabled={loading}
        className={`status-btn ${
          isDisable === 1 ? "activate-btn" : "disable-btn"
        }`}
      >
        {loading
          ? "Processing..."
          : isDisable === 1
          ? `Activate ${moduleName}`
          : `InActivate ${moduleName}`}
      </button>
    </>
  </div>
</div>

  );
}
