import React from "react";
import StatusUpdateCommon from "../CommonAEUDForm/StatusUpdateCommon";

export default function StatusModal({ isOpen, onClose, moduleName, uKey, isDisable, onSubmit }) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose && onClose();
    onSubmit && onSubmit();
  };

  return (
    <StatusUpdateCommon
      moduleName={moduleName}
      uKey={uKey}
      isDisable={isDisable}
      onClose={handleClose}
    />
  );
}
