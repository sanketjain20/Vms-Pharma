import React, { useCallback, useEffect, useRef, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { PERIODS, band, buildCsv, delta, deltaPoints, monthLabel, pctText, periodDates, rangeProblem, targetProgress } from "./performanceHelpers";
import TargetsPanel from "./FieldRepTargets";
import FieldPager from "./FieldPager";
import useLocalPaging from "./useLocalPaging";

const ORDER_CONVERSION_HINT = "Orders created ÷ retailers visited";

/** No planned visits means compliance does not apply — show "—", never a 0% that reads as "failed every visit". */
const complianceOf = (row) => (Number(row.plannedVisits) === 0 ? null : row.compliancePercent);

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtClock = (d) => (d ? new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");
const fmtDay = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

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

/** "▲ 12%" / "▼ 8%" / "No change" under a number, coloured by whether the move is good. Nothing when there is nothing to compare. */
function Delta({ d }) {
  if (!d || !d.text) return null;
  return <span className={`fr-delta fr-delta--${d.tone}`}>{d.text}</span>;
}

function Bar({ percent }) {
  return (
    <span className={`fr-bar fr-bar--${band(percent)}`} aria-hidden="true">
      <span style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }} />
    </span>
  );
}

/** One mini bar per target set for the rep (blank = none). */
function TargetCell({ row }) {
  const items = [
    ["Orders", targetProgress(row.ordersValue, row.targetOrdersValue), row.targetOrdersValue, fmtMoney],
    ["Collections", targetProgress(row.collectionsConfirmed, row.targetCollections), row.targetCollections, fmtMoney],
    ["Check-ins", targetProgress(row.totalCheckIns, row.targetCheckIns), row.targetCheckIns, (n) => String(n)],
  ].filter(([, p]) => p !== null);
  if (items.length === 0) return <span className="gst-cell-muted">—</span>;
  return (
    <div className="fr-target-cell">
      {items.map(([label, p, target, fmt]) => (
        <div key={label} className="fr-perf-cell" title={`${label} target ${fmt(target)}`}>
          <Bar percent={p.percent} />
          <span>{label} <strong>{p.percent}%</strong> <span className="gst-cell-muted">of {fmt(target)}</span></span>
        </div>
      ))}
    </div>
  );
}

export default function PerformanceTab() {
  const [period, setPeriod] = useState("LAST7");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [repKey, setRepKey] = useState("");
  const [reps, setReps] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const latest = useRef(0);

  const range = period === "CUSTOM" ? custom : periodDates(period);
  const problem = period === "CUSTOM" ? rangeProblem(custom) : null;

  useEffect(() => {
    call("/api/FieldRep/GetAll").then((r) => { if (r.ok) setReps(r.data || []); });
  }, []);

  const load = useCallback(async () => {
    if (problem || !range.from || !range.to) return;
    const mine = ++latest.current; // ignore a slower, older answer arriving after a newer one
    setLoading(true);
    setError(null);
    const qs = `from=${range.from}&to=${range.to}${repKey ? `&repUKey=${encodeURIComponent(repKey)}` : ""}`;
    const r = await call(`/api/FieldRep/Report?${qs}`);
    if (mine !== latest.current) return;
    setLoading(false);
    if (r.ok) setReport(r.data);
    else { setReport(null); setError(r.message); }
  }, [range.from, range.to, repKey, problem]);

  useEffect(() => { load(); }, [load]);

  const download = () => {
    const blob = new Blob([buildCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rep-performance-${report.from}_to_${report.to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totals = report?.totals;
  const allRows = report?.rows || [];
  const { pageRows: rows, page, setPage, totalPages, total, searchInput, setSearchInput } =
    useLocalPaging(allRows, (r) => r.repName);
  const chosen = reps.find((r) => r.uKey === repKey);
  const prevTotals = report?.previousTotals || null;
  const prevBy = new Map((report?.previousRows || []).map((r) => [r.repUKey, r]));
  const prevLabel = report?.previousFrom ? `${report.previousFrom} → ${report.previousTo}` : "";

  return (
    <section className="gst-section">
      <div className="gst-section-head">
        <h3 className="gst-section-title">How your reps are doing</h3>
        {report && <span className="gst-count">{report.from} → {report.to}</span>}
      </div>

      <div className="fr-tabs" role="group" aria-label="Period">
        {PERIODS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={period === key} className={`fr-tab ${period === key ? "is-active" : ""}`}
            onClick={() => setPeriod(key)}>{label}</button>
        ))}
      </div>

      <div className="fr-inline" style={{ marginBottom: 12 }}>
        {period === "CUSTOM" && (
          <>
            <label className="fr-label" htmlFor="perf-from" style={{ margin: 0 }}>From</label>
            <input id="perf-from" type="date" className="gst-search" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <label className="fr-label" htmlFor="perf-to" style={{ margin: 0 }}>To</label>
            <input id="perf-to" type="date" className="gst-search" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
          </>
        )}
        <select className="gst-search" aria-label="Filter by rep" value={repKey} onChange={(e) => setRepKey(e.target.value)}>
          <option value="">All reps</option>
          {reps.map((r) => <option key={r.uKey} value={r.uKey}>{r.name}</option>)}
        </select>
        <button className="gst-btn gst-btn--sm" disabled={!report || loading} onClick={download}>Download CSV</button>
        <button className="gst-btn gst-btn--sm" aria-expanded={showTargets} onClick={() => setShowTargets((s) => !s)}>{showTargets ? "Hide targets" : "Set targets"}</button>
      </div>

      {showTargets && <TargetsPanel defaultMonth={report?.targetMonth} onSaved={load} />}

      {problem && <div className="gst-alert gst-alert--warning">{problem}</div>}
      {error && <div className="gst-alert gst-alert--danger">{error}</div>}
      {loading && !report && <p className="gst-section-hint">Loading…</p>}

      {report && totals && (
        <>
          <div className="fr-kpis">
            <div className="fr-kpi">
              <div className="fr-kpi-label">Beat compliance</div>
              <div className="fr-kpi-value">{pctText(complianceOf(totals))}</div>
              <div className="fr-kpi-sub">{totals.completedVisits} of {totals.plannedVisits} planned visits done</div>
              {Number(totals.plannedVisits) === 0 && <div className="fr-kpi-sub gst-cell-muted">— means no planned visits, so compliance does not apply.</div>}
              {prevTotals && <div className="fr-kpi-sub"><Delta d={deltaPoints(totals.compliancePercent, prevTotals.compliancePercent)} /> <span className="gst-cell-muted">vs previous period</span></div>}
            </div>
            <div className="fr-kpi">
              <div className="fr-kpi-label">Orders</div>
              <div className="fr-kpi-value">{totals.ordersCount}</div>
              <div className="fr-kpi-sub">{fmtMoney(totals.ordersValue)} (excl. rejected)</div>
              {prevTotals && <div className="fr-kpi-sub"><Delta d={delta(totals.ordersValue, prevTotals.ordersValue)} /> <span className="gst-cell-muted">vs {fmtMoney(prevTotals.ordersValue)}</span></div>}
            </div>
            <div className="fr-kpi">
              <div className="fr-kpi-label">Collected</div>
              <div className="fr-kpi-value">{fmtMoney(totals.collectionsConfirmed)}</div>
              <div className="fr-kpi-sub">{fmtMoney(totals.collectionsAwaiting)} awaiting your review</div>
              {prevTotals && <div className="fr-kpi-sub"><Delta d={delta(totals.collectionsConfirmed, prevTotals.collectionsConfirmed)} /> <span className="gst-cell-muted">vs {fmtMoney(prevTotals.collectionsConfirmed)}</span></div>}
            </div>
            <div className="fr-kpi">
              <div className="fr-kpi-label">Check-ins</div>
              <div className="fr-kpi-value">{totals.totalCheckIns}</div>
              <div className="fr-kpi-sub">{totals.unplannedVisits} unplanned stops</div>
              {prevTotals && <div className="fr-kpi-sub"><Delta d={delta(totals.totalCheckIns, prevTotals.totalCheckIns)} /> <span className="gst-cell-muted">vs {prevTotals.totalCheckIns}</span></div>}
            </div>
          </div>

          {prevTotals && <p className="gst-section-hint" data-testid="prev-note">Compared with the previous period, {prevLabel}.</p>}

          <div className="fr-search-row">
            <input className="gst-search" type="search" placeholder="Search rep…" aria-label="Search reps"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            <span className="gst-count">{total} rep{total === 1 ? "" : "s"}</span>
          </div>

          <div className="gst-table-wrap">
            <table className="gst-table">
              <thead>
                <tr>
                  <th>Rep</th><th>Beat compliance</th><th>Missed</th><th>Check-ins</th><th>Orders</th><th>Order value</th>
                  <th>Approved</th><th title={ORDER_CONVERSION_HINT}>Order Conversion</th><th>Collected</th>{report.targetMonth && <th>Targets · {monthLabel(report.targetMonth)}</th>}<th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.repUKey}>
                    <td className="gst-cell-strong">{r.repName}{r.disabled && <span className="gst-badge gst-badge--slate" style={{ marginLeft: 8 }}>Disabled</span>}</td>
                    <td>
                      <div className="fr-perf-cell">
                        <Bar percent={complianceOf(r)} />
                        <span>
                          <strong>{pctText(complianceOf(r))}</strong>{" "}
                          <span className="gst-cell-muted">{Number(r.plannedVisits) === 0 ? "0 of 0 planned visits done" : `${r.completedVisits}/${r.plannedVisits}`}</span>
                        </span>
                      </div>
                      {prevBy.has(r.repUKey) && <Delta d={deltaPoints(r.compliancePercent, prevBy.get(r.repUKey).compliancePercent)} />}
                      {r.flexibleRetailers > 0 && <div className="gst-cell-muted">+ {r.flexibleVisited}/{r.flexibleRetailers} any-day retailers visited</div>}
                    </td>
                    <td className={r.missedVisits > 0 ? "fr-short" : ""}>{r.missedVisits}</td>
                    <td>{r.totalCheckIns}{r.unplannedVisits > 0 && <span className="gst-cell-muted"> ({r.unplannedVisits} unplanned)</span>}</td>
                    <td>{r.ordersCount}</td>
                    <td>{fmtMoney(r.ordersValue)}{prevBy.has(r.repUKey) && <div><Delta d={delta(r.ordersValue, prevBy.get(r.repUKey).ordersValue)} /></div>}</td>
                    <td>{pctText(r.approvalPercent)}</td>
                    <td title={ORDER_CONVERSION_HINT}>{pctText(r.strikeRatePercent)}</td>
                    <td>{fmtMoney(r.collectionsConfirmed)}{r.collectionsAwaiting > 0 && <span className="gst-cell-muted"> + {fmtMoney(r.collectionsAwaiting)} pending</span>}{prevBy.has(r.repUKey) && <div><Delta d={delta(r.collectionsConfirmed, prevBy.get(r.repUKey).collectionsConfirmed)} /></div>}</td>
                    {report.targetMonth && <td><TargetCell row={r} /></td>}
                    <td className="gst-actions">
                      <button className="gst-btn gst-btn--sm" onClick={() => setRepKey(r.repUKey)} aria-label={`Day by day for ${r.repName}`}>Day by day</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={report.targetMonth ? 11 : 10} className="gst-empty">{searchInput ? "No reps match your search." : "No rep activity in this period."}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <FieldPager page={page} totalPages={totalPages} onChange={setPage} label="Rep performance pages" />

          {report.days && (
            <div className="fr-sub">
              <div className="fr-sub-head">
                <h4 className="fr-sub-title">Day by day — {chosen?.name || allRows[0]?.repName}</h4>
                <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={() => setRepKey("")}>Back to all reps</button>
              </div>
              <div className="gst-table-wrap">
                <table className="gst-table">
                  <thead>
                    <tr><th>Day</th><th>Planned</th><th>Visited</th><th>Missed</th><th>Unplanned stops</th><th>Orders</th><th>Order value</th><th>Collected</th><th>First – last check-in</th></tr>
                  </thead>
                  <tbody>
                    {report.days.map((d) => (
                      <tr key={d.date} className={d.missed.length > 0 ? "fr-conflict-row" : ""}>
                        <td className="gst-cell-strong">{fmtDay(d.date)}</td>
                        <td>{d.planned}</td>
                        <td>{d.visited}</td>
                        <td>{d.missed.length > 0 ? d.missed.join(", ") : "—"}</td>
                        <td>{d.unplanned}</td>
                        <td>{d.orders}</td>
                        <td>{fmtMoney(d.ordersValue)}</td>
                        <td>{fmtMoney(d.collected)}</td>
                        <td className="gst-cell-muted">{d.firstCheckIn ? `${fmtClock(d.firstCheckIn)} – ${fmtClock(d.lastCheckIn)}` : "No check-ins"}</td>
                      </tr>
                    ))}
                    {report.days.length === 0 && (
                      <tr><td colSpan={9} className="gst-empty">No days to show yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <details className="fr-help">
            <summary>How these numbers are worked out</summary>
            <ul>
              <li><strong>Planned visit</strong> — a retailer on the rep's beat with a fixed weekday, on each such weekday up to today. The beat is judged as it was on each day: a retailer added, moved or removed only counts from the following day, so changing a beat never rewrites last month. A disabled rep is not held to a beat.</li>
              <li><strong>Any-day retailers</strong> have no schedule, so they are never counted as missed; the report shows how many of them the rep visited at all in the period.</li>
              <li><strong>Previous period</strong> — the same number of days immediately before the one you chose; the arrows show the change, coloured green when it is good news. <strong>Targets</strong> appear when you view a whole month or the month so far.</li>
              <li><strong>Beat compliance</strong> — planned retailer-days where the rep checked in at that retailer that day. Shown as — (with "0 of 0 planned visits done") when there were no planned visits, because there is nothing to measure.</li>
              <li><strong>Unplanned stops</strong> — check-ins that match no planned retailer-day (including stops with no retailer). A second visit to a planned retailer on the same day is not unplanned.</li>
              <li><strong>Order Conversion</strong> — orders created ÷ retailers visited: of the retailer-days the rep checked in at, the share where they also took an order.</li>
              <li><strong>Approved</strong> — of orders you have decided, the share approved (approved or invoiced). Orders still awaiting review are not counted against the rep.</li>
              <li><strong>Order value</strong> excludes rejected orders. <strong>Collected</strong> counts confirmed payments; pending ones are shown separately; rejected ones are ignored.</li>
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
