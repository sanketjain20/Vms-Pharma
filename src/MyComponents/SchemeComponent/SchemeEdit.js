import React from "react";
import SchemeForm from "./SchemeForm";

export default function SchemeEdit({ uKey, onClose, onSubmit }) {
  return <SchemeForm uKey={uKey} onClose={onClose} onSubmit={onSubmit} />;
}
