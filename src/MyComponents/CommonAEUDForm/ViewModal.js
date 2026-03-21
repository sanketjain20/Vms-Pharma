import React from "react";
import ReactDOM from "react-dom";

import ProductView     from "../ProductComponent/ProductView";
import VendorView      from "../VendorComponent/VendorView";
import InventoryView   from "../InventoryComponent/InventoryView";
import SalesView       from "../SalesComponent/SalesView";
import ProductTypeView from "../ProductTypeComponent/ProductTypeView";
import RoleView        from "../RoleComponent/RoleView";

export default function ViewModal({ isOpen, onClose, moduleName, uKey }) {
  if (!isOpen) return null;

  let content = null;
  switch (moduleName) {
    case "Product":      content = <ProductView     uKey={uKey} onClose={onClose} />; break;
    case "Vendor":       content = <VendorView      uKey={uKey} onClose={onClose} />; break;
    case "Inventory":    content = <InventoryView   uKey={uKey} onClose={onClose} />; break;
    case "Sales":        content = <SalesView       uKey={uKey} onClose={onClose} />; break;
    case "Product Type": content = <ProductTypeView uKey={uKey} onClose={onClose} />; break;
    case "Roles":        content = <RoleView        uKey={uKey} onClose={onClose} />; break;
    default:             return null;
  }

  return ReactDOM.createPortal(content, document.body);
}
