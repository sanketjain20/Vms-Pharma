import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Decodes a JWT's payload without verifying its signature — good enough to
// read the exp claim client-side; the backend is still the source of truth
// and rejects the token independently via JwtUtil once it's actually used.
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// The backend always sets an `exp` claim (JwtUtil, 24h) — a token that
// doesn't decode or has no exp is corrupted/tampered, not a valid session,
// so it's treated as expired too rather than trusted.
function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() >= payload.exp * 1000;
}

export function isAuthenticated() {
  try {
    const user = JSON.parse(localStorage.getItem("vmsUser"));
    const token = user?.data?.token;
    if (!token) return false;

    if (isTokenExpired(token)) {
      // Stale/expired session — clear it so a leftover token can't keep
      // silently granting access to protected routes on later loads.
      localStorage.removeItem("vmsUser");
      localStorage.removeItem("modules");
      return false;
    }

    return true;
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
