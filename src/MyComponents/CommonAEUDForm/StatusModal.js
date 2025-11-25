import React from "react";
import "../../Styles/ModuleModal.css";
import StatusUpdateCommon from "../CommonAEUDForm/StatusUpdateCommon";

export default function StatusModal({isOpen,onClose,moduleName,uKey,isDisable,onSubmit
}) {

if (!isOpen) return null;

const handleClose = () => {
onClose && onClose();
onSubmit && onSubmit();
};

return ( <div className="modal-overlay"> <div className="modal-box"> <div className="modal-body"> <StatusUpdateCommon
         moduleName={moduleName}
         uKey={uKey}
         isDisable={isDisable}
         onClose={handleClose}
       /> </div> </div> </div>
);
}
