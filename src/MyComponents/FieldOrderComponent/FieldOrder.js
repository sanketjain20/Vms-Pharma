import React, { useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import "../../Styles/Inventory.css";
import "../../Styles/DynamicGrid.css";
import "../../Styles/GstShared/GstListPage.css";
import "../../Styles/FieldRep/FieldRep.css";
import FieldPager from "../FieldRepComponent/FieldPager";
import useFieldList from "../FieldRepComponent/useFieldList";
import useModuleActions from "../../utils/useModuleActions";

const FIELD_ORDER_MODULE_ID = 32;

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "SUBMITTED", label: "Awaiting review" },
  { key: "APPROVED", label: "Approved" },
  { key: "CONVERTED", label: "Converted" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_TONE = { SUBMITTED: "warning", APPROVED: "accent", CONVERTED: "success", REJECTED: "danger" };
const STATUS_LABEL = { SUBMITTED: "Awaiting review", APPROVED: "Approved", CONVERTED: "Converted", REJECTED: "Rejected" };

const CONFLICT_LABEL = {
  PRICE_CHANGED: "Price changed",
  STOCK_SHORT: "Not enough stock",
  PRODUCT_UNAVAILABLE: "Product unavailable",
};

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

export default function FieldOrder() {
  const [status, setStatus] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [message, setMessage] = useState(null);
  const { can } = useModuleActions(FIELD_ORDER_MODULE_ID);
  // "Edit" on this module is the Approve / Reject permission, "Add" is Convert to Sale — together they are the review.
  const canReview = can("Edit") || can("Add");

  const { rows: orders, page, setPage, totalPages, totalElements, searchInput, setSearchInput, error, reload: load } =
    useFieldList("/api/FieldOrder/GetAllPaged", status);

  const selected = canReview ? orders.find((o) => o.uKey === selectedKey) || null : null;

  return (
    <div className="i-container">
      <h2 className="i-title">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3h9l4 4v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" />
          <path d="M14 3v5h5" />
          <path d="M8.5 13l2 2 4-4.5" />
        </svg>
        Field Orders
      </h2>

      <div className="dg-panel gst-panel">
        <div className="dg-panel-body gst-body">
          <section className="gst-section">
            <div className="gst-section-head">
              <h3 className="gst-section-title">Orders taken by your field reps</h3>
              <span className="gst-count">{totalElements} order{totalElements === 1 ? "" : "s"}</span>
            </div>

            <div className="fr-tabs" role="tablist">
              {STATUS_FILTERS.map((f) => (
                <button key={f.key || "all"} role="tab" aria-selected={status === f.key} className={`fr-tab ${status === f.key ? "is-active" : ""}`}
                  onClick={() => { setStatus(f.key); setSelectedKey(null); }}>
                  {f.label}
                </button>
              ))}
            </div>

            <div className="fr-search-row">
              <input className="gst-search" type="search" placeholder="Search order no., rep or retailer…" aria-label="Search field orders"
                value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setSelectedKey(null); }} />
            </div>

            {message && <div className={`gst-alert gst-alert--${message.tone}`}>{message.text}</div>}
            {error && <div className="gst-alert gst-alert--danger">{error}</div>}

            <div className="gst-table-wrap">
              <table className="gst-table">
                <thead>
                  <tr><th>Order</th><th>Rep</th><th>Retailer</th><th>Total</th><th>Taken</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.uKey} className={`${canReview ? "fr-clickable" : ""} ${selectedKey === o.uKey ? "fr-row-selected" : ""}`} onClick={() => canReview && setSelectedKey(o.uKey)}>
                      <td className="gst-cell-mono">{o.orderNumber}</td>
                      <td className="gst-cell-strong">{o.repName}</td>
                      <td>{o.retailerName}</td>
                      <td>{fmtMoney(o.totalAmount)}</td>
                      <td className="gst-cell-muted">{fmtDateTime(o.capturedAt)}</td>
                      <td>
                        <span className={`gst-badge gst-badge--${STATUS_TONE[o.status] || "slate"}`}>{STATUS_LABEL[o.status] || o.status}</span>{" "}
                        {o.hasConflict && o.status === "SUBMITTED" && <span className="gst-badge gst-badge--warning">Needs a look</span>}
                      </td>
                      <td className="gst-actions">
                        {canReview && (
                          <button className="gst-btn gst-btn--sm" onClick={(e) => { e.stopPropagation(); setSelectedKey(o.uKey); }}>Review</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr><td colSpan={7} className="gst-empty">No field orders found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <FieldPager page={page} totalPages={totalPages} onChange={(p) => { setPage(p); setSelectedKey(null); }} label="Field orders pages" />

            {selected && (
              <OrderDetail
                key={selected.uKey}
                order={selected}
                onClose={() => setSelectedKey(null)}
                canDecide={can("Edit")}
                canConvert={can("Add")}
                onChanged={async (text, ok) => {
                  setMessage({ text, tone: ok ? "success" : "danger" });
                  await load();
                }}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose, onChanged, canDecide, canConvert }) {
  const editable = order.status === "SUBMITTED" && canDecide;
  const [qty, setQty] = useState(() => Object.fromEntries(order.items.map((i) => [i.id, i.quantity])));
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  // Field orders convert to CREDIT sales (nothing paid yet — the chemist pays
  // later via Payment Collection), so there is no payment type / billing mode
  // to choose here; the server applies those defaults.
  const [convert, setConvert] = useState({ gstRate: "18", dueDate: "" });
  const [busy, setBusy] = useState(false);

  const run = async (path, options, successText) => {
    setBusy(true);
    try {
      const r = await call(path, options);
      await onChanged(r.ok ? successText || r.message : r.message, r.ok);
      return r.ok;
    } finally {
      setBusy(false);
    }
  };

  const approve = () => {
    const adjustments = order.items
      .filter((i) => Number(qty[i.id]) !== i.quantity)
      .map((i) => ({ itemId: i.id, quantity: Number(qty[i.id]) }));
    return run(`/api/FieldOrder/Approve/${order.uKey}`, { method: "PUT", body: JSON.stringify({ adjustments }) }, "Order approved.");
  };

  const reject = async () => {
    if (!reason.trim()) return;
    const ok = await run(`/api/FieldOrder/Reject/${order.uKey}`, { method: "PUT", body: JSON.stringify({ reason }) }, "Order rejected.");
    if (ok) setShowReject(false);
  };

  const doConvert = () =>
    run(`/api/FieldOrder/Convert/${order.uKey}`, {
      method: "POST",
      body: JSON.stringify({
        gstRate: Number(convert.gstRate),
        dueDate: convert.dueDate || null,
      }),
    });

  const total = order.items.reduce((s, i) => s + Number(qty[i.id] || 0) * Number(i.quotedPrice), 0);
  const badQty = editable && order.items.some((i) => !(Number(qty[i.id]) >= 1));

  return (
    <div className="fr-sub">
      <div className="fr-sub-head">
        <h4 className="fr-sub-title">{order.orderNumber}</h4>
        <button className="gst-btn gst-btn--sm gst-btn--ghost" onClick={onClose}>Close</button>
      </div>

      <dl className="fr-detail-meta">
        <div><dt>Rep</dt><dd>{order.repName}</dd></div>
        <div><dt>Retailer</dt><dd>{order.retailerName}</dd></div>
        <div><dt>Taken</dt><dd>{fmtDateTime(order.capturedAt)}</dd></div>
        <div><dt>Status</dt><dd>{STATUS_LABEL[order.status] || order.status}</dd></div>
        {order.remarks && <div><dt>Rep's note</dt><dd>{order.remarks}</dd></div>}
        {order.rejectReason && <div><dt>Rejected because</dt><dd>{order.rejectReason}</dd></div>}
        {order.convertedSalesId && <div><dt>Sale created</dt><dd>#{order.convertedSalesId}</dd></div>}
      </dl>

      {order.hasConflict && (
        <div className="gst-alert gst-alert--warning">
          Some lines changed since the rep quoted them — highlighted below. Adjust quantities before approving if stock is short.
        </div>
      )}

      <div className="gst-table-wrap">
        <table className="gst-table">
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Rep quoted</th><th>Price now</th><th>In stock</th><th>Issue</th></tr>
          </thead>
          <tbody>
            {order.items.map((i) => {
              const priceMoved = i.currentPrice != null && Number(i.currentPrice) !== Number(i.quotedPrice);
              const short = i.availableQty != null && Number(qty[i.id]) > i.availableQty;
              return (
                <tr key={i.id} className={i.conflictReason ? "fr-conflict-row" : ""}>
                  <td className="gst-cell-strong">{i.productName}</td>
                  <td>
                    {editable ? (
                      <input
                        type="number" min="1" className="fr-qty-input" aria-label={`Quantity for ${i.productName}`}
                        value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                      />
                    ) : i.quantity}
                  </td>
                  <td>{fmtMoney(i.quotedPrice)}</td>
                  <td className={priceMoved ? "fr-changed" : ""}>{fmtMoney(i.currentPrice)}</td>
                  <td className={short ? "fr-short" : ""}>{i.availableQty ?? "—"}</td>
                  <td>
                    {i.conflictReason
                      ? i.conflictReason.split(",").map((c) => CONFLICT_LABEL[c] || c).join(", ")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="gst-section-hint" style={{ marginTop: 8 }}>
        Order total at the rep's quoted prices: <strong>{fmtMoney(total)}</strong>. A converted sale is billed at today's live price, not the quote.
      </p>

      <div className="fr-actions">
        {editable && (
          <button className="gst-btn gst-btn--success" disabled={busy || badQty} onClick={approve}>Approve</button>
        )}

        {order.status === "APPROVED" && canConvert && (
          <div className="fr-action-group">
            <div className="fr-field">
              <label className="fr-label" htmlFor="fr-gst">GST %</label>
              <input id="fr-gst" type="number" min="0" max="100" className="fr-qty-input" value={convert.gstRate} onChange={(e) => setConvert({ ...convert, gstRate: e.target.value })} />
            </div>
            <div className="fr-field">
              <label className="fr-label" htmlFor="fr-due">Due date (default: 30 days)</label>
              <input id="fr-due" type="date" className="gst-search" value={convert.dueDate} onChange={(e) => setConvert({ ...convert, dueDate: e.target.value })} />
            </div>
            <button className="gst-btn gst-btn--primary" disabled={busy} onClick={doConvert}>Convert to sale</button>
          </div>
        )}

        {canDecide && (order.status === "SUBMITTED" || order.status === "APPROVED") && !showReject && (
          <button className="gst-btn gst-btn--danger" disabled={busy} onClick={() => setShowReject(true)}>Reject</button>
        )}
      </div>

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
