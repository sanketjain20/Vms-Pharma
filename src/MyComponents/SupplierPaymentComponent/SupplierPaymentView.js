import React, { useEffect, useState } from "react";
import "../../Styles/SupplierPayment/SupplierPayment.css";

const API = "http://localhost:8080/api/SupplierPayment";
const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const modeBadge = mode => {
  const map = {
    CASH: "spx-badge-green", UPI: "spx-badge-blue",
    CHEQUE: "spx-badge-amber", BANK_TRANSFER: "spx-badge-purple",
    NEFT: "spx-badge-purple", RTGS: "spx-badge-teal",
  };
  return map[mode] || "spx-badge-blue";
};

const Card = ({ label, value, mono, accent, danger }) => (
  <div className="spx-view-card">
    <span className="spx-view-label">{label}</span>
    <span className={`spx-view-value ${mono ? "spx-mono" : ""} ${accent ? "spx-accent" : ""} ${danger ? "spx-danger" : ""}`}>
      {value || <span className="spx-view-empty">—</span>}
    </span>
  </div>
);

export default function SupplierPaymentView({ uKey, onClose, onReverse }) {
  const [data,       setData]       = useState(null);
  const [error,      setError]      = useState("");
  const [confirmRev, setConfirmRev] = useState(false);
  const [reversing,  setReversing]  = useState(false);

  useEffect(() => {
    if (!uKey) return;
    fetch(`${API}/GetByUKey/${uKey}`, { credentials: "include" })
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (j?.status === 200) setData(j.data); else setError(j?.message || "Failed to load"); })
      .catch(err => setError(err.message));
  }, [uKey]);

  const handleReverse = async () => {
    if (!confirmRev) { setConfirmRev(true); return; }
    setReversing(true);
    try {
      const res  = await fetch(`${API}/Reverse/${uKey}`, { method: "DELETE", credentials: "include" });
      const json = await res.json();
      if (json?.status === 200) { onReverse?.(); onClose?.(); }
      else setError(json?.message || "Failed to reverse");
    } catch { setError("Network error. Try again."); }
    finally { setReversing(false); }
  };

  if (!uKey) return null;

  return (
    <div className="spx-backdrop">
      <div className="spx-modal spx-modal-view">
        <div className="spx-top-beam" />
        <div className="spx-corner spx-tl" /><div className="spx-corner spx-tr" />
        <div className="spx-corner spx-bl" /><div className="spx-corner spx-br" />

        {/* HEADER */}
        <div className="spx-header">
          <div className="spx-header-left">
            <div className="spx-eyebrow"><span className="spx-eyebrow-dot" />SUPPLIER PAYMENT</div>
            <h3 className="spx-title">
              <span className="spx-title-acc">//</span>
              {data ? `₹${fmt(data.amount)} paid` : "Loading…"}
            </h3>
          </div>
          <button className="spx-close" type="button" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            ESC
          </button>
        </div>

        <div className="spx-divider" />

        {/* BODY */}
        <div className="spx-body">
          {error && <div className="spx-alert">{error}</div>}

          {!data && !error && (
            <div className="spx-loading">
              <div className="spx-loader"><div/><div/><div/><div/></div>
              Loading payment…
            </div>
          )}

          {data && (
            <>
              {/* Status row */}
              <div className="spx-view-status-row">
                <span className="spx-code-badge">{data.paymentCode}</span>
                <span className={`spx-badge ${modeBadge(data.paymentMode)}`}>{data.paymentMode}</span>
                <span className="spx-amount-badge">₹{fmt(data.amount)}</span>
                {data.isReversed && <span className="spx-badge spx-badge-red">REVERSED</span>}
              </div>

              {/* Supplier */}
              <div className="spx-section-label">Supplier</div>
              <div className="spx-view-grid">
                <Card label="Shop name"     value={data.supplierShopName} />
                <Card label="Supplier code" value={data.supplierCode} mono />
              </div>

              {/* Purchase link */}
              {data.purchaseNumber && (
                <>
                  <div className="spx-section-label">Linked purchase</div>
                  <div className="spx-invoice-banner">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    Payment linked to purchase <strong>{data.purchaseNumber}</strong>
                    {data.purchaseRemainingAmount != null && (
                      <span style={{ marginLeft: 8 }}>
                        · Remaining after this: <strong className="spx-danger">₹{fmt(data.purchaseRemainingAmount)}</strong>
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Payment details */}
              <div className="spx-section-label">Payment details</div>
              <div className="spx-view-grid">
                <Card label="Amount"        value={`₹${fmt(data.amount)}`} accent />
                <Card label="Payment date"  value={data.paymentDate} />
                <Card label="Payment mode"  value={data.paymentMode} mono />
                <Card label="Reference no"  value={data.referenceNumber} mono />
              </div>

              {data.notes && (
                <>
                  <div className="spx-section-label">Notes</div>
                  <div className="spx-notes-box">{data.notes}</div>
                </>
              )}

              {/* Reversal warning */}
              {!data.isReversed && (
                <div className="spx-reversal-info">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1L12 11.5H1L6.5 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M6.5 5v3M6.5 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Payments cannot be edited. If this entry is wrong, use <strong>Reverse</strong> — supplier outstanding and purchase balances will be restored automatically.
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        {data && !data.isReversed && (
          <div className="spx-footer">
            {confirmRev ? (
              <>
                <span className="spx-confirm-text">Reverse this payment? Supplier outstanding will be restored.</span>
                <button type="button" className="spx-btn-ghost" onClick={() => setConfirmRev(false)}>Cancel</button>
                <button type="button" className="spx-btn-danger" onClick={handleReverse} disabled={reversing}>
                  {reversing ? <><span className="spx-spinner" /> Reversing…</> : "Yes, Reverse"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="spx-btn-ghost" onClick={onClose}>Close</button>
                <button type="button" className="spx-btn-danger-outline" onClick={handleReverse}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 5h6a4 4 0 010 8H5M2 5l3-3M2 5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Reverse Payment
                </button>
              </>
            )}
          </div>
        )}
        {data && data.isReversed && (
          <div className="spx-footer">
            <button type="button" className="spx-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
