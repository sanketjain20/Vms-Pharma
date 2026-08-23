import React, { useEffect, useState } from "react";
import "../../Styles/CommonAEUDForm/FormShell.css";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = n =>
  parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const STATUS_TONE = {
  OVERDUE:  { bg: "var(--afx-danger-soft)",  fg: "var(--afx-danger)",  label: "Overdue"  },
  DUE_SOON: { bg: "var(--afx-warning-soft)", fg: "var(--afx-warning)", label: "Due Soon" },
  PENDING:  { bg: "var(--afx-accent-soft)",  fg: "var(--afx-accent)",  label: "Pending"  },
  PAID:     { bg: "var(--afx-success-soft)", fg: "var(--afx-success)", label: "Paid"     },
};

/* ── Info card — reuses the shared afx-meta-card primitive ── */
const Card = ({ label, value, mono, accent, danger, amber }) => {
  const color = danger ? "var(--afx-danger)" : accent ? "var(--afx-accent)" : amber ? "var(--afx-warning)" : undefined;
  return (
    <div className="afx-meta-card">
      <span className="afx-meta-card-label">{label}</span>
      <span
        className="afx-meta-card-val"
        style={{ color, fontFamily: mono ? "var(--afx-font-mono)" : undefined }}
      >
        {value ?? <span className="afx-view-value--empty">—</span>}
      </span>
    </div>
  );
};

/* ── Outstanding progress bar (credit vs partial breakdown) ── */
const OutstandingBar = ({ totalOutstanding, totalCredit, totalPartial }) => {
  const total   = parseFloat(totalOutstanding || 0);
  const credit  = parseFloat(totalCredit  || 0);
  const partial = parseFloat(totalPartial || 0);
  const creditPct  = total > 0 ? Math.min((credit  / total) * 100, 100) : 0;
  const partialPct = total > 0 ? Math.min((partial / total) * 100, 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, color: "var(--afx-text-2)" }}>
        <span>Outstanding Breakdown</span>
        <span style={{ fontFamily: "var(--afx-font-mono)", color: "var(--afx-text-1)" }}>₹{fmt(total)} total due</span>
      </div>

      <div style={{ position: "relative", height: 8, borderRadius: 999, background: "var(--afx-sunken)", border: "1px solid var(--afx-border)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, left: 0, width: `${creditPct}%`, background: "var(--afx-danger)" }} title={`Credit: ₹${fmt(credit)}`} />
        <div style={{ position: "absolute", inset: 0, left: `${creditPct}%`, width: `${partialPct}%`, background: "var(--afx-warning)" }} title={`Partial: ₹${fmt(partial)}`} />
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "var(--afx-text-2)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--afx-danger)", display: "inline-block" }} />
          Credit: <strong style={{ color: "var(--afx-danger)" }}>₹{fmt(credit)}</strong>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--afx-warning)", display: "inline-block" }} />
          Partial: <strong style={{ color: "var(--afx-warning)" }}>₹{fmt(partial)}</strong>
        </span>
      </div>
    </div>
  );
};

/* ── Status badge for invoice rows ── */
const StatusBadge = ({ label }) => {
  const tone = STATUS_TONE[label] || STATUS_TONE.PENDING;
  return (
    <span className="afx-badge" style={{ background: tone.bg, color: tone.fg }}>
      {tone.label}
    </span>
  );
};

/* ── Collect Payment inline form ── */
const MODES = [
  { val: "CASH", icon: "💵" },
  { val: "UPI",  icon: "📱" },
  { val: "CARD", icon: "💳" },
  { val: "BANK", icon: "🏦" },
];

function CollectForm({ invoice, onSuccess, onCancel }) {
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
      const res  = await apiClient(
        `${API_BASE_URL}/api/RetailerLedger/CollectPayment`,
        {
          method: "POST",
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
        toast.success(`₹${fmt(parsed)} collected via ${mode}`);
        onSuccess();
      } else {
        setErr(json.message || "Failed to collect");
      }
    } catch (e) {
      setErr("Network error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="afx-card" style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="afx-section-title" style={{ paddingTop: 0 }}>Collect Payment</span>
        <span style={{ fontFamily: "var(--afx-font-mono)", fontSize: 11.5, color: "var(--afx-text-3)" }}>{invoice.invoiceNumber}</span>
      </div>

      <div className="afx-card-row">
        <span>Remaining</span>
        <strong style={{ fontFamily: "var(--afx-font-mono)" }}>₹{fmt(max)}</strong>
      </div>

      <div className="afx-field">
        <label className="afx-label">Amount (₹)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            className="afx-input"
            placeholder="0.00"
            value={amount}
            min={0.01}
            max={max}
            step={0.01}
            onChange={e => setAmount(e.target.value)}
          />
          <button
            type="button"
            className="afx-btn"
            style={{ whiteSpace: "nowrap" }}
            onClick={() => setAmount(max.toFixed(2))}
            title="Set full remaining amount"
          >
            Full ₹{fmt(max)}
          </button>
        </div>
      </div>

      <div className="afx-field">
        <label className="afx-label">Mode</label>
        <div className="afx-seg-row">
          {MODES.map(m => (
            <button
              key={m.val}
              type="button"
              className={`afx-seg-btn ${mode === m.val ? "is-active" : ""}`}
              onClick={() => setMode(m.val)}
            >
              {m.icon} {m.val}
            </button>
          ))}
        </div>
      </div>

      <div className="afx-field">
        <label className="afx-label">Note (optional)</label>
        <input
          type="text"
          className="afx-input"
          placeholder="e.g. Received at counter"
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      {err && <div className="afx-error">{err}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button type="button" className="afx-btn" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="afx-btn afx-btn--primary"
          onClick={submit}
          disabled={submitting}
        >
          {submitting
            ? <><span className="afx-spinner" /> Processing…</>
            : `Collect ₹${(parseFloat(amount) || 0).toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function RetailerLedgerView({ uKey, onClose }) {
  const [ledger,       setLedger]       = useState(null);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState("invoices");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [collectingId, setCollectingId] = useState(null);

  /* ── Fetch ── */
  const fetchLedger = async () => {
    setLoading(true); setError("");
    try {
      const res  = await apiClient(
        `${API_BASE_URL}/api/RetailerLedger/Ledger/${uKey}`,
        { method: "GET" }
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

  /* ── Outstanding status label ── */
  const outstanding = parseFloat(ledger?.totalOutstanding || 0);
  const osStatus = overdueCount > 0
    ? { label: "Has Overdue", tone: STATUS_TONE.OVERDUE }
    : outstanding > 0
    ? { label: "Outstanding", tone: STATUS_TONE.DUE_SOON }
    : { label: "All Settled", tone: STATUS_TONE.PAID };

  if (!uKey) return null;

  return (
    <div className="afx-backdrop">
      <div className="afx-modal afx-modal--xl">
        <div className="afx-header">
          <div>
            <div className="afx-eyebrow"><span className="afx-eyebrow-dot" />Retailer Ledger</div>
            <h3 className="afx-title">{ledger ? ledger.shopName : "Loading…"}</h3>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {ledger && (
              <span className="afx-badge" style={{ background: "var(--afx-accent-soft)", color: "var(--afx-accent)" }}>
                Outstanding&nbsp;₹{fmt(ledger.totalOutstanding)}
              </span>
            )}
            <button className="afx-close" onClick={onClose} title="Close">
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none"><path d="M1 1L10 10M10 1L1 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              ESC
            </button>
          </div>
        </div>

        <div className="afx-body">
          {loading && (
            <div className="afx-loading">
              <div className="afx-loader-ring"><div/><div/><div/></div>
            </div>
          )}

          {error && <div className="afx-alert">{error}</div>}

          {!loading && !error && ledger && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span className="afx-badge">{ledger.retailerCode}</span>
                <span className="afx-badge" style={{ background: osStatus.tone.bg, color: osStatus.tone.fg }}>{osStatus.label}</span>
                {overdueCount > 0 && (
                  <span className="afx-badge" style={{ background: "var(--afx-danger-soft)", color: "var(--afx-danger)" }}>
                    {overdueCount} Overdue Invoice{overdueCount > 1 ? "s" : ""}
                  </span>
                )}
                {dueSoonCount > 0 && (
                  <span className="afx-badge" style={{ background: "var(--afx-warning-soft)", color: "var(--afx-warning)" }}>
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

              <div className="afx-meta-cards">
                <Card label="Shop Name"     value={ledger.shopName} />
                <Card label="Owner Name"    value={ledger.ownerName} />
                <Card label="Phone"         value={ledger.phone} mono />
                <Card label="Retailer Code" value={ledger.retailerCode} mono accent />
                <Card
                  label="Total Outstanding"
                  value={`₹${fmt(ledger.totalOutstanding)}`}
                  danger={outstanding > 0}
                  mono
                />
                <Card
                  label="Total Collected"
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

              <div className="afx-tabs">
                {[
                  { key: "invoices", label: "Invoices",       count: ledger.invoices?.length || 0 },
                  { key: "history",  label: "Payment History", count: ledger.paymentHistory?.length || 0 },
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    className={`afx-tab ${activeTab === t.key ? "is-active" : ""}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {activeTab === "invoices" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="afx-seg-row">
                    {[
                      { k: "ALL",      label: "All",      count: ledger.invoices?.length || 0 },
                      { k: "UNPAID",   label: "Unpaid",   count: ledger.invoices?.filter(i => i.statusLabel !== "PAID").length || 0 },
                      { k: "OVERDUE",  label: "Overdue",  count: overdueCount  },
                      { k: "DUE_SOON", label: "Due Soon", count: dueSoonCount  },
                      { k: "PENDING",  label: "Pending",  count: pendingCount  },
                      { k: "PAID",     label: "Paid",     count: paidCount     },
                    ].map(p => (
                      <button
                        key={p.k}
                        type="button"
                        className={`afx-seg-btn ${filterStatus === p.k ? "is-active" : ""}`}
                        onClick={() => setFilterStatus(p.k)}
                      >
                        {p.label} ({p.count})
                      </button>
                    ))}
                  </div>

                  {filteredInvoices.length === 0 ? (
                    <div className="afx-items-empty">
                      <p>No invoices match this filter</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {filteredInvoices.map((inv, idx) => (
                        <div key={idx}>
                          <div className="afx-option-row" style={{ justifyContent: "space-between" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--afx-text-1)" }}>{inv.invoiceNumber}</div>
                              <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: "var(--afx-text-3)", flexWrap: "wrap" }}>
                                <span>{inv.invoiceDate || "—"}</span>
                                {inv.dueDate && (
                                  <>
                                    <span>·</span>
                                    <span style={{ color: inv.isOverdue ? "var(--afx-danger)" : undefined }}>Due {inv.dueDate}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{inv.paymentType}</span>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 18 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                                <span style={{ fontSize: 10, color: "var(--afx-text-3)" }}>Invoice</span>
                                <span style={{ fontFamily: "var(--afx-font-mono)", fontSize: 12.5 }}>₹{fmt(inv.netAmount)}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                                <span style={{ fontSize: 10, color: "var(--afx-text-3)" }}>Paid</span>
                                <span style={{ fontFamily: "var(--afx-font-mono)", fontSize: 12.5, color: "var(--afx-accent)" }}>₹{fmt(inv.amountPaid)}</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                                <span style={{ fontSize: 10, color: "var(--afx-text-3)" }}>Due</span>
                                <span style={{
                                  fontFamily: "var(--afx-font-mono)", fontSize: 12.5,
                                  color: inv.statusLabel === "OVERDUE" ? "var(--afx-danger)"
                                    : inv.statusLabel === "PAID" ? "var(--afx-accent)" : "var(--afx-warning)",
                                }}>₹{fmt(inv.remainingAmount)}</span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <StatusBadge label={inv.statusLabel} />
                              {inv.statusLabel !== "PAID" && collectingId !== inv.salesId && (
                                <button
                                  type="button"
                                  className="afx-btn afx-btn--primary"
                                  style={{ padding: "6px 12px" }}
                                  onClick={() => setCollectingId(inv.salesId)}
                                >
                                  Collect
                                </button>
                              )}
                            </div>
                          </div>

                          {collectingId === inv.salesId && (
                            <CollectForm
                              invoice={inv}
                              onSuccess={() => { setCollectingId(null); fetchLedger(); }}
                              onCancel={() => setCollectingId(null)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {!ledger.paymentHistory?.length ? (
                    <div className="afx-items-empty">
                      <p>No payment history yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="afx-meta-cards" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                        <div className="afx-meta-card">
                          <span className="afx-meta-card-label">Total Collected</span>
                          <span className="afx-meta-card-val" style={{ color: "var(--afx-accent)" }}>₹{fmt(totalHistory)}</span>
                        </div>
                        <div className="afx-meta-card">
                          <span className="afx-meta-card-label">Entries</span>
                          <span className="afx-meta-card-val">{ledger.paymentHistory.length}</span>
                        </div>
                        <div className="afx-meta-card">
                          <span className="afx-meta-card-label">Last Received</span>
                          <span className="afx-meta-card-val">{ledger.paymentHistory[0]?.collectedAt || "—"}</span>
                        </div>
                      </div>

                      <div className="afx-line-table">
                        <table>
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
                              <tr key={idx}>
                                <td style={{ color: "var(--afx-text-3)" }}>{String(idx + 1).padStart(2, "0")}</td>
                                <td style={{ fontFamily: "var(--afx-font-mono)", color: "var(--afx-accent)" }}>{ph.invoiceNumber || "—"}</td>
                                <td style={{ color: "var(--afx-text-3)" }}>{ph.collectedAt || "—"}</td>
                                <td>
                                  {ph.paymentMode === "CASH" ? "💵"
                                  : ph.paymentMode === "UPI"  ? "📱"
                                  : ph.paymentMode === "CARD" ? "💳" : "🏦"}
                                  {" "}{ph.paymentMode}
                                </td>
                                <td style={{ color: "var(--afx-text-3)" }}>{ph.collectedBy || "—"}</td>
                                <td style={{ color: "var(--afx-text-3)" }}>{ph.note || "—"}</td>
                                <td className="afx-line-total">₹{fmt(ph.amountCollected)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, color: "var(--afx-text-1)" }}>Total Collected</td>
                              <td className="afx-line-total">₹{fmt(totalHistory)}</td>
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
          <div className="afx-footer">
            <button className="afx-btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
