// The shop's business type and whether it tracks expiry dates (Phase 4), read once per login and shared by every
// screen that shows or hides pharma-only parts. When it can't be read (an older backend, offline) the shop is treated
// as a pharmacy that tracks expiry — the app's original behaviour — so nothing a pharmacy relies on ever disappears.

import { useEffect, useState } from "react";
import apiClient from "../Config/apiClient";
import API_BASE_URL from "../Config/api.config";

export const PHARMA_PROFILE = Object.freeze({
  businessType: "PHARMA",
  businessTypeLabel: "Pharmacy / medical",
  trackExpiry: true,
  isPharma: true,
  canChange: false,
  types: [],
});

let cache = null; // { token, promise }

const currentToken = () => {
  try {
    return JSON.parse(localStorage.getItem("vmsUser") || "null")?.data?.token || "";
  } catch {
    return "";
  }
};

/** Resolves to the shop's profile; one request per login, shared by everyone who asks. */
export function fetchBusinessProfile() {
  const token = currentToken();
  if (cache && cache.token === token) return cache.promise;
  const promise = apiClient(`${API_BASE_URL}/api/BusinessSetting/Get`, { method: "GET" })
    .then((r) => r.json())
    .then((json) => (json?.status === 200 && json.data ? { ...PHARMA_PROFILE, ...json.data } : PHARMA_PROFILE))
    .catch(() => PHARMA_PROFILE);
  cache = { token, promise };
  return promise;
}

/** Forget the cached profile (after saving it, and between tests). */
export function resetBusinessProfile() {
  cache = null;
}

/** PUT the profile; on success the cache is refreshed so every screen sees the change. */
export async function saveBusinessProfile({ businessType, trackExpiry }) {
  const res = await apiClient(`${API_BASE_URL}/api/BusinessSetting/Save`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessType, trackExpiry }),
  });
  const json = await res.json();
  if (json?.status === 200) resetBusinessProfile();
  return json;
}

/** The shop's profile: a pharmacy until the real one has loaded. */
export function useBusinessProfile() {
  const [profile, setProfile] = useState(PHARMA_PROFILE);
  useEffect(() => {
    let live = true;
    fetchBusinessProfile().then((p) => { if (live) setProfile(p); });
    return () => { live = false; };
  }, []);
  return profile;
}
