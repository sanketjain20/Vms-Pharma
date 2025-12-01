import React from "react";
import "../../Styles/ModuleModal.css";

// Import all module forms
import ProductForm from "../ProductComponent/ProductForm";
import VendorAdd from "../VendorComponent/VendorAdd";
import InventoryAdd from "../InventoryComponent/InventoryAdd";
import SalesAdd from "../SalesComponent/SalesAdd";
import ProductTypeAdd from "../ProductTypeComponent/ProductTypeAdd";
import RoleAdd from "../RoleComponent/RoleAdd";

export default function ModuleModal({ isOpen, onClose, moduleName, onSubmit }) {
  if (!isOpen) return null;

  const renderForm = () => {
    switch (moduleName) {
      case "Product":
        return <ProductForm onSubmit={onSubmit} onClose={onClose} />;
      case "Vendor":
        return <VendorAdd onSubmit={onSubmit} onClose={onClose} />;
      case "Inventory":
        return <InventoryAdd onSubmit={onSubmit} onClose={onClose} />;
      case "Sales":
        return <SalesAdd onSubmit={onSubmit} onClose={onClose} />;
      case "Product Type":
        return <ProductTypeAdd onSubmit={onSubmit} onClose={onClose} />;
         case "Roles":
        return <RoleAdd onSubmit={onSubmit} onClose={onClose} />;
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
