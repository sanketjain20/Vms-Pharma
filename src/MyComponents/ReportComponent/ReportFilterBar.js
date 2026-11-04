import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../../Styles/Report/ReportFilterBar.css";
import { toFilterKey, useReportFilters } from "./reportFilters";

const clean = (filters) =>
  Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ""));

const same = (a, b) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

/** How many filters are set (for the badge on the filter button). */
export const activeFilterCount = (filters) => Object.keys(clean(filters)).length;

/** The funnel button that sits beside Export Excel and opens the filter panel. */
export function ReportFilterButton({ count, onClick }) {
  return (
    <button type="button" className="rfd-trigger" onClick={onClick} title="Filters" aria-label="Filters" data-testid="report-filter-button">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M2 3h12l-4.5 5.5V13l-3 1.5V8.5L2 3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      {count > 0 && <span className="rfd-dot">{count}</span>}
    </button>
  );
}

/**
 * The report's filters in a side panel on its result page, filled in with the ones it was run with. Apply (or Enter)
 * re-runs the report in place and closes the panel, so there is no need to go back to the filter page.
 *
 * @param applied  the filters the report is currently showing ({ fromDate: "2026-10-01", ... })
 * @param onApply  called with the new filters (blank ones left out)
 */
export default function ReportFilterPanel({ moduleId, open, applied, onApply, onClose }) {
  const { filters, filterOptions, loading } = useReportFilters(moduleId);
  const [draft, setDraft] = useState(() => clean(applied));

  // every time it opens, it starts from what the report is showing
  useEffect(() => { if (open) setDraft(clean(applied)); }, [open, applied]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const changed = useMemo(() => !same(draft, applied), [draft, applied]);
  if (!open) return null;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  const submit = (e) => {
    e.preventDefault();
    if (changed) onApply(clean(draft));
    onClose();
  };

  return createPortal(
    <div className="rfd" data-testid="report-filter-panel">
      <div className="rfd-scrim" onMouseDown={onClose} />
      <form className="rfd-sheet" onSubmit={submit} role="dialog" aria-label="Filters">
        <div className="rfd-top">
          <div>
            <div className="rfd-kicker">Report filters</div>
            <h2 className="rfd-heading">Refine this report</h2>
          </div>
          <button type="button" className="rfd-close" onClick={onClose} aria-label="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="rfd-body">
          {loading ? (
            <span className="rfd-note">Loading filters…</span>
          ) : filters.length === 0 ? (
            <span className="rfd-note">This report has no filters.</span>
          ) : (
            filters.map((name) => {
              const key = toFilterKey(name);
              const options = filterOptions[key];
              const isDate = name.toLowerCase().includes("date");
              const id = `rfd-${key}`;
              return (
                <div key={key} className={`rfd-field ${draft[key] ? "is-set" : ""}`}>
                  <label className="rfd-cap" htmlFor={id}>{name}</label>
                  {options ? (
                    <select id={id} className="rfd-in" value={draft[key] || ""} onChange={(e) => set(key, e.target.value)}>
                      <option value="">All</option>
                      {options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      id={id}
                      className="rfd-in"
                      type={isDate ? "date" : "text"}
                      value={draft[key] || ""}
                      onChange={(e) => set(key, e.target.value)}
                      placeholder={isDate ? "" : `Any ${name.toLowerCase()}`}
                      autoComplete="off"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="rfd-foot">
          <button type="button" className="rfd-clear" onClick={() => setDraft({})} disabled={activeFilterCount(draft) === 0}>
            Clear all
          </button>
          <button type="submit" className="rfd-apply-primary" disabled={!changed}>
            Apply filters
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
