import React from "react";
import { Navigate } from "react-router-dom";

export default function ModuleGuard({ children, moduleName }) {
  const userModules = JSON.parse(localStorage.getItem("modules")) || [];

  // Convert everything to uppercase for perfect matching
  const allowed = userModules.includes(moduleName.toUpperCase());

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
