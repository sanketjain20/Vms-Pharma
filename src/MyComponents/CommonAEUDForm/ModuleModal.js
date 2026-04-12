import React from "react";
import ReactDOM from "react-dom";

import ProductForm    from "../ProductComponent/ProductForm";
import VendorAdd      from "../VendorComponent/VendorAdd";
import InventoryAdd   from "../InventoryComponent/InventoryAdd";
import SalesAdd       from "../SalesComponent/SalesAdd";
import ProductTypeAdd from "../ProductTypeComponent/ProductTypeAdd";
import RoleAdd        from "../RoleComponent/RoleAdd";
import PurchaseAdd     from "../PurchaseComponent/PurchaseAdd";
import SupplierAdd from "../SupplierComponent/SupplierAdd";
import ManufacturerAdd from "../ManufacturerComponent/ManufacturerAdd";
import RetailerAdd from "../RetailerComponent/RetailerAdd";
import PaymentCollect from "../PaymentCollectionComponent/PaymentCollect";

export default function ModuleModal({ isOpen, onClose, moduleName, onSubmit }) {
  if (!isOpen) return null;

  let content = null;
  switch (moduleName) {
    case "Product":      content = <ProductForm    onSubmit={onSubmit} onClose={onClose} />; break;
    case "Vendor":       content = <VendorAdd      onSubmit={onSubmit} onClose={onClose} />; break;
    case "Inventory":    content = <InventoryAdd   onSubmit={onSubmit} onClose={onClose} />; break;
    case "Sales":        content = <SalesAdd       onSubmit={onSubmit} onClose={onClose} />; break;
    case "Product Type": content = <ProductTypeAdd onSubmit={onSubmit} onClose={onClose} />; break;
    case "Roles":        content = <RoleAdd        onSubmit={onSubmit} onClose={onClose} />; break;
    case "Purchase":     content = <PurchaseAdd     onSubmit={onSubmit} onClose={onClose} />; break;
    case "Supplier":     content = <SupplierAdd      onSubmit={onSubmit} onClose={onClose} />; break;
    case "Manufacturer":   content = <ManufacturerAdd    onSubmit={onSubmit} onClose={onClose} />; break;
    case "Retailer":     content = <RetailerAdd      onSubmit={onSubmit} onClose={onClose} />; break;
    case "Payment Collection": content = <PaymentCollect onSubmit={onSubmit} onClose={onClose} />; break;
    default:             return null;
  }

  // Portal renders directly into document.body, completely outside the grid DOM tree.
  // This prevents any parent CSS (transform, overflow:hidden, etc.) from
  // breaking position:fixed on the child's backdrop.
  return ReactDOM.createPortal(content, document.body);
}
 