import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "./RequireAuth";

export default function GuestOnly({ children }) {
  if (isAuthenticated()) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
