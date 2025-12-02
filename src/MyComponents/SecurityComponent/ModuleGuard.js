import React from "react";
import { Navigate } from "react-router-dom";

export default function ModuleGuard({ children, moduleName }) {
  let userModules = [];

  try {
    const stored = localStorage.getItem("modules");
    userModules = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(userModules)) userModules = [];
  } catch (e) {
    userModules = [];
  }

  // Convert everything to uppercase for perfect matching
  const allowed = userModules.map(m => m.toUpperCase()).includes(moduleName.toUpperCase());

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
