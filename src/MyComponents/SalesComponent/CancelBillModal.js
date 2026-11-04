import React, { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";

/**
 * Cancel (void) a bill. The server undoes everything the bill did — stock back, outstanding / turnover reversed, money
 * received becomes the retailer's advance (a walk-in's is refunded) — keeps the invoice number and sets its value to
 * zero. Only within 24 hours, without a return or an e-invoice, for a role with "Cancel Bill"; a reason is required.
 */
export default function CancelBillModal({ bill, onClose, onCancelled }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) { setError("Give a reason for cancelling the bill."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Sales/CancelSale/${bill.uKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (json?.status === 200) {
        toast.success(json.message);
        onCancelled?.(json.data);
        onClose();
      } else {
        setError(json?.message || "The bill could not be cancelled.");
      }
    } catch {
      setError("The bill could not be cancelled. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const net = Number(bill.netAmount || 0).toFixed(2);
  return createPortal(
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--sm" role="dialog" aria-label="Cancel bill">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Cancel bill</div>
            <h3 className="afx-title">{bill.invoiceNumber} · ₹{net}</h3>
          </div>
          <button type="button" className="afx-close" onClick={onClose} title="Close">ESC</button>
        </div>
        <form onSubmit={submit}>
          <div className="afx-body">
            <div className="afx-alert" data-testid="cancel-effects">
              The bill keeps its number and becomes ₹0 (Cancelled). Its stock goes back, and what the customer owes is
              taken off. Money already received becomes the retailer's advance — for a walk-in, refund it at the counter.
              This can't be undone.
            </div>
            <div className="afx-field afx-field--full">
              <label className="afx-label" htmlFor="cancel-reason">Reason<span className="afx-req">*</span></label>
              <textarea id="cancel-reason" className="afx-input" rows={3} maxLength={300} value={reason}
                onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="e.g. Billed to the wrong customer" />
            </div>
            {error && <div className="afx-error" role="alert">{error}</div>}
            <div className="afx-hint">Only within 24 hours of billing, and not for a bill with a return or an e-invoice.</div>
          </div>
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Keep the bill</button>
            <button type="submit" className="afx-btn afx-btn--danger" disabled={saving}>{saving ? "Cancelling…" : "Cancel bill"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
