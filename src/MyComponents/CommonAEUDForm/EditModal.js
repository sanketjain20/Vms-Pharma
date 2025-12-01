import React from "react";
import "../../Styles/ModuleModal.css";

// Import all module forms
import ProductEdit from "../ProductComponent/ProductEdit";
import VendorEdit from "../VendorComponent/VendorEdit";
import InventoryEdit from "../InventoryComponent/InventoryEdit";
import SalesEdit from "../SalesComponent/SalesEdit";
import ProductTypeEdit from "../ProductTypeComponent/ProductTypeEdit";
import RoleEdit from "../RoleComponent/RoleEdit";

export default function EditModal({ isOpen, onClose, moduleName, uKey, onSubmit }) {
  if (!isOpen) return null;

  const renderForm = () => {
    switch (moduleName) {
      case "Product":
        return <ProductEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Vendor":
        return <VendorEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Inventory":
        return <InventoryEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Sales":
        return <SalesEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
      case "Product Type":
        return <ProductTypeEdit uKey={uKey} onSubmit={onSubmit} onClose={onClose} />;
      case "Roles":
        return <RoleEdit uKey={uKey} onSubmit={onSubmit} onClose={onClose} />;
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
