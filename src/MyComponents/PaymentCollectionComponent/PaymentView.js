import React, { useEffect, useState } from "react";
import "../../Styles/PaymentCollection/Payment.css";

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const Card = ({ label, value, mono, accent, danger }) => (
  <div className="pyx-view-card">
    <span className="pyx-view-label">{label}</span>
    <span className={`pyx-view-value ${mono ? "pyx-mono" : ""} ${accent ? "pyx-accent" : ""} ${danger ? "pyx-danger" : ""}`}>
      {value || <span className="pyx-view-empty">—</span>}
    </span>
  </div>
);

const modeBadge = mode => {
  const map = { CASH:"pyx-badge-green", UPI:"pyx-badge-blue", CARD:"pyx-badge-purple", CHEQUE:"pyx-badge-amber" };
  return map[mode] || "pyx-badge-blue";
};

export default function PaymentView({ uKey, onClose, onDelete }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!uKey) return;
    fetch(`http://localhost:8080/api/PaymentCollection/GetPaymentByUKey/${uKey}`, {
      method: "GET", credentials: "include",
    })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(json => {
        if (json?.status === 200) setData(json.data);
        else setError(json?.message || "Failed to fetch payment");
      })
      .catch(err => setError(err.message));
  }, [uKey]);

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try {
      const res  = await fetch(`http://localhost:8080/api/PaymentCollection/DeletePayment/${uKey}`, {
        method: "DELETE", credentials: "include",
      });
      const json = await res.json();
      if (json?.status === 200 || json?.success) {
        onDelete?.(); onClose?.();
      } else {
        setError(json?.message || "Failed to reverse payment");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (!uKey) return null;

  return (
    <div className="pyx-backdrop">
      <div className="pyx-modal pyx-modal-view">
        <div className="pyx-top-beam" />
        <div className="pyx-corner pyx-tl" /><div className="pyx-corner pyx-tr" />
        <div className="pyx-corner pyx-bl" /><div className="pyx-corner pyx-br" />

        {/* ── HEADER ── */}
        <div className="pyx-header">
          <div className="pyx-header-left">
            <div className="pyx-eyebrow"><span className="pyx-eyebrow-dot" />PAYMENT RECORD</div>
            <h3 className="pyx-title">
              <span className="pyx-title-acc">//</span>
              {data ? `₹${fmt(data.amount)} collected` : "Loading…"}
            </h3>
          </div>
          <button className="pyx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="pyx-divider" />

        {/* ── BODY ── */}
        <div className="pyx-body">
          {error && <div className="pyx-alert">{error}</div>}

          {!data && !error && (
            <div className="pyx-loading">
              <div className="pyx-loader"><div/><div/><div/><div/></div>
              Loading payment data…
            </div>
          )}

          {data && (
            <>
              {/* ── STATUS ROW ── */}
              <div className="pyx-view-status-row">
                <span className={`pyx-badge ${modeBadge(data.paymentMode)}`}>
                  {data.paymentMode}
                </span>
                <span className="pyx-amount-badge">₹{fmt(data.amount)}</span>
              </div>

              {/* ── RETAILER SECTION ── */}
              <div className="pyx-section-label">Retailer</div>
              <div className="pyx-view-grid">
                <Card label="Shop name"      value={data.retailerShopName} />
                <Card label="Retailer code"  value={data.retailerCode} mono />
              </div>

              {/* ── INVOICE LINK ── */}
              {data.invoiceNumber && (
                <>
                  <div className="pyx-section-label">Linked invoice</div>
                  <div className="pyx-invoice-banner">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    Payment linked to invoice <strong>{data.invoiceNumber}</strong>
                  </div>
                </>
              )}

              {/* ── PAYMENT DETAILS ── */}
              <div className="pyx-section-label">Payment details</div>
              <div className="pyx-view-grid">
                <Card label="Amount"          value={`₹${fmt(data.amount)}`} accent />
                <Card label="Payment date"    value={data.paymentDate} />
                <Card label="Payment mode"    value={data.paymentMode} mono />
                <Card label="Reference no"    value={data.referenceNumber} mono />
              </div>

              {data.notes && (
                <>
                  <div className="pyx-section-label">Notes</div>
                  <div className="pyx-notes-box">{data.notes}</div>
                </>
              )}

              {/* ── REVERSAL WARNING ── */}
              <div className="pyx-reversal-info">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1L12 11.5H1L6.5 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M6.5 5v3M6.5 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Payments cannot be edited. If this entry is wrong, use <strong>Reverse Payment</strong> to undo it — the outstanding balances and invoice amounts will be restored automatically.
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        {data && (
          <div className="pyx-footer">
            {confirmDel ? (
              <>
                <span className="pyx-confirm-text">Reverse this payment? This cannot be undone.</span>
                <button type="button" className="pyx-btn-ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
                <button type="button" className="pyx-btn-danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <><span className="pyx-spinner" /> Reversing…</> : "Yes, Reverse"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="pyx-btn-ghost" onClick={onClose}>Close</button>
                <button type="button" className="pyx-btn-danger-outline" onClick={handleDelete}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3h8M5 1.5h2M4.5 10.5h3M3 3l.5 7.5h5L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Reverse Payment
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
