import React, { useState, useEffect, useCallback } from "react";
import "../../Styles/PaymentCollection/Payment.css";
import PaymentCollect from "./PaymentCollect";
import PaymentView    from "./PaymentView";

const fmt = n => parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const MODES = ["ALL", "CASH", "UPI", "CARD", "CHEQUE"];

const modeBadge = mode => {
  const map = { CASH:"pyx-badge-green", UPI:"pyx-badge-blue", CARD:"pyx-badge-purple", CHEQUE:"pyx-badge-amber" };
  return map[mode] || "pyx-badge-blue";
};

export default function PaymentCollectionPage() {
  const [payments, setPayments]         = useState([]);
  const [outstanding, setOutstanding]   = useState([]);
  const [todayTotal, setTodayTotal]     = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading]           = useState(false);

  const [search, setSearch]             = useState("");
  const [modeFilter, setModeFilter]     = useState("ALL");
  const [fromDate, setFromDate]         = useState("");
  const [toDate, setToDate]             = useState("");
  const [page, setPage]                 = useState(0);
  const SIZE = 10;

  const [showCollect, setShowCollect]   = useState(false);
  const [viewUKey, setViewUKey]         = useState(null);
  const [activeTab, setActiveTab]       = useState("PAYMENTS"); // PAYMENTS | OUTSTANDING

  /* ── FETCH PAYMENTS ── */
  const fetchPayments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), size: String(SIZE),
      ...(search    && { search }),
      ...(modeFilter !== "ALL" && { paymentMode: modeFilter }),
      ...(fromDate  && { fromDate }),
      ...(toDate    && { toDate }),
    });
    fetch(`http://localhost:8080/api/payments?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(json => {
        if (json?.status === 200 && json.data) {
          setPayments(json.data.content || []);
          setTotalPages(json.data.totalPages || 0);
          setTotalElements(json.data.totalElements || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, modeFilter, fromDate, toDate, page]);

  /* ── FETCH TODAY'S COLLECTION ── */
  const fetchToday = () => {
    fetch("http://localhost:8080/api/payments/today-collection", { credentials: "include" })
      .then(r => r.json())
      .then(json => setTodayTotal(json?.data || 0))
      .catch(() => {});
  };

  /* ── FETCH OUTSTANDING ── */
  const fetchOutstanding = () => {
    fetch("http://localhost:8080/api/payments/outstanding", { credentials: "include" })
      .then(r => r.json())
      .then(json => setOutstanding(json?.data || []))
      .catch(() => {});
  };

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { fetchToday(); fetchOutstanding(); }, []);

  const refresh = () => { fetchPayments(); fetchToday(); fetchOutstanding(); };

  const totalOutstanding = outstanding.reduce((s, r) => s + parseFloat(r.outstandingBalance || 0), 0);

  return (
    <div className="pyx-page">

      {/* ── PAGE HEADER ── */}
      <div className="pyx-page-header">
        <div className="pyx-page-title-row">
          <div>
            <h1 className="pyx-page-title">Payment Collections</h1>
            <p className="pyx-page-sub">Track payments received from retailers</p>
          </div>
          <button className="pyx-btn-primary pyx-collect-btn" onClick={() => setShowCollect(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Collect Payment
          </button>
        </div>

        {/* ── SUMMARY CARDS ── */}
        <div className="pyx-summary-cards">
          <div className="pyx-sum-card">
            <span className="pyx-sum-label">Today's collection</span>
            <span className="pyx-sum-value pyx-success">₹{fmt(todayTotal)}</span>
          </div>
          <div className="pyx-sum-card">
            <span className="pyx-sum-label">Total outstanding</span>
            <span className="pyx-sum-value pyx-danger">₹{fmt(totalOutstanding)}</span>
          </div>
          <div className="pyx-sum-card">
            <span className="pyx-sum-label">Retailers with dues</span>
            <span className="pyx-sum-value">{outstanding.length}</span>
          </div>
          <div className="pyx-sum-card">
            <span className="pyx-sum-label">Total records</span>
            <span className="pyx-sum-value">{totalElements}</span>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="pyx-tab-bar">
        {[
          { id: "PAYMENTS",    label: "Payment history" },
          { id: "OUTSTANDING", label: `Outstanding (${outstanding.length})` },
        ].map(t => (
          <button key={t.id} type="button"
            className={`pyx-page-tab ${activeTab === t.id ? "pyx-page-tab-active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {/* ══════════ PAYMENTS TAB ══════════ */}
      {activeTab === "PAYMENTS" && (
        <>
          {/* ── FILTERS ── */}
          <div className="pyx-filters">
            <input className="pyx-filter-search" placeholder="Search retailer, reference…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />

            <div className="pyx-mode-filter">
              {MODES.map(m => (
                <button key={m} type="button"
                  className={`pyx-mode-pill ${modeFilter === m ? "pyx-mode-pill-active" : ""}`}
                  onClick={() => { setModeFilter(m); setPage(0); }}
                >{m}</button>
              ))}
            </div>

            <input type="date" className="pyx-filter-date"
              value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(0); }} />
            <input type="date" className="pyx-filter-date"
              value={toDate} onChange={e => { setToDate(e.target.value); setPage(0); }} />

            {(search || modeFilter !== "ALL" || fromDate || toDate) && (
              <button className="pyx-clear-btn" onClick={() => {
                setSearch(""); setModeFilter("ALL"); setFromDate(""); setToDate(""); setPage(0);
              }}>Clear</button>
            )}
          </div>

          {/* ── TABLE ── */}
          <div className="pyx-table-wrap">
            {loading ? (
              <div className="pyx-table-loading">
                <div className="pyx-loader"><div/><div/><div/><div/></div>
                Loading payments…
              </div>
            ) : payments.length === 0 ? (
              <div className="pyx-empty">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="16" stroke="var(--color-border-secondary)" strokeWidth="1.5"/>
                  <path d="M11 18h14M18 11v14" stroke="var(--color-border-secondary)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <p>No payments found</p>
                <button className="pyx-btn-primary" onClick={() => setShowCollect(true)}>Collect first payment</button>
              </div>
            ) : (
              <table className="pyx-table">
                <thead>
                  <tr>
                    <th>Retailer</th>
                    <th>Invoice</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.uKey}>
                      <td>
                        <div className="pyx-td-main">{p.retailerShopName}</div>
                        <div className="pyx-td-sub">{p.retailerCode}</div>
                      </td>
                      <td>
                        {p.invoiceNumber
                          ? <span className="pyx-inv-tag">{p.invoiceNumber}</span>
                          : <span className="pyx-td-sub">General payment</span>
                        }
                      </td>
                      <td className="pyx-td-amount">₹{fmt(p.amount)}</td>
                      <td><span className={`pyx-badge ${modeBadge(p.paymentMode)}`}>{p.paymentMode}</span></td>
                      <td className="pyx-td-mono">{p.referenceNumber || "—"}</td>
                      <td className="pyx-td-date">{p.paymentDate}</td>
                      <td>
                        <div className="pyx-actions">
                          {/* VIEW */}
                          <button className="pyx-action-btn" title="View details" onClick={() => setViewUKey(p.uKey)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                              <path d="M1.5 7C2.5 4 4.5 2.5 7 2.5S11.5 4 12.5 7c-1 3-3 4.5-5.5 4.5S2.5 10 1.5 7Z" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                          </button>
                          {/* REVERSE */}
                          <button className="pyx-action-btn pyx-action-danger" title="Reverse payment" onClick={() => setViewUKey(p.uKey)}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 5h6a4 4 0 0 1 0 8H5M2 5l3-3M2 5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── PAGINATION ── */}
          {totalPages > 1 && (
            <div className="pyx-pagination">
              <button className="pyx-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span className="pyx-page-info">Page {page + 1} of {totalPages}</span>
              <button className="pyx-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* ══════════ OUTSTANDING TAB ══════════ */}
      {activeTab === "OUTSTANDING" && (
        <div className="pyx-outstanding-list">
          {outstanding.length === 0 ? (
            <div className="pyx-empty">
              <p style={{ color: "var(--color-text-success)" }}>All retailers are cleared. No outstanding dues.</p>
            </div>
          ) : (
            <table className="pyx-table">
              <thead>
                <tr>
                  <th>Retailer</th>
                  <th>Phone</th>
                  <th>Credit limit</th>
                  <th>Outstanding</th>
                  <th>Usage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {outstanding
                  .sort((a, b) => parseFloat(b.outstandingBalance) - parseFloat(a.outstandingBalance))
                  .map(r => {
                    const limit    = parseFloat(r.creditLimit || 0);
                    const used     = parseFloat(r.outstandingBalance || 0);
                    const pct      = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                    const barColor = pct >= 100 ? "var(--color-text-danger)" : pct >= 80 ? "var(--color-text-warning)" : "var(--color-text-success)";
                    return (
                      <tr key={r.retailerId}>
                        <td>
                          <div className="pyx-td-main">{r.shopName}</div>
                          <div className="pyx-td-sub">{r.retailerCode}</div>
                        </td>
                        <td className="pyx-td-mono">{r.phone || "—"}</td>
                        <td className="pyx-td-mono">{limit === 0 ? "Unlimited" : `₹${fmt(limit)}`}</td>
                        <td className="pyx-td-amount pyx-danger">₹{fmt(used)}</td>
                        <td>
                          {limit > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, height: 5, background: "var(--color-background-secondary)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: barColor, minWidth: 34, fontFamily: "var(--font-mono)" }}>{pct.toFixed(0)}%</span>
                            </div>
                          ) : <span className="pyx-td-sub">—</span>}
                        </td>
                        <td>
                          <button className="pyx-btn-collect-sm" onClick={() => {
                            setShowCollect(true);
                          }}>
                            Collect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {showCollect && (
        <PaymentCollect
          onClose={() => setShowCollect(false)}
          onSubmit={() => { setShowCollect(false); refresh(); }}
        />
      )}

      {viewUKey && (
        <PaymentView
          uKey={viewUKey}
          onClose={() => setViewUKey(null)}
          onDelete={() => { setViewUKey(null); refresh(); }}
        />
      )}
    </div>
  );
}
