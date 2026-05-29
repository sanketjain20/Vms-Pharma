import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../../Styles/RetailerOutstanding/RetailerLedgerModal.css";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK"];

/* ── Status badge helper ── */
function StatusBadge({ label }) {
  const map = {
    OVERDUE:  { cls: "rlm-badge-red",   text: "Overdue"  },
    DUE_SOON: { cls: "rlm-badge-amber", text: "Due Soon" },
    PENDING:  { cls: "rlm-badge-blue",  text: "Pending"  },
    PAID:     { cls: "rlm-badge-green", text: "Paid"     },
  };
  const s = map[label] || map.PENDING;
  return <span className={`rlm-badge ${s.cls}`}>{s.text}</span>;
}

/* ── Collect Payment Mini Form ── */
function CollectPaymentForm({ invoice, onSuccess, onCancel }) {
  const [amount,      setAmount]      = useState("");
  const [mode,        setMode]        = useState("CASH");
  const [note,        setNote]        = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  const maxAmount = Number(invoice.remainingAmount || 0);

  const handleSubmit = async () => {
    setError("");
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount"); return;
    }
    if (parsed > maxAmount) {
      setError(`Cannot exceed ₹${maxAmount.toFixed(2)}`); return;
    }

    setSubmitting(true);
    try {
      const res  = await apiClient(
        `${API_BASE_URL}/api/RetailerLedger/CollectPayment`,
        {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            salesId:         invoice.salesId,
            amountCollected: parsed,
            paymentMode:     mode,
            note:            note.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (json.status === 200) {
        toast.success(`₹${parsed.toFixed(2)} collected via ${mode}`);
        onSuccess();
      } else {
        setError(json.message || "Collection failed");
      }
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rlm-cpf">
      <div className="rlm-cpf-header">
        <span className="rlm-cpf-title">Collect Payment</span>
        <span className="rlm-cpf-inv">{invoice.invoiceNumber}</span>
      </div>

      <div className="rlm-cpf-remaining">
        <span>Remaining</span>
        <span className="rlm-cpf-amt">₹{maxAmount.toFixed(2)}</span>
      </div>

      <label className="rlm-cpf-label">Amount (₹)</label>
      <div className="rlm-cpf-amt-row">
        <input
          type="number"
          className="rlm-cpf-input"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          max={maxAmount}
          min={0.01}
          step={0.01}
        />
        <button
          className="rlm-cpf-full-btn"
          onClick={() => setAmount(maxAmount.toFixed(2))}
          title="Collect full remaining amount"
        >
          Full
        </button>
      </div>

      <label className="rlm-cpf-label">Payment Mode</label>
      <div className="rlm-cpf-modes">
        {PAYMENT_MODES.map(m => (
          <button
            key={m}
            className={`rlm-cpf-mode ${mode === m ? "active" : ""}`}
            onClick={() => setMode(m)}
          >
            {m === "CASH" ? "💵" : m === "UPI" ? "📱" : m === "CARD" ? "💳" : "🏦"}
            {m}
          </button>
        ))}
      </div>

      <label className="rlm-cpf-label">Note (optional)</label>
      <input
        type="text"
        className="rlm-cpf-input"
        placeholder="e.g. Collected by field agent"
        value={note}
        onChange={e => setNote(e.target.value)}
      />

      {error && <div className="rlm-cpf-error">{error}</div>}

      <div className="rlm-cpf-footer">
        <button className="rlm-cpf-cancel" onClick={onCancel}>Cancel</button>
        <button
          className="rlm-cpf-submit"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Processing…" : "Collect ₹" + (parseFloat(amount) || 0).toFixed(2)}
        </button>
      </div>
    </div>
  );
}

/* ── MAIN MODAL ── */
export default function RetailerLedgerModal({ retailerId, onClose }) {
  const [ledger,       setLedger]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [activeTab,    setActiveTab]    = useState("invoices"); // invoices | history
  const [collectingId, setCollectingId] = useState(null); // salesId being collected
  const [filterStatus, setFilterStatus] = useState("ALL");

  const fetchLedger = async () => {
    setLoading(true); setError("");
    try {
      const res  = await apiClient(
        `${API_BASE_URL}/api/RetailerLedger/Ledger/${retailerId}`,
        { method: "GET", credentials: "include" }
      );
      const json = await res.json();
      if (json.status === 200) setLedger(json.data);
      else setError(json.message || "Failed to load ledger");
    } catch (e) {
      setError("Network error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedger(); }, [retailerId]);

  // After payment collected — refresh ledger
  const handlePaymentSuccess = () => {
    setCollectingId(null);
    fetchLedger();
  };

  const filteredInvoices = ledger?.invoices?.filter(inv => {
    if (filterStatus === "ALL")     return true;
    if (filterStatus === "UNPAID")  return inv.statusLabel !== "PAID";
    return inv.statusLabel === filterStatus;
  }) || [];

  const overdueCount = ledger?.invoices?.filter(i => i.statusLabel === "OVERDUE").length  || 0;
  const pendingCount = ledger?.invoices?.filter(i => i.statusLabel === "PENDING").length  || 0;
  const dueSoonCount = ledger?.invoices?.filter(i => i.statusLabel === "DUE_SOON").length || 0;
  const paidCount    = ledger?.invoices?.filter(i => i.statusLabel === "PAID").length     || 0;

  return (
    <div className="rlm-backdrop">
      <div className="rlm-modal">
        <div className="rlm-top-beam" />
        <div className="rlm-corner rlm-tl"/>
        <div className="rlm-corner rlm-tr"/>
        <div className="rlm-corner rlm-bl"/>
        <div className="rlm-corner rlm-br"/>

        
        <div className="rlm-header">
          <div className="rlm-header-left">
            <div className="rlm-eyebrow">
              <span className="rlm-eyebrow-dot" />
              RETAILER LEDGER
            </div>
            <h3 className="rlm-title">
              <span className="rlm-title-acc"></span>
              {ledger ? `${ledger.shopName}` : "Loading…"}
            </h3>
            {ledger && (
              <div className="rlm-retailer-meta">
                <span>{ledger.ownerName}</span>
                <span className="rlm-meta-sep">·</span>
                <span>{ledger.phone}</span>
                <span className="rlm-meta-sep">·</span>
                <span className="rlm-meta-code">{ledger.retailerCode}</span>
              </div>
            )}
          </div>
          <div className="rlm-header-right">
            {ledger && (
              <div className="rlm-outstanding-badge">
                <span className="rlm-ob-label">Total Outstanding</span>
                <span className="rlm-ob-amount">
                  ₹{Number(ledger.totalOutstanding || 0).toFixed(2)}
                </span>
              </div>
            )}
            <button className="rlm-close" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="rlm-divider" />

        
        <div className="rlm-body">

          {loading && (
            <div className="rlm-loading">
              <div className="rlm-loader">
                <div/><div/><div/><div/>
              </div>
              Loading ledger…
            </div>
          )}

          {error && (
            <div className="rlm-error-msg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M7 4.5V7.5M7 9.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {!loading && !error && ledger && (
            <>
              
              <div className="rlm-stats">
                {[
                  { label: "Overdue",  value: overdueCount,  cls: "red"   },
                  { label: "Due Soon", value: dueSoonCount,  cls: "amber" },
                  { label: "Pending",  value: pendingCount,  cls: "blue"  },
                  { label: "Paid",     value: paidCount,     cls: "green" },
                ].map((s, i) => (
                  <div key={i} className={`rlm-stat rlm-stat-${s.cls}`}>
                    <span className="rlm-stat-val">{s.value}</span>
                    <span className="rlm-stat-lbl">{s.label}</span>
                  </div>
                ))}
              </div>

              
              <div className="rlm-tabs">
                <button
                  className={`rlm-tab ${activeTab === "invoices" ? "active" : ""}`}
                  onClick={() => setActiveTab("invoices")}
                >
                  Invoices
                  <span className="rlm-tab-count">
                    {ledger.invoices?.length || 0}
                  </span>
                </button>
                <button
                  className={`rlm-tab ${activeTab === "history" ? "active" : ""}`}
                  onClick={() => setActiveTab("history")}
                >
                  Payment History
                  <span className="rlm-tab-count">
                    {ledger.paymentHistory?.length || 0}
                  </span>
                </button>
              </div>

              
              {activeTab === "invoices" && (
                <div className="rlm-tab-body">

                  
                  <div className="rlm-filter-pills">
                    {["ALL", "UNPAID", "OVERDUE", "DUE_SOON", "PENDING", "PAID"].map(f => (
                      <button
                        key={f}
                        className={`rlm-pill ${filterStatus === f ? "active" : ""}`}
                        onClick={() => setFilterStatus(f)}
                      >
                        {f.replace("_", " ")}
                      </button>
                    ))}
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className="rlm-empty">No invoices found</div>
                  ) : (
                    <div className="rlm-invoice-list">
                      {filteredInvoices.map((inv, idx) => (
                        <div
                          key={idx}
                          className={`rlm-invoice-row ${inv.statusLabel === "OVERDUE" ? "rlm-inv-overdue" : ""}`}
                          style={{ animationDelay: `${idx * 0.03}s` }}
                        >
                          
                          <div className="rlm-inv-left">
                            <div className="rlm-inv-number">{inv.invoiceNumber}</div>
                            <div className="rlm-inv-meta">
                              <span>{inv.invoiceDate || "—"}</span>
                              {inv.dueDate && (
                                <>
                                  <span className="rlm-meta-sep">·</span>
                                  <span className={inv.isOverdue ? "rlm-overdue-text" : ""}>
                                    Due: {inv.dueDate}
                                  </span>
                                </>
                              )}
                              <span className="rlm-meta-sep">·</span>
                              <span className="rlm-inv-type">{inv.paymentType}</span>
                            </div>
                          </div>

                          
                          <div className="rlm-inv-amounts">
                            <div className="rlm-inv-amount-row">
                              <span className="rlm-inv-alabel">Invoice</span>
                              <span className="rlm-inv-aval">
                                ₹{Number(inv.netAmount || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="rlm-inv-amount-row">
                              <span className="rlm-inv-alabel">Paid</span>
                              <span className="rlm-inv-aval rlm-paid-color">
                                ₹{Number(inv.amountPaid || 0).toFixed(2)}
                              </span>
                            </div>
                            <div className="rlm-inv-amount-row">
                              <span className="rlm-inv-alabel">Due</span>
                              <span className={`rlm-inv-aval ${inv.statusLabel === "OVERDUE" ? "rlm-overdue-color" : "rlm-due-color"}`}>
                                ₹{Number(inv.remainingAmount || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          
                          <div className="rlm-inv-right">
                            <StatusBadge label={inv.statusLabel} />
                            {inv.statusLabel !== "PAID" && (
                              collectingId === inv.salesId ? (
                                <CollectPaymentForm
                                  invoice={inv}
                                  onSuccess={handlePaymentSuccess}
                                  onCancel={() => setCollectingId(null)}
                                />
                              ) : (
                                <button
                                  className="rlm-collect-btn"
                                  onClick={() => setCollectingId(inv.salesId)}
                                >
                                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                    <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                                    <path d="M5.5 3.5v4M3.5 5.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                  </svg>
                                  Collect
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              
              {activeTab === "history" && (
                <div className="rlm-tab-body">
                  {!ledger.paymentHistory?.length ? (
                    <div className="rlm-empty">No payment history yet</div>
                  ) : (
                    <div className="rlm-history-table-wrap">
                      <table className="rlm-history-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Mode</th>
                            <th>Collected By</th>
                            <th>Note</th>
                            <th>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.paymentHistory.map((ph, idx) => (
                            <tr key={idx} style={{ animationDelay: `${idx * 0.025}s` }}>
                              <td className="rlm-td-dim">{idx + 1}</td>
                              <td className="rlm-td-mono">{ph.invoiceNumber || "—"}</td>
                              <td className="rlm-td-dim">{ph.collectedAt || "—"}</td>
                              <td>
                                <span className="rlm-mode-badge">
                                  {ph.paymentMode === "CASH" ? "💵"
                                  : ph.paymentMode === "UPI"  ? "📱"
                                  : ph.paymentMode === "CARD" ? "💳" : "🏦"}
                                  {ph.paymentMode}
                                </span>
                              </td>
                              <td className="rlm-td-dim">{ph.collectedBy || "—"}</td>
                              <td className="rlm-td-dim">{ph.note || "—"}</td>
                              <td className="rlm-td-amount">
                                ₹{Number(ph.amountCollected || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={6} className="rlm-tf-label">
                              Total Collected
                            </td>
                            <td className="rlm-tf-total">
                              ₹{ledger.paymentHistory
                                  .reduce((s, h) => s + Number(h.amountCollected || 0), 0)
                                  .toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        
        <div className="rlm-footer">
          <button className="rlm-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}