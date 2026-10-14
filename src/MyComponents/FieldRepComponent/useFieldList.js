import { useCallback, useEffect, useRef, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

export const FIELD_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Server-side paged + searchable list for the Field Sales screens. Talks to `<basePath>/<page>/<size>?status=&search=`
 * (page is 1-based) and returns one page of rows, latest first. Changing the status filter or the search jumps back to
 * page 1; a stale response from an earlier keystroke never overwrites a newer one.
 */
export default function useFieldList(basePath, status = "") {
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  // a new filter or search term starts from the first page
  useEffect(() => { setPage(1); }, [status, search]);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    const query = params.toString();
    try {
      const res = await apiClient(`${API_BASE_URL}${basePath}/${page}/${FIELD_PAGE_SIZE}${query ? `?${query}` : ""}`, {
        headers: { "Content-Type": "application/json" },
      });
      let json = null;
      try { json = await res.json(); } catch { /* non-JSON error body */ }
      if (requestId !== requestRef.current) return;
      if (json?.status === 200 && json.data) {
        setRows(json.data.content || []);
        setTotalPages(json.data.totalPages || 0);
        setTotalElements(json.data.totalElements || 0);
        setError("");
        // the last page emptied out (e.g. after a decision) — step back instead of showing a blank page
        if ((json.data.content || []).length === 0 && page > 1 && json.data.totalPages > 0 && page > json.data.totalPages) {
          setPage(json.data.totalPages);
        }
      } else {
        setRows([]);
        setTotalPages(0);
        setTotalElements(0);
        setError(json?.message || "Could not load the list.");
      }
    } catch {
      if (requestId === requestRef.current) setError("Could not load the list.");
    }
  }, [basePath, status, search, page]);

  useEffect(() => { load(); }, [load]);

  return { rows, page, setPage, totalPages, totalElements, searchInput, setSearchInput, error, reload: load };
}
