import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const Card = ({ label, value, mono, accent, danger }) => (
  <div className="afx-field">
    <label className="afx-label">{label}</label>
    <div
      className="afx-view-value"
      style={{
        ...(mono ? { fontFamily: "var(--afx-font-mono)", fontSize: 12.5 } : {}),
        ...(accent ? { color: "var(--afx-accent)" } : {}),
        ...(danger ? { color: "var(--afx-danger)" } : {}),
      }}
    >
      {value || <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

const modeStyle = mode => {
  const map = {
    CASH:   { color: "var(--afx-success)", background: "var(--afx-success-soft)" },
    UPI:    { color: "var(--afx-accent)",  background: "var(--afx-accent-soft)"  },
    CARD:   { color: "#a78bfa", background: "rgba(167,139,250,0.12)" },
    CHEQUE: { color: "var(--afx-warning)", background: "var(--afx-warning-soft)" },
  };
  return map[mode] || { color: "var(--afx-accent)", background: "var(--afx-accent-soft)" };
};

export default function PaymentView({ uKey, onClose, onDelete }) {
  const [data, setData]   = useState(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API_BASE_URL}/api/PaymentCollection/GetPaymentByUKey/${uKey}`, {
      method: "GET",
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
      const res  = await apiClient(`${API_BASE_URL}/api/PaymentCollection/DeletePayment/${uKey}`, {
        method: "DELETE",
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
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Payment Record</div>
            <h3 className="afx-title">{data ? `₹${fmt(data.amount)} collected` : "Loading…"}</h3>
          </div>
          <button className="afx-close" type="button" onClick={onClose} title="Close">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            ESC
          </button>
        </div>

        <div className="afx-body">
          {error && <div className="afx-alert">{error}</div>}

          {!data && !error && (
            <div className="afx-loading"><div className="afx-loader-ring"><div/><div/><div/></div></div>
          )}

          {data && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="afx-tag" style={modeStyle(data.paymentMode)}>{data.paymentMode}</span>
                <span className="afx-badge" style={{ fontSize: 13 }}>₹{fmt(data.amount)}</span>
              </div>

              <div className="afx-section-title">Retailer</div>
              <div className="afx-grid">
                <Card label="Shop name"     value={data.retailerShopName} />
                <Card label="Retailer code" value={data.retailerCode} mono />
              </div>

              {data.invoiceNumber && (
                <>
                  <div className="afx-section-title">Linked Invoice</div>
                  <div className="afx-info">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <rect x="1.5" y="1.5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 5h5M4 7.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    Payment linked to invoice <strong>{data.invoiceNumber}</strong>
                  </div>
                </>
              )}

              <div className="afx-section-title">Payment Details</div>
              <div className="afx-grid">
                <Card label="Amount"       value={`₹${fmt(data.amount)}`} accent />
                <Card label="Payment date" value={data.paymentDate} />
                <Card label="Payment mode" value={data.paymentMode} mono />
                <Card label="Reference no" value={data.referenceNumber} mono />
              </div>

              {data.notes && (
                <>
                  <div className="afx-section-title">Notes</div>
                  <div className="afx-card"><div className="afx-view-value">{data.notes}</div></div>
                </>
              )}

              <div className="afx-info">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1L12 11.5H1L6.5 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                  <path d="M6.5 5v3M6.5 9.5h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Payments cannot be edited. If this entry is wrong, use <strong>Reverse Payment</strong> to undo it — the outstanding balances and invoice amounts will be restored automatically.
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="afx-footer">
            {confirmDel ? (
              <>
                <span className="afx-footer-note">Reverse this payment? This cannot be undone.</span>
                <button type="button" className="afx-btn" onClick={() => setConfirmDel(false)}>Cancel</button>
                <button type="button" className="afx-btn" style={{ borderColor: "var(--afx-danger)", color: "var(--afx-danger)" }} onClick={handleDelete} disabled={deleting}>
                  {deleting ? <><span className="afx-spinner" /> Reversing…</> : "Yes, Reverse"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="afx-btn" onClick={onClose}>Close</button>
                <button type="button" className="afx-btn" style={{ borderColor: "var(--afx-danger)", color: "var(--afx-danger)" }} onClick={handleDelete}>
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
