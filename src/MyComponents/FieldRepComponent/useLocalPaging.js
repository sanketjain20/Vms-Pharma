import { useEffect, useMemo, useState } from "react";
import { FIELD_PAGE_SIZE } from "./useFieldList";

/**
 * Search + paging over a list that is already loaded and naturally bounded (the reps of one vendor, one report period,
 * one date range of check-ins). The big, growing lists — orders, collections, handovers — page on the server instead
 * (see useFieldList). `searchText(row)` returns the text a row can be found by; the incoming order is kept, so the
 * server's latest-first ordering carries through.
 */
export default function useLocalPaging(rows, searchText, size = FIELD_PAGE_SIZE) {
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const term = searchInput.trim().toLowerCase();
  const filtered = useMemo(
    () => (term ? rows.filter((r) => String(searchText(r) || "").toLowerCase().includes(term)) : rows),
    // searchText is a stable per-screen function; re-filtering only when the data or the term changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, term],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  useEffect(() => { setPage(1); }, [term, rows]);
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * size, safePage * size), [filtered, safePage, size]);

  return { pageRows, page: safePage, setPage, totalPages, total: filtered.length, searchInput, setSearchInput };
}
