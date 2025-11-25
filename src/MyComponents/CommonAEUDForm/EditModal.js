import React from "react";
import "../../Styles/ModuleModal.css";

// Import all module forms
import ProductEdit from "../ProductComponent/ProductEdit";
import VendorEdit from "../VendorComponent/VendorEdit";
import InventoryEdit from "../InventoryComponent/InventoryEdit";
import SalesEdit from "../SalesComponent/SalesEdit";

export default function EditModal({ isOpen, onClose, moduleName, uKey,onSubmit }) {
  if (!isOpen) return null;

  const renderForm = () => {
    switch (moduleName) {
      case "Product":
        return <ProductEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Vendor":
        return <VendorEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit}/>;
      case "Inventory":
        return <InventoryEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Sales":
        return <SalesEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
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
