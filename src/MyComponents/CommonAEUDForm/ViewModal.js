import React from "react";
import "../../Styles/ModuleModal.css";

// Import all module forms
import ProductView from "../ProductComponent/ProductView";
import VendorView from "../VendorComponent/VendorView";
import InventoryView from "../InventoryComponent/InventoryView";
import SalesView from "../SalesComponent/SalesView";
import ProductTypeView from "../ProductTypeComponent/ProductTypeView";
import RoleView from "../RoleComponent/RoleView";

export default function ViewModal({ isOpen, onClose, moduleName, uKey }) {
  if (!isOpen) return null;

  const renderForm = () => {
    switch (moduleName) {
      case "Product":
        return <ProductView uKey={uKey} onClose={onClose} />;
      case "Vendor":
        return <VendorView uKey={uKey} onClose={onClose} />;
      case "Inventory":
        return <InventoryView uKey={uKey} onClose={onClose} />;
      case "Sales":
        return <SalesView uKey={uKey} onClose={onClose} />;
      case "Product Type":
        return <ProductTypeView uKey={uKey} onClose={onClose} />;
      case "Roles":
        return <RoleView uKey={uKey} onClose={onClose} />;
      default:
        return <p>No form available for {moduleName}</p>;
    }
  };

  return (


    <div className="modal-body">
      {renderForm()}
    </div>
  );
}
