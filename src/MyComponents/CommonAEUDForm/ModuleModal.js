import React from "react";
import "../../Styles/ModuleModal.css";

// Import all module forms
import ProductForm from "../ProductComponent/ProductForm";
import VendorForm from "../VendorComponent/VendorForm";
import InventoryForm from "../InventoryComponent/InventoryForm";
import SalesForm from "../SalesComponent/SalesForm";

export default function ModuleModal({ isOpen, onClose, moduleName, onSubmit }) {
  if (!isOpen) return null;

  const renderForm = () => {
    switch (moduleName) {
      case "Product":
        return <ProductForm onSubmit={onSubmit} onClose={onClose} />;
      case "Vendor":
        return <VendorForm onSubmit={onSubmit} onClose={onClose} />;
      case "Inventory":
        return <InventoryForm onSubmit={onSubmit} onClose={onClose} />;
      case "Sales":
        return <SalesForm onSubmit={onSubmit} onClose={onClose} />;
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
