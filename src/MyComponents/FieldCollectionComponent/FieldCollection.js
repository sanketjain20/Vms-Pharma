import React, { useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Inventory.css";
import "../../Styles/DynamicGrid.css";
import "../../Styles/GstShared/GstListPage.css";
import "../../Styles/FieldRep/FieldRep.css";
import FieldHandovers from "./FieldHandovers";
import FieldPager from "../FieldRepComponent/FieldPager";
import useFieldList from "../FieldRepComponent/useFieldList";
import useModuleActions from "../../utils/useModuleActions";

export const FIELD_COLLECTION_MODULE_ID = 33;

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "SUBMITTED", label: "Awaiting review" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_TONE = { SUBMITTED: "warning", CONFIRMED: "success", REJECTED: "danger" };
const STATUS_LABEL = { SUBMITTED: "Awaiting review", CONFIRMED: "Confirmed", REJECTED: "Rejected" };
const MODE_LABEL = { CASH: "Cash", UPI: "UPI", CHEQUE: "Cheque", CARD: "Card" };

const fmtMoney = (n) => (n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");

async function call(path, options = {}) {
  const res = await apiClient(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // a non-JSON error body — fall through to the generic message
  }
  return {
    ok: json?.status === 200,
    message: json?.message || (res.ok ? "Done." : "Request failed."),
    data: json?.data,
  };
}

export default function FieldCollection() {
  const [status, setStatus] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [message, setMessage] = useState(null);
  const [section, setSection] = useState("payments");
  const { can } = useModuleActions(FIELD_COLLECTION_MODULE_ID);
  // "Edit" on this module is the Confirm / Reject permission — without it there is nothing to review.
  const canReview = can("Edit");

  const { rows, page, setPage, totalPages, totalElements, searchInput, setSearchInput, error, reload: load } =
    useFieldList("/api/FieldCollection/GetAllPaged", status);

  const selected = canReview ? rows.find((c) => c.uKey === selectedKey) || null : null;
  const awaiting = rows.filter((c) => c.status === "SUBMITTED");
  const awaitingTotal = awaiting.reduce((s, c) => s + Number(c.amount || 0), 0);

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M6.5 9.5v.01M17.5 14.5v.01" />
        </svg>
        Field Collections
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">
          <div className="fr-tabs" role="tablist" aria-label="Field collections sections">
            <button role="tab" aria-selected={section === "payments"} className={`fr-tab ${section === "payments" ? "is-active" : ""}`} onClick={() => setSection("payments")}>Payments</button>
            <button role="tab" aria-selected={section === "handovers"} className={`fr-tab ${section === "handovers" ? "is-active" : ""}`} onClick={() => setSection("handovers")}>Cash handovers</button>
          </div>

          {section === "handovers" && <FieldHandovers canReview={canReview} />}

          {section === "payments" && <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">Payments collected by your field reps</h3>
              <span className="gst-count">{totalElements} collection{totalElements === 1 ? "" : "s"}</span>
            </div>
            <p className="gst-section-hint">
              A rep's collection is only a claim until you confirm it. Confirming records a real payment against the retailer; rejecting leaves the books untouched.
              {awaiting.length > 0 && status !== "CONFIRMED" && status !== "REJECTED" && (
                <> <strong>{awaiting.length} awaiting review on this page ({fmtMoney(awaitingTotal)}).</strong></>
              )}
            </p>

            <div className="fr-tabs" role="tablist">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key || "all"} role="tab" aria-selected={status === f.key} className={`fr-tab ${status === f.key ? "is-active" : ""}`}
                  onClick={() => { setStatus(f.key); setSelectedKey(null); }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="fr-search-row">
              <input className="gst-search" type="search" placeholder="Search rep, retailer, reference or invoice…" aria-label="Search field collections"
                value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setSelectedKey(null); }} />
            </div>

            {message && <div className={`gst-alert gst-alert--${message.tone}`}>{message.text}</div>}
            {error && <div className="gst-alert gst-alert--danger">{error}</div>}

            <div className="gst-table-wrap">
              <table className="gst-table">
                <thead>
                  <tr><th>Collected</th><th>Rep</th><th>Retailer</th><th>Amount</th><th>Mode</th><th>Against</th><th>Owes now</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.uKey} className={`${canReview ? "fr-clickable" : ""} ${selectedKey === c.uKey ? "fr-row-selected" : ""}`} onClick={() => canReview && setSelectedKey(c.uKey)}>
                      <td className="gst-cell-muted">{fmtDateTime(c.collectedAt)}</td>
                      <td className="gst-cell-strong">{c.repName}</td>
                      <td>{c.retailerName}</td>
                      <td className="gst-cell-strong">{fmtMoney(c.amount)}</td>
                      <td>{MODE_LABEL[c.paymentMode] || c.paymentMode}{c.referenceNumber ? ` · ${c.referenceNumber}` : ""}</td>
                      <td>{c.invoiceNumber ? `Invoice ${c.invoiceNumber}` : <span className="gst-cell-muted">Account</span>}</td>
                      <td className="gst-cell-muted">{fmtMoney(c.retailerOutstanding)}</td>
                      <td><span className={`gst-badge gst-badge--${STATUS_TONE[c.status] || "slate"}`}>{STATUS_LABEL[c.status] || c.status}</span></td>
                      <td className="gst-actions">
                        {canReview && (
                          <button className="gst-btn gst-btn--sm" onClick={(e) => { e.stopPropagation(); setSelectedKey(c.uKey); }}>Review</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={9} className="gst-empty">No collections found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <FieldPager page={page} totalPages={totalPages} onChange={(p) => { setPage(p); setSelectedKey(null); }} label="Field collections pages" />

            {selected && (
              <CollectionDetail
                key={selected.uKey}
                row={selected}
                onClose={() => setSelectedKey(null)}
                onChanged={async (text, ok) => {
                  setMessage({ text, tone: ok ? "success" : "danger" });
                  await load();
                }}
              />
            )}
          </section>}
        </div>
      </div>
    </div>
  );
}

function CollectionDetail({ row, onClose, onChanged }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = row.status === "SUBMITTED";

  const owes = Number(row.retailerOutstanding || 0);
  const amount = Number(row.amount || 0);
  // collectPayment banks anything above the balance as an advance — say so before the office clicks.
  const excess = pending && amount > owes ? amount - owes : 0;

  const run = async (path, options, okText) => {
    setBusy(true);
    try {
      const r = await call(path, options);
      await onChanged(r.ok ? okText || r.message : r.message, r.ok);
      return r.ok;
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => run(`/api/FieldCollection/Confirm/${row.uKey}`, { method: "PUT" }, "Payment confirmed and recorded.");

  const reject = async () => {
    if (!reason.trim()) return;
    const ok = await run(`/api/FieldCollection/Reject/${row.uKey}`, { method: "PUT", body: JSON.stringify({ reason }) }, "Collection rejected.");
    if (ok) setShowReject(false);
  };

  return (
    <div className="fr-sub">
      <div className="fr-sub-head">
        <h4 className="fr-sub-title">{fmtMoney(row.amount)} from {row.retailerName}</h4>
        <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={onClose}>Close</button>
      </div>

      <dl className="fr-detail-meta">
        <div><dt>Collected by</dt><dd>{row.repName}</dd></div>
        <div><dt>Taken</dt><dd>{fmtDateTime(row.collectedAt)}</dd></div>
        <div><dt>Mode</dt><dd>{MODE_LABEL[row.paymentMode] || row.paymentMode}</dd></div>
        {row.referenceNumber && <div><dt>Reference</dt><dd>{row.referenceNumber}</dd></div>}
        <div><dt>Against</dt><dd>{row.invoiceNumber ? `Invoice ${row.invoiceNumber}` : "Account balance"}</dd></div>
        {row.paymentMode === "CASH" && <div><dt>Cash handed in</dt><dd>{row.handedOver ? "Yes" : "Not yet"}</dd></div>}
        <div><dt>Retailer owes now</dt><dd>{fmtMoney(owes)}</dd></div>
        <div><dt>Status</dt><dd>{STATUS_LABEL[row.status] || row.status}</dd></div>
        {row.note && <div><dt>Rep's note</dt><dd>{row.note}</dd></div>}
        {row.rejectReason && <div><dt>Rejected because</dt><dd>{row.rejectReason}</dd></div>}
      </dl>

      {excess > 0 && (
        <div className="gst-alert gst-alert--warning">
          This is {fmtMoney(excess)} more than {row.retailerName} currently owes ({fmtMoney(owes)}). If you confirm, the extra {fmtMoney(excess)} is kept as an advance payment on their account.
        </div>
      )}

      {pending && (
        <div className="fr-actions">
          <button className="gst-btn gst-btn--success" disabled={busy} onClick={confirm}>Confirm payment</button>
          {!showReject && (
            <button className="gst-btn gst-btn--danger" disabled={busy} onClick={() => setShowReject(true)}>Reject</button>
          )}
        </div>
      )}

      {showReject && (
        <div className="fr-inline" style={{ marginTop: 12 }}>
          <input className="gst-search" style={{ minWidth: 280 }} placeholder="Reason for rejecting (required)" aria-label="Rejection reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="gst-btn gst-btn--danger" disabled={busy || !reason.trim()} onClick={reject}>Confirm reject</button>
          <button className="gst-btn gst-btn--ghost" onClick={() => setShowReject(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
