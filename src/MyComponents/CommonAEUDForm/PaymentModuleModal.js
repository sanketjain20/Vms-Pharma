import React from "react";
import ReactDOM from "react-dom";

import PaymentCollectionPage from "../PaymentCollectionComponent/PaymentCollectionPage";

export default function PaymentModuleModal({ isOpen, onClose, moduleName }) {
  if (!isOpen) return null;

  let content = null;

  switch (moduleName) {
    case "PaymentCollection":
    case "Payment Collection":
      content = (
        <div className="modal-fullscreen-wrapper">
          {/* Optional close button */}
          <button className="modal-close-btn" onClick={onClose}>✕</button>

          <PaymentCollectionPage />
        </div>
      );
      break;

    default:
      return null;
  }

  return ReactDOM.createPortal(content, document.body);
}