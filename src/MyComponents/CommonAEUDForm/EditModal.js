import React from "react";
import ReactDOM from "react-dom";

import ProductEdit     from "../ProductComponent/ProductEdit";
import VendorEdit      from "../VendorComponent/VendorEdit";
import InventoryEdit   from "../InventoryComponent/InventoryEdit";
import SalesEdit       from "../SalesComponent/SalesEdit";
import ProductTypeEdit from "../ProductTypeComponent/ProductTypeEdit";
import RoleEdit        from "../RoleComponent/RoleEdit";
import SupplierEdit    from "../SupplierComponent/SupplierEdit";
import PurchaseEdit    from "../PurchaseComponent/PurchaseEdit";
import ManufacturerEdit from "../ManufacturerComponent/ManufacturerEdit";
import RetailerEdit from "../RetailerComponent/RetailerEdit";

export default function EditModal({ isOpen, onClose, moduleName, uKey, onSubmit }) {
  if (!isOpen) return null;

  let content = null;
  switch (moduleName) {
    case "Product":      content = <ProductEdit     uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Vendor":       content = <VendorEdit      uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Inventory":    content = <InventoryEdit   uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Sales":        content = <SalesEdit       uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Product Type": content = <ProductTypeEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Roles":        content = <RoleEdit        uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Supplier":     content = <SupplierEdit    uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Purchase":     content = <SupplierEdit    uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Manufacturer": content = <ManufacturerEdit uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    case "Retailer":     content = <RetailerEdit    uKey={uKey} onClose={onClose} onSubmit={onSubmit} />; break;
    default:             return null;
  }

  return ReactDOM.createPortal(content, document.body);
}
