import React, { useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import FieldPager from "../FieldRepComponent/FieldPager";
import useFieldList from "../FieldRepComponent/useFieldList";

const FILTERS = [
  { key: "", label: "All" },
  { key: "SUBMITTED", label: "Awaiting you" },
  { key: "RECEIVED", label: "Received" },
  { key: "FLAGGED", label: "Flagged" },
];
const TONE = { SUBMITTED: "warning", RECEIVED: "success", FLAGGED: "danger" };
const LABEL = { SUBMITTED: "Awaiting you", RECEIVED: "Received", FLAGGED: "Flagged" };

const fmtMoney = (n) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");

/** Short for tables: "Matches", "Short ₹100.00", "Extra ₹50.00". */
export const diffText = (d) => {
  const n = Number(d || 0);
  return n === 0 ? "Matches" : n < 0 ? `Short ${fmtMoney(-n)}` : `Extra ${fmtMoney(n)}`;
};

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

/** The cash each rep says they handed in at day-close. Receiving it says you have the cash; flagging says something is off. */
export default function FieldHandovers({ canReview = false }) {
  const [status, setStatus] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [message, setMessage] = useState(null);

  const { rows, page, setPage, totalPages, totalElements, searchInput, setSearchInput, error, reload: load } =
    useFieldList("/api/FieldHandover/GetAllPaged", status);

  const selected = canReview ? rows.find((h) => h.uKey === selectedKey) || null : null;
  const awaiting = rows.filter((h) => h.status === "SUBMITTED");
  const awaitingCash = awaiting.reduce((s, h) => s + Number(h.cashCounted || 0), 0);

  return (
    <section className="gst-section">
      <div className="gst-section-head">
        <h3 className="gst-section-title">Cash handed in by your field reps</h3>
        <span className="gst-count">{totalElements} day-close{totalElements === 1 ? "" : "s"}</span>
      </div>
      <p className="gst-section-hint">
        At the end of the day a rep counts the cash they collected and hands it in. Mark it <strong>received</strong> once you have the cash, or <strong>flag</strong> it if the amount is wrong.
        {awaiting.length > 0 && !status && <> <strong>{awaiting.length} awaiting you on this page ({fmtMoney(awaitingCash)}).</strong></>}
      </p>

      <div className="fr-tabs" role="group" aria-label="Filter cash handovers">
        {FILTERS.map((f) => (
          <button key={f.key || "all"} type="button" aria-pressed={status === f.key} className={`fr-tab ${status === f.key ? "is-active" : ""}`}
            onClick={() => { setStatus(f.key); setSelectedKey(null); }}>{f.label}</button>
        ))}
      </div>

      <div className="fr-search-row">
        <input className="gst-search" type="search" placeholder="Search rep or note…" aria-label="Search cash handovers"
          value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setSelectedKey(null); }} />
      </div>

      {message && <div className={`gst-alert gst-alert--${message.tone}`}>{message.text}</div>}
      {error && <div className="gst-alert gst-alert--danger">{error}</div>}

      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead><tr><th>Closed</th><th>Rep</th><th>Cash recorded</th><th>Cash handed in</th><th>Difference</th><th>Collections</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.uKey} className={`${canReview ? "fr-clickable" : ""} ${selectedKey === h.uKey ? "fr-row-selected" : ""}`} onClick={() => canReview && setSelectedKey(h.uKey)}>
                <td className="gst-cell-muted">{fmtDateTime(h.closedAt)}</td>
                <td className="gst-cell-strong">{h.repName}</td>
                <td>{fmtMoney(h.expectedCash)}</td>
                <td className="gst-cell-strong">{fmtMoney(h.cashCounted)}</td>
                <td className={Number(h.difference) < 0 ? "fr-short" : ""}>{diffText(h.difference)}</td>
                <td>{h.collectionsCount}</td>
                <td><span className={`gst-badge gst-badge--${TONE[h.status] || "slate"}`}>{LABEL[h.status] || h.status}</span></td>
                <td className="gst-actions">
                  {canReview && (
                    <button className="gst-btn gst-btn--sm" onClick={(e) => { e.stopPropagation(); setSelectedKey(h.uKey); }}>Review</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="gst-empty">No cash handovers found.</td></tr>}
          </tbody>
        </table>
      </div>

      <FieldPager page={page} totalPages={totalPages} onChange={(p) => { setPage(p); setSelectedKey(null); }} label="Cash handovers pages" />

      {selected && (
        <HandoverDetail
          key={selected.uKey}
          row={selected}
          onClose={() => setSelectedKey(null)}
          onChanged={async (text, ok) => {
            setMessage({ text, tone: ok ? "success" : "danger" });
            await load();
          }}
        />
      )}
    </section>
  );
}

function HandoverDetail({ row, onClose, onChanged }) {
  const [showFlag, setShowFlag] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = row.status === "SUBMITTED";
  const short = Number(row.difference) < 0;

  const run = async (path, body, okText) => {
    setBusy(true);
    try {
      const r = await call(path, { method: "PUT", body: JSON.stringify(body) });
      await onChanged(r.ok ? okText : r.message, r.ok);
      return r.ok;
    } finally {
      setBusy(false);
    }
  };

  const receive = () => run(`/api/FieldHandover/Receive/${row.uKey}`, {}, "Marked as received.");
  const flag = async () => {
    if (!reason.trim()) return;
    if (await run(`/api/FieldHandover/Flag/${row.uKey}`, { note: reason }, "Flagged.")) setShowFlag(false);
  };

  return (
    <div className="fr-sub">
      <div className="fr-sub-head">
        <h4 className="fr-sub-title">{fmtMoney(row.cashCounted)} from {row.repName}</h4>
        <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={onClose}>Close</button>
      </div>

      <dl className="fr-detail-meta">
        <div><dt>Closed</dt><dd>{fmtDateTime(row.closedAt)}</dd></div>
        <div><dt>Cash recorded</dt><dd>{fmtMoney(row.expectedCash)}</dd></div>
        <div><dt>Cash handed in</dt><dd>{fmtMoney(row.cashCounted)}</dd></div>
        <div><dt>Difference</dt><dd>{diffText(row.difference)}</dd></div>
        <div><dt>Status</dt><dd>{LABEL[row.status] || row.status}</dd></div>
        {row.note && <div><dt>Rep's note</dt><dd>{row.note}</dd></div>}
        {row.officeNote && <div><dt>Your note</dt><dd>{row.officeNote}</dd></div>}
      </dl>

      {short && pending && (
        <div className="gst-alert gst-alert--warning">
          {row.repName} handed in {fmtMoney(-Number(row.difference))} less than they recorded collecting. Check the cash before you mark it received.
        </div>
      )}

      <div className="gst-table-wrap">
        <table className="gst-table" aria-label="Collections in this handover">
          <thead><tr><th>Retailer</th><th>Collected</th><th>Amount</th></tr></thead>
          <tbody>
            {(row.items || []).map((i, idx) => (
              <tr key={idx}><td>{i.retailerName}</td><td className="gst-cell-muted">{fmtDateTime(i.collectedAt)}</td><td>{fmtMoney(i.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {pending && (
        <div className="fr-actions">
          <button className="gst-btn gst-btn--success" disabled={busy} onClick={receive}>Mark received</button>
          {!showFlag && <button className="gst-btn gst-btn--danger" disabled={busy} onClick={() => setShowFlag(true)}>Flag a problem</button>}
        </div>
      )}

      {showFlag && (
        <div className="fr-inline" style={{ marginTop: 12 }}>
          <input className="gst-search" style={{ minWidth: 280 }} placeholder="What is wrong? (required)" aria-label="Flag reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="gst-btn gst-btn--danger" disabled={busy || !reason.trim()} onClick={flag}>Confirm flag</button>
          <button className="gst-btn gst-btn--ghost" onClick={() => setShowFlag(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
