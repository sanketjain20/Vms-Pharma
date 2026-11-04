import React, { useEffect, useState } from "react";
import "../../Styles/Report/DayEndSummary.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => `₹${Number(n || 0).toFixed(2)}`;
const signed = (n) => (Number(n) < 0 ? `− ₹${Math.abs(Number(n)).toFixed(2)}` : money(n));
const timeOf = (iso) => (iso ? String(iso).slice(11, 16) : "");

/**
 * Day-end summary: money in and out on a day, per payment mode, to match the drawer (Cash) and the UPI / card
 * statements. Bills paid in several modes count under each mode; later collections and refunds are included. Every
 * movement is listed below the totals.
 */
export default function DayEndSummary() {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    apiClient(`${API_BASE_URL}/api/Sales/DayEndSummary?date=${date}`, { method: "GET" })
      .then((r) => r.json())
      .then((json) => {
        if (!live) return;
        if (json?.status === 200 && json.data) setData(json.data);
        else { setData(null); setError(json?.message || "Could not load the day-end summary."); }
      })
      .catch(() => live && setError("Could not load the day-end summary."))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [date]);

  return (
    <div className="i-container dayend">
      <div className="dayend-head">
        <h2 className="i-title">💰 Day-end summary</h2>
        <label className="dayend-date">
          <span>Date</span>
          <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date" />
        </label>
      </div>
      <p className="dayend-note">
        Money in and out on this day, per payment mode — what the cash drawer and the UPI / card statements should show.
        A bill paid in several modes counts under each one.
      </p>

      {error && <div className="dayend-error" role="alert">{error}</div>}
      {loading && !data && <div className="dayend-muted">Loading…</div>}

      {data && (
        <>
          <div className="dayend-cards" data-testid="dayend-modes">
            {data.modes.map((m) => (
              <div className={`dayend-card dayend-card--${String(m.mode).toLowerCase()}`} key={m.mode} data-testid={`dayend-mode-${m.mode}`}>
                <div className="dayend-card-mode">{m.label}</div>
                <div className="dayend-card-total">{signed(m.total)}</div>
                <div className="dayend-card-split">
                  <span>Bills {money(m.bills)}</span>
                  <span>Collected {money(m.collections)}</span>
                  {Number(m.refunds) !== 0 && <span>Refunds {signed(m.refunds)}</span>}
                </div>
              </div>
            ))}
            <div className="dayend-card dayend-card--all" data-testid="dayend-total">
              <div className="dayend-card-mode">All modes</div>
              <div className="dayend-card-total">{signed(data.total)}</div>
              <div className="dayend-card-split"><span>{data.rows.length} movement{data.rows.length === 1 ? "" : "s"}</span></div>
            </div>
          </div>

          <div className="dayend-table-wrap">
            <table className="dayend-table" data-testid="dayend-rows">
              <thead>
                <tr><th>Time</th><th>What</th><th>Bill / document</th><th>Customer</th><th>Mode</th><th>Ref.</th><th className="dayend-amt">Amount</th></tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr><td colSpan={7} className="dayend-muted">No money in or out on this day.</td></tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={i} className={Number(r.amount) < 0 ? "dayend-out" : ""}>
                    <td>{timeOf(r.time)}</td>
                    <td>{r.kind}</td>
                    <td>{r.document}</td>
                    <td>{r.party || "—"}</td>
                    <td>{r.modeLabel}</td>
                    <td>{r.reference || "—"}</td>
                    <td className="dayend-amt">{signed(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
