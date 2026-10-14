import { useEffect, useState } from "react";
import API_BASE_URL from "../Config/api.config";
import apiClient from "../Config/apiClient";

/**
 * The actions ("View", "Add", "Edit", "Disable"…) the logged-in user's role holds on one module — the same
 * /api/Access/GetUserModuleAccess lookup DynamicGrid uses. Until it answers, `can()` is false, so a button never
 * flashes up for a user who is not allowed it. The backend enforces the same permissions on every endpoint; this only
 * decides what the screen shows.
 */
export default function useModuleActions(moduleId) {
  const [actions, setActions] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const roleId = localStorage.getItem("roleId");
    apiClient(`${API_BASE_URL}/api/Access/GetUserModuleAccess/${moduleId}/${roleId}`, { method: "GET" })
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled) setActions(res?.status === 200 && Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setActions([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [moduleId]);

  return { loaded, can: (action) => actions.includes(action) };
}
