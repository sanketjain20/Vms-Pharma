import React from "react";
import ReactDOM from "react-dom";

import ProductView     from "../ProductComponent/ProductView";
import VendorView      from "../VendorComponent/VendorView";
import InventoryView   from "../InventoryComponent/InventoryView";
import SalesView       from "../SalesComponent/SalesView";
import ProductTypeView from "../ProductTypeComponent/ProductTypeView";
import RoleView        from "../RoleComponent/RoleView";
import SupplierView    from "../SupplierComponent/SupplierView";
import PurchaseView    from "../PurchaseComponent/PurchaseView";
import Manufacturer from "../ManufacturerComponent/Manufacturer";
import ManufacturerView from "../ManufacturerComponent/ManufacturerView";
import RetailerView from "../RetailerComponent/RetailerView";
import PaymentView from "../PaymentCollectionComponent/PaymentView";

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
    case "Supplier":     content = <SupplierView    uKey={uKey} onClose={onClose} />; break;
    case "Purchase":     content = <PurchaseView    uKey={uKey} onClose={onClose} />; break;
    case "Manufacturer": content = <ManufacturerView    uKey={uKey} onClose={onClose} />; break;
    case "Retailer":     content = <RetailerView      uKey={uKey} onClose={onClose} />; break;
    case "Payment Collection": content = <PaymentView uKey={uKey} onClose={onClose} />; break;
    default:             return null;
  }

  return ReactDOM.createPortal(content, document.body);
}
