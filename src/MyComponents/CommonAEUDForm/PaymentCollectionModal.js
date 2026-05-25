import React from "react";
import ReactDOM from "react-dom";

import PaymentCollect from "../PaymentCollectionComponent/PaymentCollect";
import RetailerCollectPayment from "../RetailerOutstandingComponent/CollectPayment";
import SupplierMakePayment from "../SupplierOutstandingComponent/MakePayment";

export default function PaymentCollectionModal({ isOpen, onClose, moduleName, uKey, onSubmit }) {
  if (!isOpen) return null;

  let content = null;
  switch (moduleName) {
    case "Sales":
      content = (
        <PaymentCollect
          onSubmit={onSubmit}
          onClose={onClose}
          prefillSalesUKey={uKey}
        />
      );
      break;
    case "Retailer Outstanding":
      content = (
        <RetailerCollectPayment
          uKey={uKey}
          onSuccess={onSubmit}
          onClose={onClose}
        />
      );
      break;
    case "Supplier Outstanding":
      content = (
        <SupplierMakePayment
          uKey={uKey}
          onSuccess={onSubmit}
          onClose={onClose}
        />
      );
      break;
    default:
      content = <PaymentCollect onSubmit={onSubmit} onClose={onClose} />;
      break;
  }

  return ReactDOM.createPortal(content, document.body);
}
