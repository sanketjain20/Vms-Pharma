import React, { useEffect, useState } from "react";
import "../../Styles/RetailerOutstanding/RetailerLedgerView.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = n =>
  parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

/* ── Info card — identical shape to RetailerView Card ── */
const Card = ({ label, value, mono, accent, danger, full, amber }) => (
  <div className={`rlv-card ${full ? "rlv-card-full" : ""}`}>
    <span className="rlv-label">{label}</span>
    <span
      className={[
        "rlv-value",
        mono   ? "rlv-mono"   : "",
        accent ? "rlv-accent" : "",
        danger ? "rlv-danger" : "",
        amber  ? "rlv-amber"  : "",
      ].filter(Boolean).join(" ")}
    >
      {value ?? <span className="rlv-empty">—</span>}
    </span>
  </div>
);

/* ── Outstanding progress bar (mirrors CreditBar) ── */
const OutstandingBar = ({ totalOutstanding, totalCredit, totalPartial }) => {
  const total   = parseFloat(totalOutstanding || 0);
  const credit  = parseFloat(totalCredit  || 0);
  const partial = parseFloat(totalPartial || 0);
  const creditPct  = total > 0 ? Math.min((credit  / total) * 100, 100) : 0;
  const partialPct = total > 0 ? Math.min((partial / total) * 100, 100) : 0;

  return (
    <div className="rlv-bar-wrap">
      <div className="rlv-bar-labels">
        <span>Outstanding Breakdown</span>
        <span className="rlv-bar-total">₹{fmt(total)} total due</span>
      </div>

      
      <div className="rlv-bar-track">
        <div
          className="rlv-bar-seg rlv-bar-credit"
          style={{ width: `${creditPct}%` }}
          title={`Credit: ₹${fmt(credit)}`}
        />
        <div
          className="rlv-bar-seg rlv-bar-partial"
          style={{ width: `${partialPct}%`, left: `${creditPct}%` }}
          title={`Partial: ₹${fmt(partial)}`}
        />
      </div>

      <div className="rlv-bar-legend">
        <span>
          <span className="rlv-legend-dot rlv-dot-red" />
          Credit: <strong style={{ color: "#fca5a5" }}>₹{fmt(credit)}</strong>
        </span>
        <span>
          <span className="rlv-legend-dot rlv-dot-amber" />
          Partial: <strong style={{ color: "#fbbf24" }}>₹{fmt(partial)}</strong>
        </span>
      </div>
    </div>
  );
};

/* ── Status badge for invoice rows ── */
const StatusBadge = ({ label }) => {
  const map = {
    OVERDUE:  ["rlv-badge-red",   "Overdue" ],
    DUE_SOON: ["rlv-badge-amber", "Due Soon"],
    PENDING:  ["rlv-badge-blue",  "Pending" ],
    PAID:     ["rlv-badge-green", "Paid"    ],
  };
  const [cls, text] = map[label] || map.PENDING;
  return <span className={`rlv-badge ${cls}`}>{text}</span>;
};

/* ── Pay Supplier inline form ── */
const MODES = [
  { val: "CASH", icon: "💵" },
  { val: "UPI",  icon: "📱" },
  { val: "CARD", icon: "💳" },
  { val: "BANK", icon: "🏦" },
];

function PayForm({ invoice, onSuccess, onCancel }) {
  const [amount,     setAmount]     = useState("");
  const [mode,       setMode]       = useState("CASH");
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err,        setErr]        = useState("");

  const max = parseFloat(invoice.remainingAmount || 0);

  const submit = async () => {
    setErr("");
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) { setErr("Enter a valid amount"); return; }
    if (parsed > max + 0.001)                    { setErr(`Cannot exceed ₹${fmt(max)}`); return; }

    setSubmitting(true);
    try {
      const res  = await fetch(
        `${API_BASE_URL}/api/SupplierLedger/CollectPayment`,
        {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purchaseId:      invoice.purchaseId ?? invoice.salesId,
            amountCollected: parsed,
            paymentMode:     mode,
            note:            note.trim() || null,
          }),
        }
      );
      const json = await res.json();
      if (json.status === 200) {
        toast.success(`₹${fmt(parsed)} paid via ${mode}`);
        onSuccess();
      } else {
        setErr(json.message || "Failed to pay");
      }
    } catch (e) {
      setErr("Network error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rlv-cpf">
      <div className="rlv-cpf-top">
        <span className="rlv-cpf-heading">Pay Supplier</span>
        <span className="rlv-cpf-inv-label">{invoice.invoiceNumber}</span>
      </div>

      
      <div className="rlv-cpf-remaining">
        <span>Remaining</span>
        <span className="rlv-cpf-rem-amt">₹{fmt(max)}</span>
      </div>

      
      <span className="rlv-field-label">Amount (₹)</span>
      <div className="rlv-cpf-amt-row">
        <input
          type="number"
          className="rlv-cpf-input"
          placeholder="0.00"
          value={amount}
          min={0.01}
          max={max}
          step={0.01}
          onChange={e => setAmount(e.target.value)}
        />
        <button
          className="rlv-cpf-full-btn"
          onClick={() => setAmount(max.toFixed(2))}
          title="Set full remaining amount"
        >
          Full ₹{fmt(max)}
        </button>
      </div>

      
      <span className="rlv-field-label" style={{ marginTop: 10 }}>Mode</span>
      <div className="rlv-cpf-modes">
        {MODES.map(m => (
          <button
            key={m.val}
            className={`rlv-cpf-mode ${mode === m.val ? "active" : ""}`}
            onClick={() => setMode(m.val)}
          >
            {m.icon} {m.val}
          </button>
        ))}
      </div>

      
      <span className="rlv-field-label" style={{ marginTop: 10 }}>Note (optional)</span>
      <input
        type="text"
        className="rlv-cpf-input"
        placeholder="e.g. Received at counter"
        value={note}
        onChange={e => setNote(e.target.value)}
      />

      {err && <div className="rlv-cpf-err">{err}</div>}

      <div className="rlv-cpf-footer">
        <button className="rlv-btn-ghost" onClick={onCancel}>Cancel</button>
        <button
          className="rlv-btn-collect"
          onClick={submit}
          disabled={submitting}
        >
          {submitting
            ? <><span className="rlv-spinner" /> Processing…</>
            : `Pay ₹${(parseFloat(amount) || 0).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function SupplierLedgerView({ uKey, onClose }) {
  const [ledger,       setLedger]       = useState(null);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("invoices");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [payingId, setPayingId] = useState(null);

  /* ── Fetch ── */
  const fetchLedger = async () => {
    setLoading(true); setError("");
    try {
      const res  = await fetch(
        `${API_BASE_URL}/api/SupplierLedger/Ledger/${uKey}`,
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

  useEffect(() => { if (uKey) fetchLedger(); }, [uKey]);

  /* ── Derived counts ── */
  const overdueCount  = ledger?.invoices?.filter(i => i.statusLabel === "OVERDUE").length  || 0;
  const dueSoonCount  = ledger?.invoices?.filter(i => i.statusLabel === "DUE_SOON").length || 0;
  const pendingCount  = ledger?.invoices?.filter(i => i.statusLabel === "PENDING").length  || 0;
  const paidCount     = ledger?.invoices?.filter(i => i.statusLabel === "PAID").length     || 0;
  const totalHistory  = ledger?.paymentHistory?.reduce(
    (s, h) => s + parseFloat(h.amountCollected || 0), 0
  ) || 0;

  const filteredInvoices = (ledger?.invoices || []).filter(inv => {
    if (filterStatus === "ALL")    return true;
    if (filterStatus === "UNPAID") return inv.statusLabel !== "PAID";
    return inv.statusLabel === filterStatus;
  });

  /* ── Outstanding status label (mirrors CreditBar logic) ── */
  const outstanding = parseFloat(ledger?.totalOutstanding || 0);
  const osStatus = overdueCount > 0
    ? { label: "Has Overdue",  cls: "rlv-badge-red"   }
    : outstanding > 0
    ? { label: "Outstanding",  cls: "rlv-badge-amber" }
    : { label: "All Settled",  cls: "rlv-badge-green" };

  if (!uKey) return null;

  return (
    <div className="rlv-backdrop">
      <div className="rlv-modal">
        <div className="rlv-top-beam" />
        <div className="rlv-corner rlv-tl" /><div className="rlv-corner rlv-tr" />
        <div className="rlv-corner rlv-bl" /><div className="rlv-corner rlv-br" />

        
        <div className="rlv-header">
          <div className="rlv-header-left">
            <div className="rlv-eyebrow">
              <span className="rlv-eyebrow-dot" />
              SUPPLIER LEDGER
            </div>
            <h3 className="rlv-title">
              <span className="rlv-title-acc"></span>
              {ledger ? ledger.shopName : "Loading…"}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {ledger && (
              <div className="rlv-outstanding-pill">
                <span className="rlv-op-label">Outstanding</span>
                <span className="rlv-op-amount">₹{fmt(ledger.totalOutstanding)}</span>
              </div>
            )}
            <button className="rlv-close" onClick={onClose}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              ESC
            </button>
          </div>
        </div>

        <div className="rlv-divider" />

        
        <div className="rlv-body">

          
          {loading && (
            <div className="rlv-loading">
              <div className="rlv-loader"><div/><div/><div/><div/></div>
              Loading ledger data…
            </div>
          )}

          
          {error && <div className="rlv-alert">{error}</div>}

          
          {!loading && !error && ledger && (
            <>
              
              <div className="rlv-status-row">
                <span className="rlv-code-badge">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M3 5h4M3 3.5h2M3 6.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  {ledger.supplierCode}
                </span>
                <span className={`rlv-badge ${osStatus.cls}`}>{osStatus.label}</span>
                {overdueCount > 0 && (
                  <span className="rlv-badge rlv-badge-red">
                    {overdueCount} Overdue Invoice{overdueCount > 1 ? "s" : ""}
                  </span>
                )}
                {dueSoonCount > 0 && (
                  <span className="rlv-badge rlv-badge-amber">
                    {dueSoonCount} Due Soon
                  </span>
                )}
              </div>

              
              <OutstandingBar
                totalOutstanding={ledger.totalOutstanding}
                totalCredit={ledger.invoices?.filter(i => i.paymentType === "CREDIT")
                  .reduce((s, i) => s + parseFloat(i.remainingAmount || 0), 0)}
                totalPartial={ledger.invoices?.filter(i => i.paymentType === "PARTIAL")
                  .reduce((s, i) => s + parseFloat(i.remainingAmount || 0), 0)}
              />

              
              <div className="rlv-view-grid">
                <Card label="Shop Name"     value={ledger.shopName} />
                <Card label="Owner Name"    value={ledger.ownerName} />
                <Card label="Phone"         value={ledger.phone} mono />
                <Card label="Supplier Code" value={ledger.supplierCode} mono accent />
                <Card
                  label="Total Outstanding"
                  value={`₹${fmt(ledger.totalOutstanding)}`}
                  danger={outstanding > 0}
                  mono
                />
                <Card
                  label="Total Paid"
                  value={`₹${fmt(totalHistory)}`}
                  accent
                  mono
                />
                <Card
                  label="Unpaid Invoices"
                  value={ledger.invoices?.filter(i => i.statusLabel !== "PAID").length || 0}
                  amber={overdueCount > 0}
                />
                <Card
                  label="Payment Entries"
                  value={ledger.paymentHistory?.length || 0}
                />
              </div>

              
              <div className="rlv-tabs">
                {[
                  { key: "invoices", label: "Invoices",
                    count: ledger.invoices?.length || 0 },
                  { key: "history",  label: "Payment History",
                    count: ledger.paymentHistory?.length || 0 },
                ].map(t => (
                  <button
                    key={t.key}
                    className={`rlv-tab ${activeTab === t.key ? "active" : ""}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label}
                    <span className="rlv-tab-count">{t.count}</span>
                  </button>
                ))}
              </div>

              
              {activeTab === "invoices" && (
                <div className="rlv-tab-body">

                  
                  <div className="rlv-pills">
                    {[
                      { k: "ALL",      label: "All",       count: ledger.invoices?.length || 0 },
                      { k: "UNPAID",   label: "Unpaid",
                        count: ledger.invoices?.filter(i => i.statusLabel !== "PAID").length || 0 },
                      { k: "OVERDUE",  label: "Overdue",   count: overdueCount  },
                      { k: "DUE_SOON", label: "Due Soon",  count: dueSoonCount  },
                      { k: "PENDING",  label: "Pending",   count: pendingCount  },
                      { k: "PAID",     label: "Paid",      count: paidCount     },
                    ].map(p => (
                      <button
                        key={p.k}
                        className={`rlv-pill ${filterStatus === p.k ? "active" : ""}`}
                        onClick={() => setFilterStatus(p.k)}
                      >
                        {p.label}
                        <span className="rlv-pill-count">{p.count}</span>
                      </button>
                    ))}
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className="rlv-empty">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                        <path d="M10 14h8" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p>No invoices match this filter</p>
                    </div>
                  ) : (
                    <div className="rlv-invoice-list">
                      {filteredInvoices.map((inv, idx) => (
                        <div key={idx}>
                          <div
                            className={[
                              "rlv-inv-row",
                              inv.statusLabel === "OVERDUE"  ? "rlv-inv-overdue"   : "",
                              inv.statusLabel === "DUE_SOON" ? "rlv-inv-due-soon"  : "",
                              inv.statusLabel === "PAID"     ? "rlv-inv-paid"      : "",
                              payingId === (inv.purchaseId ?? inv.salesId)   ? "rlv-inv-collecting": "",
                            ].filter(Boolean).join(" ")}
                            style={{ animationDelay: `${idx * 0.03}s` }}
                          >
                            
                            <div className="rlv-inv-left">
                              <div className="rlv-inv-number">{inv.invoiceNumber}</div>
                              <div className="rlv-inv-sub">
                                <span>{inv.invoiceDate || "—"}</span>
                                {inv.dueDate && (
                                  <>
                                    <span className="rlv-sep">·</span>
                                    <span className={inv.isOverdue ? "rlv-danger" : ""}>
                                      Due {inv.dueDate}
                                    </span>
                                  </>
                                )}
                                <span className="rlv-sep">·</span>
                                <span className="rlv-inv-type-tag">{inv.paymentType}</span>
                              </div>
                            </div>

                            
                            <div className="rlv-inv-amounts">
                              <div className="rlv-inv-amt-block">
                                <span className="rlv-amt-label">Invoice</span>
                                <span className="rlv-amt-val">
                                  ₹{fmt(inv.netAmount)}
                                </span>
                              </div>
                              <div className="rlv-inv-amt-block">
                                <span className="rlv-amt-label">Paid</span>
                                <span className="rlv-amt-val rlv-accent">
                                  ₹{fmt(inv.amountPaid)}
                                </span>
                              </div>
                              <div className="rlv-inv-amt-block">
                                <span className="rlv-amt-label">Due</span>
                                <span className={`rlv-amt-val ${
                                  inv.statusLabel === "OVERDUE" ? "rlv-danger"
                                  : inv.statusLabel === "PAID"  ? "rlv-accent"
                                  : "rlv-amber"
                                }`}>
                                  ₹{fmt(inv.remainingAmount)}
                                </span>
                              </div>
                            </div>

                            
                            <div className="rlv-inv-right">
                              <StatusBadge label={inv.statusLabel} />
                              {inv.statusLabel !== "PAID" && payingId !== (inv.purchaseId ?? inv.salesId) && (
                                <button
                                  className="rlv-collect-btn"
                                  onClick={() => setPayingId(inv.purchaseId ?? inv.salesId)}
                                >
                                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                    <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
                                    <path d="M5.5 3.5v4M3.5 5.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                  </svg>
                                  Pay
                                </button>
                              )}
                            </div>
                          </div>

                          
                          {payingId === (inv.purchaseId ?? inv.salesId) && (
                            <PayForm
                              invoice={inv}
                              onSuccess={() => { setPayingId(null); fetchLedger(); }}
                              onCancel={() => setPayingId(null)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              
              {activeTab === "history" && (
                <div className="rlv-tab-body">
                  {!ledger.paymentHistory?.length ? (
                    <div className="rlv-empty">
                      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <circle cx="14" cy="14" r="12" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                        <path d="M10 14h8" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      <p>No payment history yet</p>
                    </div>
                  ) : (
                    <>
                      
                      <div className="rlv-history-summary">
                        <div className="rlv-hs-block">
                          <span className="rlv-hs-label">Total Paid</span>
                          <span className="rlv-hs-val rlv-accent">₹{fmt(totalHistory)}</span>
                        </div>
                        <div className="rlv-hs-block">
                          <span className="rlv-hs-label">Entries</span>
                          <span className="rlv-hs-val">{ledger.paymentHistory.length}</span>
                        </div>
                        <div className="rlv-hs-block">
                          <span className="rlv-hs-label">Last Paid</span>
                          <span className="rlv-hs-val">
                            {ledger.paymentHistory[0]?.paymentDate || "—"}
                          </span>
                        </div>
                      </div>

                      
                      <div className="rlv-hist-table-wrap">
                        <table className="rlv-hist-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Purchase</th>
                              <th>Date</th>
                              <th>Mode</th>
                              <th>Paid By</th>
                              <th>Note</th>
                              <th>Amount (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ledger.paymentHistory.map((ph, idx) => (
                              <tr
                                key={idx}
                                style={{ animationDelay: `${idx * 0.025}s` }}
                              >
                                <td className="rlv-td-dim">
                                  {String(idx + 1).padStart(2, "0")}
                                </td>
                                <td className="rlv-td-mono rlv-accent">
                                  {ph.purchaseNumber || "—"}
                                </td>
                                <td className="rlv-td-dim">{ph.paymentDate || "—"}</td>
                                <td>
                                  <span className="rlv-mode-tag">
                                    {ph.paymentMode === "CASH" ? "💵"
                                    : ph.paymentMode === "UPI"  ? "📱"
                                    : ph.paymentMode === "CARD" ? "💳" : "🏦"}
                                    {ph.paymentMode}
                                  </span>
                                </td>
                                <td className="rlv-td-dim">
                                  {ph.collectedBy || "—"}
                                </td>
                                <td className="rlv-td-dim">
                                  {ph.notes || <span className="rlv-empty">—</span>}
                                </td>
                                <td className="rlv-td-amount">
                                  ₹{fmt(ph.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={6} className="rlv-tf-label">
                                Total Paid
                              </td>
                              <td className="rlv-tf-total">₹{fmt(totalHistory)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        
        {ledger && (
          <div className="rlv-footer">
            <button className="rlv-btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}