import React, { useCallback, useEffect, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { monthLabel, targetMonths, targetRow, thisMonth } from "./performanceHelpers";

async function call(path, options = {}) {
  const res = await apiClient(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON error body
  }
  return { ok: json?.status === 200, message: json?.message || (res.ok ? "Done." : "Request failed."), data: json?.data };
}

const asInput = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * Monthly targets for each rep: orders value, collections and check-ins. A blank box means "no target" for that figure.
 * Saving writes every rep's row at once, so what you see is what is stored.
 */
export default function TargetsPanel({ defaultMonth, onSaved }) {
  const months = targetMonths();
  const [month, setMonth] = useState(defaultMonth || thisMonth());
  const [rows, setRows] = useState([]);
  const [inputs, setInputs] = useState({});
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const r = await call(`/api/FieldRep/Targets?month=${encodeURIComponent(month)}`);
    setLoading(false);
    if (!r.ok) {
      setRows([]);
      return setMessage({ text: r.message, tone: "danger" });
    }
    const list = r.data || [];
    setRows(list);
    setInputs(Object.fromEntries(list.map((t) => [t.repUKey, { ordersValue: asInput(t.ordersValue), collections: asInput(t.collections), checkIns: asInput(t.checkIns) }])));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const set = (key, field, value) => setInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const save = async () => {
    const payload = [];
    for (const t of rows) {
      const res = targetRow(t.repUKey, inputs[t.repUKey] || {});
      if (res.problem) return setMessage({ text: `${t.repName}: ${res.problem}`, tone: "danger" });
      payload.push(res.row);
    }
    setSaving(true);
    try {
      const r = await call("/api/FieldRep/Targets", { method: "PUT", body: JSON.stringify({ month, rows: payload }) });
      if (r.ok) {
        await load(); // clears any old message, so say "saved" afterwards
        if (onSaved) onSaved();
      }
      setMessage({ text: r.ok ? `Targets for ${monthLabel(month)} saved.` : r.message, tone: r.ok ? "success" : "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fr-sub" aria-label="Set targets">
      <div className="fr-sub-head">
        <h4 className="fr-sub-title">Set targets</h4>
        <select className="gst-search" aria-label="Target month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {(months.includes(month) ? months : [month, ...months]).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <p className="gst-section-hint">Leave a box empty for no target. Targets are monthly; progress is shown for whole months and the month so far.</p>

      {message && <div className={`gst-alert gst-alert--${message.tone}`}>{message.text}</div>}
      {loading && <p className="gst-section-hint">Loading…</p>}

      {!loading && rows.length === 0 && !message && <p className="gst-section-hint">No field reps yet.</p>}
      {rows.length > 0 && (
        <>
          <div className="gst-table-wrap">
            <table className="gst-table">
              <thead><tr><th>Rep</th><th>Orders value (₹)</th><th>Collections (₹)</th><th>Check-ins</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.repUKey}>
                    <td className="gst-cell-strong">{t.repName}</td>
                    {[["ordersValue", "Orders target"], ["collections", "Collections target"], ["checkIns", "Check-ins target"]].map(([field, label]) => (
                      <td key={field}>
                        <input className="gst-search" style={{ width: 130 }} inputMode="decimal" aria-label={`${label} for ${t.repName}`}
                          value={inputs[t.repUKey]?.[field] ?? ""} onChange={(e) => set(t.repUKey, field, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fr-actions">
            <button className="gst-btn gst-btn--success" disabled={saving} onClick={save}>Save targets</button>
          </div>
        </>
      )}
    </div>
  );
}
