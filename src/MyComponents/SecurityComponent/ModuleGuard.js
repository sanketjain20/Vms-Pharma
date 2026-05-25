import React from "react";
import { Navigate } from "react-router-dom";

const normalize = (value = "") => String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");

export default function ModuleGuard({ children, moduleName }) {
  let userModules = [];

  try {
    const stored = localStorage.getItem("modules");
    userModules = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(userModules)) userModules = [];
  } catch (e) {
    userModules = [];
  }

  const allowedModules = Array.isArray(moduleName) ? moduleName : [moduleName];
  const normalizedUserModules = userModules.map(normalize);
  const allowed = allowedModules.some((name) => normalizedUserModules.includes(normalize(name)));

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
