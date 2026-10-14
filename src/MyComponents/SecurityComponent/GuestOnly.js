import React from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated, isFieldRep } from "./RequireAuth";

export default function GuestOnly({ children }) {
  if (isAuthenticated()) {
    return <Navigate to={isFieldRep() ? "/rep" : "/home"} replace />;
  }

  return children;
}
