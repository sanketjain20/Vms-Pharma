import React from "react";

/** The page numbers to show: always first and last, a window around the current page, "…" for the gaps. */
export function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4, 5].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap-" + p);
    out.push(p);
  });
  return out;
}

/** "Prev 1 2 3 4 5 … Next" — page is 1-based. Renders nothing when everything fits on one page. */
/** variant "ra" renders with the rep app's own classes (ra-pager) instead of the office ones (fr-pager). */
export default function FieldPager({ page, totalPages, onChange, label = "Pagination", variant = "fr" }) {
  if (!totalPages || totalPages <= 1) return null;
  const p = variant;
  return (
    <nav className={`${p}-pager`} aria-label={label}>
      <button type="button" className={`${p}-pager-btn`} disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
      {pageWindow(page, totalPages).map((n) =>
        typeof n === "string" ? (
          <span key={n} className={`${p}-pager-gap`} aria-hidden="true">…</span>
        ) : (
          <button key={n} type="button" className={`${p}-pager-btn ${n === page ? "is-active" : ""}`}
            aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ),
      )}
      <button type="button" className={`${p}-pager-btn`} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
    </nav>
  );
}
