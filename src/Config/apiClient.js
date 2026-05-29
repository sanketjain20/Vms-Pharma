// src/config/apiClient.js

import API_BASE_URL from "./api.config";

const getToken = () => {
  try {
    const user = JSON.parse(localStorage.getItem("vmsUser"));
    return user?.token;
  } catch {
    return null;
  }
};

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);

const apiClient = async (endpoint, options = {}) => {
  const token = getToken();
  const url = isAbsoluteUrl(endpoint) ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
};

export default apiClient;
