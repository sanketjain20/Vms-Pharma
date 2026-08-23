import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const API = `${API_BASE_URL}/api/SupplierPayment`;
const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const modeColor = mode => {
  const map = {
    CASH:  { color: "#6ee7b7", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
    UPI:   { color: "#93c5fd", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" },
    CHEQUE:{ color: "#fbbf24", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
    BANK_TRANSFER: { color: "#c4b5fd", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
    NEFT:  { color: "#c4b5fd", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.3)" },
    RTGS:  { color: "#5eead4", bg: "rgba(20,184,166,0.12)", border: "rgba(20,184,166,0.3)" },
  };
  return map[mode] || { color: "#93c5fd", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)" };
};

const Card = ({ label, value, mono, accent, danger }) => (
  <div className="afx-field">
    <label className="afx-label">{label}</label>
    <div
      className={`afx-view-value ${mono ? "afx-view-value--mono" : ""}`}
      style={accent ? { color: "var(--afx-accent)", fontWeight: 700 } : danger ? { color: "var(--afx-danger)" } : undefined}
    >
      {value || <span className="afx-view-value--empty">—</span>}
    </div>
  </div>
);

export default function SupplierPaymentView({ uKey, onClose, onReverse }) {
  const [data,       setData]       = useState(null);
  const [error,      setError]      = useState("");
  const [confirmRev, setConfirmRev] = useState(false);
  const [reversing,  setReversing]  = useState(false);

  useEffect(() => {
    if (!uKey) return;
    apiClient(`${API}/GetByUKey/${uKey}`)
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(j => { if (j?.status === 200) setData(j.data); else setError(j?.message || "Failed to load"); })
      .catch(err => setError(err.message));
  }, [uKey]);

  const handleReverse = async () => {
    if (!confirmRev) { setConfirmRev(true); return; }
    setReversing(true);
    try {
      const res  = await apiClient(`${API}/Reverse/${uKey}`, { method: "DELETE" });
      const json = await res.json();
      if (json?.status === 200) { onReverse?.(); onClose?.(); }
      else setError(json?.message || "Failed to reverse");
    } catch { setError("Network error. Try again."); }
    finally { setReversing(false); }
  };

  if (!uKey) return null;

  const mc = data ? modeColor(data.paymentMode) : null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--md">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Supplier Payment</div>
            <h3 className="afx-title">{data ? `₹${fmt(data.amount)} paid` : "Loading…"}</h3>
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
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span className="afx-badge afx-view-value--mono">{data.paymentCode}</span>
                <span className="afx-badge" style={{ color: mc.color, background: mc.bg, border: `1px solid ${mc.border}` }}>{data.paymentMode}</span>
                <span className="afx-badge" style={{ color: "var(--afx-accent)", fontWeight: 700 }}>₹{fmt(data.amount)}</span>
                {data.isReversed && (
                  <span className="afx-badge" style={{ color: "var(--afx-danger)", background: "var(--afx-danger-soft)", border: "1px solid rgba(239,68,68,0.3)" }}>REVERSED</span>
                )}
              </div>

              <div className="afx-section-title">Supplier</div>
              <div className="afx-grid">
                <Card label="Shop name"     value={data.supplierShopName} />
                <Card label="Supplier code" value={data.supplierCode} mono />
              </div>

              {data.purchaseNumber && (
                <>
                  <div className="afx-section-title">Linked purchase</div>
                  <div className="afx-info">
                    Payment linked to purchase <strong>{data.purchaseNumber}</strong>
                    {data.purchaseRemainingAmount != null && (
                      <span style={{ marginLeft: 8 }}>
                        · Remaining after this: <strong className="afx-text-danger">₹{fmt(data.purchaseRemainingAmount)}</strong>
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="afx-section-title">Payment details</div>
              <div className="afx-grid">
                <Card label="Amount"        value={`₹${fmt(data.amount)}`} accent />
                <Card label="Payment date"  value={data.paymentDate} />
                <Card label="Payment mode"  value={data.paymentMode} mono />
                <Card label="Reference no"  value={data.referenceNumber} mono />
              </div>

              {data.notes && (
                <>
                  <div className="afx-section-title">Notes</div>
                  <div className="afx-card"><div className="afx-card-row">{data.notes}</div></div>
                </>
              )}

              {!data.isReversed && (
                <div className="afx-info">
                  Payments cannot be edited. If this entry is wrong, use <strong>Reverse</strong> — supplier outstanding and purchase balances will be restored automatically.
                </div>
              )}
            </>
          )}
        </div>

        {data && !data.isReversed && (
          <div className="afx-footer">
            {confirmRev ? (
              <>
                <span className="afx-footer-note">Reverse this payment? Supplier outstanding will be restored.</span>
                <button type="button" className="afx-btn" onClick={() => setConfirmRev(false)}>Cancel</button>
                <button
                  type="button"
                  className="afx-btn"
                  style={{ background: "var(--afx-danger)", borderColor: "var(--afx-danger)", color: "#fff" }}
                  onClick={handleReverse}
                  disabled={reversing}
                >
                  {reversing ? <><span className="afx-spinner" /> Reversing…</> : "Yes, Reverse"}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="afx-btn" onClick={onClose}>Close</button>
                <button
                  type="button"
                  className="afx-btn"
                  style={{ borderColor: "var(--afx-danger)", color: "var(--afx-danger)" }}
                  onClick={handleReverse}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 5h6a4 4 0 010 8H5M2 5l3-3M2 5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {" "}Reverse Payment
                </button>
              </>
            )}
          </div>
        )}
        {data && data.isReversed && (
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
