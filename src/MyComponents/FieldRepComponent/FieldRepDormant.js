import React, { useCallback, useEffect, useRef, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import FieldPager from "./FieldPager";
import useLocalPaging from "./useLocalPaging";

const WINDOWS = [7, 14, 30, 60, 90];
const EMPTY = [];
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

async function call(path) {
  const res = await apiClient(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json" } });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON error body
  }
  return { ok: json?.status === 200, message: json?.message || (res.ok ? "Done." : "Request failed."), data: json?.data };
}

/** Retailers on a beat that no rep has checked in at for N days (or ever) — the ones going cold. */
export default function DormantTab() {
  const [days, setDays] = useState(14);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current; // ignore an older, slower answer
    setLoading(true);
    setError(null);
    const r = await call(`/api/FieldRep/Dormant?days=${days}`);
    if (mine !== latest.current) return;
    setLoading(false);
    if (r.ok) setRows(r.data || []);
    else { setRows(null); setError(r.message); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const never = (rows || []).filter((r) => r.neverVisited).length;
  const { pageRows, page, setPage, totalPages, total, searchInput, setSearchInput } = useLocalPaging(
    rows || EMPTY, (r) => `${r.retailerName} ${r.retailerCode || ""} ${(r.repNames || []).join(" ")} ${r.phone || ""}`);

  return (
    <section className="gst-section">
      <div className="gst-section-head">
        <h3 className="gst-section-title">Retailers not visited lately</h3>
        {rows && <span className="gst-count">{rows.length} retailer{rows.length === 1 ? "" : "s"}</span>}
      </div>
      <p className="gst-section-hint">
        Retailers on a rep's beat with no check-in for the chosen number of days. The longest-neglected come first.
        {rows && never > 0 && <> <strong>{never} never visited.</strong></>}
      </p>

      <div className="fr-tabs" role="group" aria-label="Not visited for">
        {WINDOWS.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} className={`fr-tab ${days === d ? "is-active" : ""}`} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>

      {error && <div className="gst-alert gst-alert--danger">{error}</div>}
      {loading && !rows && <p className="gst-section-hint">Loading…</p>}

      {rows && (
        <div className="fr-search-row">
          <input className="gst-search" type="search" placeholder="Search retailer, rep or phone…" aria-label="Search retailers not visited"
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      )}

      {rows && (
        <div className="gst-table-wrap">
          <table className="gst-table">
            <thead><tr><th>Retailer</th><th>Rep</th><th>Last visit</th><th>Not visited for</th><th>Owes</th><th>Phone</th></tr></thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.retailerId} className={r.neverVisited ? "fr-conflict-row" : ""}>
                  <td className="gst-cell-strong">{r.retailerName}{r.retailerCode ? <span className="gst-cell-muted"> · {r.retailerCode}</span> : null}</td>
                  <td>{(r.repNames || []).join(", ") || "—"}</td>
                  <td className="gst-cell-muted">{r.neverVisited ? "Never" : fmtDate(r.lastVisitAt)}</td>
                  <td>{r.neverVisited ? <>Never visited <span className="gst-cell-muted">(on beat {r.daysSince} days)</span></> : `${r.daysSince} days`}</td>
                  <td>{r.outstanding > 0 ? fmtMoney(r.outstanding) : "—"}</td>
                  <td>{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="gst-empty">Every retailer on a beat was visited in the last {days} days.</td></tr>
              )}
              {rows.length > 0 && total === 0 && (
                <tr><td colSpan={6} className="gst-empty">No retailers match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {rows && <FieldPager page={page} totalPages={totalPages} onChange={setPage} label="Not visited pages" />}
    </section>
  );
}
