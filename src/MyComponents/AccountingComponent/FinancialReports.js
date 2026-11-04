import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { money, showDate, isoDate, searchRows, fyStartYear } from "../../utils/accounting";
import { Kpi, Nothing } from "./AccountingReports";
import { ExportButtons } from "./BooksAdmin";

const call = async (url, body) => {
  const res = await apiClient(`${API_BASE_URL}/api/Accounting/${url}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  return res.json().catch(() => null);
};

const SECTION_NOTE = {
  Operating: "Customers, suppliers, expenses, GST and other income",
  Investing: "Furniture, equipment and deposits bought or sold",
  Financing: "Capital brought in, drawings and loans",
};

/** Where the cash and bank money came from and went over the period: operating, investing and financing. */
export function CashFlowView({ data }) {
  const sections = data?.sections || [];
  const net = Number(data?.netChange || 0);
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Opening cash & bank" figure={money(data?.openingBalance)} testId="cf-opening" />
        <Kpi label="Net change" figure={money(net)} tone={net < 0 ? "out" : "in"} testId="cf-net" />
        <Kpi label="Closing cash & bank" figure={money(data?.closingBalance)} testId="cf-closing"
          tone={data?.agrees ? "good" : "bad"} note={data?.agrees ? "Agrees with the cash and bank books" : `The books say ${money(data?.booksClosing)}`} />
      </div>
      {sections.every((s) => !(s.lines || []).length) ? <Nothing>No money came in or went out in this period.</Nothing> : (
        <section className="acx-stmt" data-testid="cf-statement" aria-label="Cash flow statement">
          <ul className="acx-lines">
            <li className="acx-stmt-sub"><span>Opening cash &amp; bank</span><span className="acx-num">{money(data?.openingBalance)}</span></li>
            {sections.map((s) => (
              <React.Fragment key={s.name}>
                <li className="acx-stmt-head" title={SECTION_NOTE[s.name]}><span>{s.name} activities</span><span /></li>
                {(s.lines || []).length === 0 ? <li className="acx-stmt-item acx-muted"><span>Nothing</span><span /></li>
                  : s.lines.map((l) => <li key={l.label} className="acx-stmt-item"><span>{l.label}</span><span className="acx-num">{money(l.amount)}</span></li>)}
                <li className="acx-stmt-sub" data-testid={`cf-${s.name.toLowerCase()}`}><span>Net cash from {s.name.toLowerCase()}</span><span className="acx-num">{money(s.total)}</span></li>
              </React.Fragment>
            ))}
          </ul>
          <div className="acx-side-sum"><span>Closing cash &amp; bank</span><span className="acx-num">{money(data?.closingBalance)}</span></div>
        </section>
      )}
    </>
  );
}

/** GST month by month: output (sales less credit notes), input (purchases less debit notes), net liability, set-off and paid. */
export function GstLiabilityView({ data }) {
  const months = data?.months || [];
  const t = data?.total;
  const p = data?.position;
  const label = (m) => {
    if (m === "Total") return "Total";
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Net output GST" figure={money(t?.netOutput)} testId="gl-output" note="Sales less credit notes" />
        <Kpi label="Net input GST" figure={money(t?.netInput)} testId="gl-input" note="Purchases less debit notes" />
        <Kpi label="Net liability" figure={money(t?.netLiability)} tone={Number(t?.netLiability) > 0 ? "out" : "in"} testId="gst-net"
          note={Number(t?.netLiability) < 0 ? "More input than output in this period" : "Output less input for the period"} />
        <Kpi label="Still to pay" figure={money(Number(p?.payableAfterSetOff || 0) + Number(p?.gstPayable || 0))} testId="gst-due"
          note={`As at ${showDate(p?.asAt)} · set off ${money(t?.setOff)}, paid ${money(t?.paid)} in the period`} />
      </div>
      {months.length === 0 ? <Nothing>No GST in this period.</Nothing> : (
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="gst-table">
            <thead><tr><th>Month</th><th className="acx-num">Output on sales</th><th className="acx-num">Credit notes</th><th className="acx-num">Input on purchases</th>
              <th className="acx-num">Debit notes</th><th className="acx-num">Net liability</th><th className="acx-num">Set off</th><th className="acx-num">Paid</th></tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <td className="acx-nowrap">{label(m.month)}</td>
                  <td className="acx-num">{money(m.outputOnSales)}</td>
                  <td className="acx-num">{money(-Number(m.outputOnReturns || 0))}</td>
                  <td className="acx-num">{money(m.inputOnPurchases)}</td>
                  <td className="acx-num">{money(-Number(m.inputOnReturns || 0))}</td>
                  <td className={`acx-num acx-strong ${Number(m.netLiability) < 0 ? "acx-in" : ""}`}>{money(m.netLiability)}</td>
                  <td className="acx-num">{money(m.setOff)}</td>
                  <td className="acx-num">{money(m.paid)}</td>
                </tr>
              ))}
            </tbody>
            {t && <tfoot><tr><td>Total</td><td className="acx-num">{money(t.outputOnSales)}</td><td className="acx-num">{money(-Number(t.outputOnReturns || 0))}</td>
              <td className="acx-num">{money(t.inputOnPurchases)}</td><td className="acx-num">{money(-Number(t.inputOnReturns || 0))}</td>
              <td className="acx-num">{money(t.netLiability)}</td><td className="acx-num">{money(t.setOff)}</td><td className="acx-num">{money(t.paid)}</td></tr></tfoot>}
          </table>
        </div>
      )}
      <p className="acx-hint">Compare these with GSTR-1 (output) and GSTR-2B (eligible input) before filing GSTR-3B; set off and pay on the Vouchers tab.</p>
    </>
  );
}

const BUCKETS = [["upTo30", "0–30 days"], ["days31to60", "31–60 days"], ["days61to90", "61–90 days"], ["over90", "Over 90 days"]];

/** Who owes the shop (or whom it owes), by the age of each unpaid bill, with what is past its due date. */
export function Ageing({ canExport = false }) {
  const [kind, setKind] = useState("RECEIVABLE");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let live = true;
    setData(null); setError(""); setOpen(null);
    call("Ageing", { group: kind }).then((json) => {
      if (!live) return;
      if (json?.status === 200) setData(json.data); else setError(json?.message || "Could not load the ageing.");
    }).catch(() => live && setError("Could not load the ageing. Check the connection and try again."));
    return () => { live = false; };
  }, [kind]);

  const parties = data?.parties || [];
  const shown = searchRows(parties, query, ["party"]);
  const diff = Number(data?.difference || 0);
  const payable = kind === "PAYABLE";
  return (
    <>
      <div className="acx-tools">
        <div className="acx-chips" role="group" aria-label="Receivables or payables">
          {[["RECEIVABLE", "Receivables"], ["PAYABLE", "Payables"]].map(([k, n]) => (
            <button key={k} type="button" className={`acx-chip acx-chip-primary ${kind === k ? "is-on" : ""}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{n}</button>
          ))}
        </div>
        <span className="acx-hint">As of today, by the age of each unpaid bill</span>
        {canExport && <ExportButtons report="ageing" params={{ group: kind }} />}
      </div>
      {error ? <div className="acx-err" role="alert">{error}</div> : !data ? <div className="acx-loading" aria-busy="true"><span /><span /><span /></div> : (
        <>
          <div className="acx-kpis">
            <Kpi label={payable ? "Owed to suppliers" : "Owed by customers"} figure={money(data.total)} testId="ag-total" note={`${parties.length} ${payable ? "supplier" : "part"}${payable ? (parties.length === 1 ? "" : "s") : (parties.length === 1 ? "y" : "ies")}`} />
            <Kpi label="Overdue" figure={money(data.overdue)} tone={Number(data.overdue) > 0 ? "bad" : "good"} testId="ag-overdue" note="Past the due date" />
            <Kpi label="Over 90 days" figure={money(data.over90)} tone={Number(data.over90) > 0 ? "out" : undefined} testId="ag-90" />
            <Kpi label={`${payable ? "Payable" : "Receivable"} in the books`} figure={money(data.ledgerBalance)} testId="ag-ledger"
              tone={Math.abs(diff) < 0.005 ? "good" : "bad"} note={Math.abs(diff) < 0.005 ? "Matches the unpaid bills" : `Bills differ by ${money(diff)} (opening balances, advances or unallocated payments)`} />
          </div>
          {parties.length === 0 ? <Nothing>{payable ? "Nothing is owed to suppliers." : "No customer owes anything."}</Nothing> : (
            <>
              <div className="acx-tools">
                <input className="acx-search" type="search" placeholder={payable ? "Search supplier…" : "Search customer…"} aria-label="Search parties" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <span className="acx-found">{shown.length} of {parties.length}</span>}
              </div>
              <div className="acx-scroll">
                <table className="acx-tbl" data-testid="ag-table">
                  <thead><tr><th>{payable ? "Supplier" : "Customer"}</th>{BUCKETS.map(([, n]) => <th key={n} className="acx-num">{n}</th>)}<th className="acx-num">Total</th><th className="acx-num">Overdue</th></tr></thead>
                  <tbody>
                    {shown.map((p) => (
                      <React.Fragment key={p.party}>
                        <tr className={open === p.party ? "acx-open" : ""}>
                          <td><button type="button" className="acx-link" aria-expanded={open === p.party} onClick={() => setOpen(open === p.party ? null : p.party)}>{p.party}</button></td>
                          {BUCKETS.map(([k]) => <td key={k} className="acx-num">{Number(p[k]) ? money(p[k]) : ""}</td>)}
                          <td className="acx-num acx-strong">{money(p.total)}</td>
                          <td className={`acx-num ${Number(p.overdue) > 0 ? "acx-out" : ""}`}>{Number(p.overdue) ? money(p.overdue) : ""}</td>
                        </tr>
                        {open === p.party && (
                          <tr className="acx-drawer"><td colSpan={7}>
                            <table className="acx-tbl acx-subtbl" data-testid="ag-bills">
                              <thead><tr><th>Bill</th><th>Date</th><th>Due</th><th className="acx-num">Days</th><th className="acx-num">Bill amount</th><th className="acx-num">Unpaid</th></tr></thead>
                              <tbody>
                                {p.bills.map((b) => (
                                  <tr key={b.reference}>
                                    <td className="acx-ref">{b.reference}</td>
                                    <td className="acx-nowrap">{showDate(b.date)}</td>
                                    <td className="acx-nowrap">{b.dueDate ? showDate(b.dueDate) : "—"}{b.overdueDays > 0 && <span className="acx-pill acx-pill--warn"> {b.overdueDays} days overdue</span>}</td>
                                    <td className="acx-num">{b.ageDays < 0 ? "—" : b.ageDays}</td>
                                    <td className="acx-num">{money(b.amount)}</td>
                                    <td className="acx-num acx-strong">{money(b.outstanding)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total</td>{BUCKETS.map(([k]) => <td key={k} className="acx-num">{money(data[k])}</td>)}<td className="acx-num">{money(data.total)}</td><td className="acx-num">{money(data.overdue)}</td></tr></tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

/** The last day of the last financial year (31 March), the usual day to close the books up to. */
export const lastYearEnd = (today = new Date()) => `${fyStartYear(today)}-03-31`;

/** Close the books up to a day (no voucher can be posted on or before it), reopen with a reason, and the history. */
export function PeriodClosing({ can, onChanged }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [closeTo, setCloseTo] = useState(lastYearEnd());
  const [note, setNote] = useState("");
  const [reopenTo, setReopenTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = can("Close Books");

  const load = useCallback(async () => {
    try {
      const json = await call("PeriodClose");
      if (json?.status === 200) { setStatus(json.data); setError(""); } else setError(json?.message || "Could not load the closing.");
    } catch { setError("Could not load the closing. Check the connection and try again."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (url, body, done) => {
    setBusy(true);
    try {
      const json = await call(url, body);
      if (json?.status === 200) { setStatus(json.data); toast.success(done(json.data)); onChanged?.(); }
      else toast.error(json?.message || "That didn't work.");
    } catch { toast.error("That didn't work. Check the connection and try again."); }
    finally { setBusy(false); }
  };
  const close = () => {
    if (!window.confirm(`Close the books up to ${showDate(closeTo)}? No voucher can then be posted on or before that day.`)) return;
    act("PeriodClose", { toDate: closeTo, reason: note.trim() || null }, (s) => `Books closed up to ${showDate(s.closedUntil)}.`);
  };
  const reopen = () => act("PeriodReopen", { toDate: reopenTo || null, reason }, (s) => (s.closedUntil ? `Books reopened: now closed up to ${showDate(s.closedUntil)}.` : "Books reopened."));

  if (error) return <div className="acx-err" role="alert">{error}</div>;
  if (!status) return <div className="acx-loading" aria-busy="true"><span /><span /><span /></div>;
  const until = status.closedUntil;
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Books closed up to" figure={until ? showDate(until) : "Open"} tone={until ? "good" : undefined} testId="pc-until"
          note={until ? "No voucher, GST set-off or cancellation can be posted on or before this day" : "Every day can take vouchers"} />
      </div>
      {allowed ? (
        <div className="acx-sides">
          <section className="acx-panel" aria-label="Close the books">
            <h3 className="acx-side-head">Close the books</h3>
            <div className="acx-fields">
              <div className="acx-field"><span className="acx-field-k">Up to</span>
                <input type="date" aria-label="Close up to" value={closeTo} max={isoDate(new Date())} onChange={(e) => setCloseTo(e.target.value)} /></div>
              <div className="acx-field acx-field--wide"><span className="acx-field-k">Note</span>
                <input type="text" aria-label="Closing note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. FY 2025-26 audited" /></div>
            </div>
            <p className="acx-hint">Close a month after its GST is filed, or the year after it is audited. Earlier years' profit shows as Retained Earnings on the balance sheet.</p>
            <div className="acx-addform-foot"><button type="button" className="acx-btn acx-btn-primary" disabled={busy || !closeTo || (until && closeTo <= until)} onClick={close}>Close books</button></div>
          </section>
          {until && (
            <section className="acx-panel" aria-label="Reopen the books">
              <h3 className="acx-side-head">Reopen</h3>
              <div className="acx-fields">
                <div className="acx-field"><span className="acx-field-k">Keep closed up to (empty = open all)</span>
                  <input type="date" aria-label="Keep closed up to" value={reopenTo} max={until} onChange={(e) => setReopenTo(e.target.value)} /></div>
                <div className="acx-field acx-field--wide"><span className="acx-field-k">Reason</span>
                  <input type="text" aria-label="Reason for reopening" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the books are reopened (kept in the history)" /></div>
              </div>
              <div className="acx-addform-foot"><button type="button" className="acx-btn acx-btn-ghost-primary" disabled={busy || reason.trim().length < 3} onClick={reopen}>Reopen</button></div>
            </section>
          )}
        </div>
      ) : <p className="acx-hint">Closing and reopening the books needs the Accounting “Close Books” permission.</p>}
      {(status.history || []).length > 0 && (
        <div className="acx-scroll acx-panel">
          <table className="acx-tbl" data-testid="pc-history">
            <thead><tr><th>When</th><th>Action</th><th>Closed up to</th><th>By</th><th>Reason</th></tr></thead>
            <tbody>
              {status.history.map((h, i) => (
                <tr key={i}>
                  <td className="acx-nowrap">{showDate(h.at)}</td>
                  <td><span className={`acx-pill acx-pill--${h.action === "CLOSE" ? "good" : "warn"}`}>{h.action === "CLOSE" ? "Closed" : "Reopened"}</span></td>
                  <td className="acx-nowrap">{h.closedUntil ? showDate(h.closedUntil) : "Open"}</td>
                  <td>{h.byName || "—"}</td>
                  <td>{h.reason || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
