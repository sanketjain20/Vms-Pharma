import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export function isAuthenticated() {
  try {
    const user = JSON.parse(localStorage.getItem("vmsUser"));
    return Boolean(user?.data?.token);
  } catch {
    return false;
  }
}

export default function RequireAuth({ children }) {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
