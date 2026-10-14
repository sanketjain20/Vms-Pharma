import React from "react";
import SchemeForm from "./SchemeForm";

export default function SchemeAdd({ onClose, onSubmit }) {
  return <SchemeForm onClose={onClose} onSubmit={onSubmit} />;
}
