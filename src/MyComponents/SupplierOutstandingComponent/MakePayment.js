import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../../Styles/RetailerOutstanding/CollectPayment.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const fmt = n =>
  parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const MODES = ["CASH", "UPI", "CARD", "BANK"];

const badgeClass = status => {
  if (status === "PAID") return "cp-badge-green";
  if (status === "OVERDUE") return "cp-badge-red";
  if (status === "DUE_SOON") return "cp-badge-amber";
  return "cp-badge-blue";
};

function InvoiceRow({ invoice, active, onCollect, onCancel, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const remaining = Number(invoice.remainingAmount || 0);
  const paid = Number(invoice.amountPaid || 0);
  const total = Number(invoice.netAmount || 0);

  useEffect(() => {
    if (active) {
      setAmount(remaining.toFixed(2));
      setMode("CASH");
      setNote("");
      setError("");
    }
  }, [active, remaining]);

  const submit = async () => {
    setError("");
    const parsed = Number(amount);

    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (parsed > remaining + 0.001) {
      setError(`Cannot exceed Rs ${fmt(remaining)}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/SupplierLedger/CollectPayment`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purchaseId: invoice.purchaseId ?? invoice.salesId,
          amountCollected: parsed,
          paymentMode: mode,
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.status === 200) {
        toast.success(`Rs ${fmt(parsed)} paid via ${mode}`);
        onSuccess();
      } else {
        setError(json.message || "Payment failed");
      }
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`cp-ledger-invoice ${active ? "cp-ledger-invoice-active" : ""}`}>
      <div className="cp-ledger-invoice-main">
        <div>
          <div className="cp-ledger-invoice-no">{invoice.invoiceNumber}</div>
          <div className="cp-ledger-invoice-sub">
            <span>{invoice.invoiceDate || "No invoice date"}</span>
            {invoice.dueDate && <span>Due {invoice.dueDate}</span>}
            {invoice.paymentType && <span>{invoice.paymentType}</span>}
          </div>
        </div>

        <div className="cp-ledger-amounts">
          <span><b>Invoice</b> Rs {fmt(total)}</span>
          <span><b>Paid</b> Rs {fmt(paid)}</span>
          <span className={remaining > 0 ? "cp-danger" : "cp-accent"}>
            <b>Due</b> Rs {fmt(remaining)}
          </span>
        </div>

        <div className="cp-ledger-actions">
          <span className={`cp-badge ${badgeClass(invoice.statusLabel)}`}>
            {(invoice.statusLabel || "PENDING").replace("_", " ")}
          </span>
          {remaining > 0 && !active && (
            <button className="cp-btn-primary cp-btn-compact" onClick={() => onCollect(invoice.purchaseId)}>
              Pay Supplier
            </button>
          )}
        </div>
      </div>

      {active && (
        <div className="cp-collect-panel">
          <div className="cp-amount-row">
            <input
              className="cp-input"
              type="number"
              min="0.01"
              max={remaining}
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <button className="cp-quick-btn cp-quick-full" onClick={() => setAmount(remaining.toFixed(2))}>
              Full Rs {fmt(remaining)}
            </button>
          </div>

          <div className="cp-ledger-mode-row">
            {MODES.map(m => (
              <button
                key={m}
                className={`cp-mode-chip ${mode === m ? "active" : ""}`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <input
            className="cp-input"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Note (optional)"
          />

          {error && <div className="cp-submit-error">{error}</div>}

          <div className="cp-panel-actions">
            <button className="cp-btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="cp-btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? <><span className="cp-spinner" /> Paying</> : `Pay Rs ${fmt(amount || 0)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MakePayment({ uKey, onClose, onSuccess }) {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("unpaid");
  const [payingId, setPayingId] = useState(null);

  const fetchLedger = useCallback(async () => {
    if (!uKey) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient(`${API_BASE_URL}/api/SupplierLedger/Ledger/${uKey}`, {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      if (json.status === 200) {
        setLedger(json.data);
      } else {
        setError(json.message || "Failed to load ledger");
      }
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [uKey]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const invoices = useMemo(() => ledger?.invoices || [], [ledger]);
  const unpaidInvoices = useMemo(
    () => invoices.filter(inv => Number(inv.remainingAmount || 0) > 0 || inv.statusLabel !== "PAID"),
    [invoices]
  );
  const paidInvoices = useMemo(
    () => invoices.filter(inv => Number(inv.remainingAmount || 0) <= 0 || inv.statusLabel === "PAID"),
    [invoices]
  );
  const history = ledger?.paymentHistory || [];
  const totalCollected = history.reduce((sum, item) => sum + Number(item.amountCollected || 0), 0);

  const handleSuccess = async () => {
    setPayingId(null);
    await fetchLedger();
    onSuccess?.();
  };

  if (!uKey) return null;

  return (
    <div className="cp-backdrop">
      <div className="cp-modal cp-ledger-modal">
        <div className="cp-top-beam" />
        <div className="cp-corner cp-tl" /><div className="cp-corner cp-tr" />
        <div className="cp-corner cp-bl" /><div className="cp-corner cp-br" />

        <div className="cp-header">
          <div className="cp-header-left">
            <div className="cp-eyebrow"><span className="cp-eyebrow-dot" />SUPPLIER PAYMENT</div>
            <h3 className="cp-title">
              <span className="cp-title-acc"></span>
              {ledger ? ledger.shopName : "Loading ledger"}
            </h3>
          </div>
          <div className="cp-header-right">
            {ledger && (
              <div className="cp-remaining-pill">
                <span className="cp-rp-label">Outstanding</span>
                <span className="cp-rp-amount">Rs {fmt(ledger.totalOutstanding)}</span>
              </div>
            )}
            <button className="cp-close" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="cp-divider" />

        <div className="cp-body">
          {loading && (
            <div className="cp-ledger-state">
              <span className="cp-spinner" />
              Loading supplier ledger
            </div>
          )}

          {error && <div className="cp-submit-error">{error}</div>}

          {!loading && !error && ledger && (
            <>
              <div className="cp-status-row">
                <span className="cp-code-badge">{ledger.supplierCode}</span>
                <span className="cp-badge cp-badge-blue">{unpaidInvoices.length} Unpaid</span>
                <span className="cp-badge cp-badge-green">{paidInvoices.length} Paid</span>
                <span className="cp-badge cp-badge-amber">Rs {fmt(totalCollected)} Collected</span>
              </div>

              <div className="cp-tabs">
                {[
                  { key: "unpaid", label: "Unpaid Invoices", count: unpaidInvoices.length },
                  { key: "paid", label: "Paid Invoices", count: paidInvoices.length },
                  { key: "history", label: "History", count: history.length },
                ].map(tab => (
                  <button
                    key={tab.key}
                    className={`cp-tab ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => { setActiveTab(tab.key); setPayingId(null); }}
                  >
                    {tab.label}
                    <span>{tab.count}</span>
                  </button>
                ))}
              </div>

              {activeTab === "unpaid" && (
                <div className="cp-ledger-list">
                  {unpaidInvoices.length === 0 ? (
                    <div className="cp-ledger-empty">No unpaid invoices. This supplier is settled.</div>
                  ) : (
                    unpaidInvoices.map(inv => (
                      <InvoiceRow
                        key={inv.purchaseId || inv.invoiceNumber}
                        invoice={inv}
                        active={payingId === (inv.purchaseId ?? inv.salesId)}
                        onCollect={setPayingId}
                        onCancel={() => setPayingId(null)}
                        onSuccess={handleSuccess}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "paid" && (
                <div className="cp-ledger-list">
                  {paidInvoices.length === 0 ? (
                    <div className="cp-ledger-empty">No paid invoices found.</div>
                  ) : (
                    paidInvoices.map(inv => (
                      <InvoiceRow
                        key={inv.purchaseId || inv.invoiceNumber}
                        invoice={inv}
                        active={false}
                        onCollect={setPayingId}
                        onCancel={() => setPayingId(null)}
                        onSuccess={handleSuccess}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="cp-history-list">
                  {history.length === 0 ? (
                    <div className="cp-ledger-empty">No payment history yet.</div>
                  ) : (
                    history.map((item, idx) => (
                      <div className="cp-history-row" key={`${item.paymentId || item.id || idx}`}>
                        <div>
                          <div className="cp-ledger-invoice-no">{item.invoiceNumber || "General payment"}</div>
                          <div className="cp-ledger-invoice-sub">
                            <span>{item.collectedAt || item.paymentDate || "No date"}</span>
                            {item.note && <span>{item.note}</span>}
                          </div>
                        </div>
                        <div className="cp-history-meta">
                          <span className="cp-badge cp-badge-blue">{item.paymentMode}</span>
                          <strong>Rs {fmt(item.amountCollected || item.amount)}</strong>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="cp-footer">
          <div className="cp-footer-summary">
            <span className="cp-fs-label">Outstanding</span>
            <span className="cp-fs-amount">Rs {fmt(ledger?.totalOutstanding)}</span>
          </div>
          <button className="cp-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
