// src/config/apiClient.js

import API_BASE_URL from "./api.config";
import { beginGlobalBusy } from "../utils/globalBusy";

const getToken = () => {
  try {
    const user = JSON.parse(localStorage.getItem("vmsUser"));
    const raw = user?.data?.token;
    console.log("Raw:", raw);
    return user?.data?.token;
  } catch {
    return null;
  }
};

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const apiClient = async (endpoint, options = {}) => {
  const {
    globalLoader = true,
    busyLabel,
    ...fetchOptions
  } = options;
  const token = getToken();
  const url = isAbsoluteUrl(endpoint) ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(fetchOptions.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;

  if (fetchOptions.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = String(fetchOptions.method || "GET").toUpperCase();
  const shouldShowLoader =
    globalLoader && ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const stopBusy = shouldShowLoader
    ? beginGlobalBusy(busyLabel || (method === "DELETE" ? "Processing..." : "Saving changes..."))
    : null;

  let response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
      globalBusyHandled: true,
    });
  } finally {
    stopBusy?.();
  }

  if (response.status === 401 && !url.includes("/api/auth/")) {
    localStorage.removeItem("vmsUser");
    localStorage.removeItem("modules");
    if (window.location.pathname !== "/") {
      window.location.replace("/");
    }
  }

  return response;
};

export default apiClient;
