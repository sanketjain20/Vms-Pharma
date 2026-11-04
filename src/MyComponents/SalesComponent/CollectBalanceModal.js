import React, { useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import "../../Styles/CommonAEUDForm/FormShell.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { PAYMENT_MODES } from "../../utils/salePayments";

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Collect what is still due on a bill, straight from the Sales list, for any customer. The server decides where it
 * goes: a retailer's payment goes through their ledger (outstanding down, payment collection logged); a walk-in's is
 * one of the bill's own payments. Either way the Day-end summary counts it on the day it is received.
 */
export default function CollectBalanceModal({ bill, onClose, onCollected }) {
  const due = r2(bill.remainingAmount || 0);
  const [amount, setAmount] = useState(due.toFixed(2));
  const [mode, setMode] = useState("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isRetailer = !!bill.retailerId;

  const submit = async (e) => {
    e.preventDefault();
    const value = r2(parseFloat(amount));
    if (!(value > 0)) { setError("Enter the amount received."); return; }
    if (value > due) { setError(`Only ₹${due.toFixed(2)} is due on this bill.`); return; }
    setSaving(true);
    setError("");
    try {
      const q = new URLSearchParams({ salesId: String(bill.id), paymentAmount: value.toFixed(2), paymentMode: mode });
      if (mode !== "CASH" && reference.trim()) q.set("reference", reference.trim());
      const res = await apiClient(`${API_BASE_URL}/api/Sales/CollectPayment?${q.toString()}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (json?.status === 200) {
        toast.success(json.message);
        onCollected?.();
        onClose();
      } else {
        setError(json?.message || "The payment could not be collected.");
      }
    } catch {
      setError("The payment could not be collected. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--sm" role="dialog" aria-label="Collect balance">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Collect balance</div>
            <h3 className="afx-title">{bill.invoiceNumber} · {bill.billedTo || bill.retailerName || "Walk-in customer"}</h3>
          </div>
          <button type="button" className="afx-close" onClick={onClose} title="Close">ESC</button>
        </div>
        <form onSubmit={submit}>
          <div className="afx-body">
            <div className="afx-collect-sum" data-testid="collect-summary">
              <span>Bill ₹{Number(bill.netAmount || 0).toFixed(2)}</span>
              <span>Paid ₹{Number(bill.amountPaid || 0).toFixed(2)}</span>
              <strong>Due ₹{due.toFixed(2)}</strong>
            </div>
            <div className="afx-field afx-field--full">
              <label className="afx-label" htmlFor="collect-amount">Amount received (₹)<span className="afx-req">*</span></label>
              <input id="collect-amount" className="afx-input" type="number" min="0.01" max={due} step="0.01" value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }} />
            </div>
            <div className="afx-field afx-field--full">
              <label className="afx-label" htmlFor="collect-mode">Mode</label>
              <select id="collect-mode" className="afx-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                {PAYMENT_MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            {mode !== "CASH" && (
              <div className="afx-field afx-field--full">
                <label className="afx-label" htmlFor="collect-ref">Ref / txn no. (optional)</label>
                <input id="collect-ref" className="afx-input" type="text" maxLength={60} value={reference}
                  onChange={(e) => setReference(e.target.value)} />
              </div>
            )}
            {error && <div className="afx-error" role="alert">{error}</div>}
            <div className="afx-hint" data-testid="collect-where">
              {isRetailer
                ? `Goes into ${bill.retailerName || "the retailer"}'s ledger: their outstanding comes down by this amount.`
                : "Recorded on the bill as a payment received today."}
              {" "}It counts in today's Day-end summary.
            </div>
          </div>
          <div className="afx-footer">
            <button type="button" className="afx-btn" onClick={onClose}>Close</button>
            <button type="submit" className="afx-btn afx-btn--primary" disabled={saving}>{saving ? "Saving…" : `Collect ₹${r2(parseFloat(amount) || 0).toFixed(2)}`}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
