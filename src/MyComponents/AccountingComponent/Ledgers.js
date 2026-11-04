import React, { useEffect, useMemo, useState } from "react";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { money, moneyOrBlank, showDate, searchRows, drCr, CASH } from "../../utils/accounting";
import { Kpi, Nothing } from "./AccountingReports";
import { useLedgers } from "./Vouchers";
import { ExportButtons } from "./BooksAdmin";

const GROUP_NAMES = { Asset: "Assets", Liability: "Liabilities", Equity: "Equity", Income: "Income", Expense: "Expenses" };
const TONE = { Receipt: "in", Payment: "out", Sales: "in", Purchase: "out", "Credit Note": "out", "Debit Note": "in", Journal: "plain", Contra: "plain" };

/** One ledger over the period: its opening balance, every entry with the running balance, and the closing balance. */
export function GeneralLedger({ range, canExport = false }) {
  const { ledgers } = useLedgers();
  const [ledger, setLedger] = useState(CASH);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    setError("");
    (async () => {
      try {
        const res = await apiClient(`${API_BASE_URL}/api/Accounting/GeneralLedger`, { method: "POST", body: JSON.stringify({ ...range, ledger }) });
        const json = await res.json().catch(() => null);
        if (!live) return;
        if (json?.status === 200) setData(json.data);
        else { setData(null); setError(json?.message || "Could not load the ledger."); }
      } catch { if (live) { setData(null); setError("Could not load the ledger. Check the connection and try again."); } }
    })();
    return () => { live = false; };
  }, [range, ledger]);

  const entries = data?.entries || [];
  const shown = searchRows(entries, query, ["reference", "narration", "voucherType", "date"]);
  const groups = ["Asset", "Liability", "Equity", "Income", "Expense"].map((g) => [g, ledgers.filter((l) => l.group === g)]).filter(([, l]) => l.length);
  const pnl = data?.group === "Income" || data?.group === "Expense";

  return (
    <>
      <div className="acx-tools">
        <span className="acx-field-k">Ledger</span>
        <select aria-label="Ledger" value={ledger} onChange={(e) => { setLedger(e.target.value); setQuery(""); }}>
          {!ledgers.some((l) => l.name === ledger) && <option value={ledger}>{ledger}</option>}
          {groups.map(([g, ls]) => <optgroup key={g} label={GROUP_NAMES[g]}>{ls.map((l) => <option key={l.name} value={l.name}>{l.name}{l.disabled ? " (off)" : ""}</option>)}</optgroup>)}
        </select>
        {data?.group && <span className={`acx-pill acx-pill--${data.group.toLowerCase()}`}>{GROUP_NAMES[data.group]}</span>}
        {canExport && <ExportButtons report="ledger" params={{ ...range, ledger }} />}
      </div>
      {error ? <div className="acx-err" role="alert">{error}</div> : !data ? <div className="acx-loading" aria-busy="true"><span /><span /><span /></div> : (
        <>
          <div className="acx-kpis">
            <Kpi label="Opening balance" figure={drCr(data.openingBalance)} testId="gl-opening" note={pnl ? "From the start of the financial year" : `Before ${showDate(data.fromDate)}`} />
            <Kpi label="Debits" figure={money(data.totalDebit)} testId="gl-debit" />
            <Kpi label="Credits" figure={money(data.totalCredit)} testId="gl-credit" />
            <Kpi label="Closing balance" figure={drCr(data.closingBalance)} testId="gl-closing" note={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`} />
          </div>
          {entries.length === 0 ? <Nothing>No entries in {data.ledger} in this period.</Nothing> : (
            <>
              <div className="acx-tools">
                <input className="acx-search" type="search" placeholder="Search reference, narration…" aria-label="Search ledger" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <span className="acx-found">{shown.length} of {entries.length}</span>}
              </div>
              <div className="acx-scroll">
                <table className="acx-tbl" data-testid="gl-table">
                  <thead><tr><th>Date</th><th>Voucher</th><th>Reference</th><th>Narration</th><th className="acx-num">Debit</th><th className="acx-num">Credit</th><th className="acx-num">Balance</th></tr></thead>
                  <tbody>
                    <tr className="acx-grp"><td colSpan={6}>Opening balance</td><td className="acx-num acx-strong">{drCr(data.openingBalance)}</td></tr>
                    {shown.map((e, i) => (
                      <tr key={`${e.reference}-${i}`}>
                        <td className="acx-nowrap">{showDate(e.date)}</td>
                        <td><span className={`acx-pill acx-pill--${TONE[e.voucherType] || "plain"}`}>{e.voucherType}</span></td>
                        <td className="acx-ref">{e.reference}</td>
                        <td>{e.narration}</td>
                        <td className="acx-num">{moneyOrBlank(e.debit)}</td>
                        <td className="acx-num">{moneyOrBlank(e.credit)}</td>
                        <td className="acx-num acx-strong">{drCr(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={4}>Closing balance</td><td className="acx-num">{money(data.totalDebit)}</td><td className="acx-num">{money(data.totalCredit)}</td><td className="acx-num">{drCr(data.closingBalance)}</td></tr></tfoot>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

/** Every voucher of the period, in date order, each with its debit and credit lines. */
export function DayBookView({ data }) {
  const [query, setQuery] = useState("");
  const entries = useMemo(() => (data?.entries || []).map((e) => ({ ...e, ledgers: e.lines.map((l) => l.ledger).join(" ") })), [data]);
  const shown = searchRows(entries, query, ["reference", "narration", "voucherType", "ledgers", "date"]);
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Vouchers" figure={entries.length} testId="db-count" />
        <Kpi label="Total debit" figure={money(data?.totalDebit)} testId="db-debit" />
        <Kpi label="Total credit" figure={money(data?.totalCredit)} testId="db-credit" />
      </div>
      {entries.length === 0 ? <Nothing>No vouchers in this period.</Nothing> : (
        <>
          <div className="acx-tools">
            <input className="acx-search" type="search" placeholder="Search number, narration, ledger…" aria-label="Search day book" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <span className="acx-found">{shown.length} of {entries.length}</span>}
          </div>
          <div className="acx-scroll">
            <table className="acx-tbl" data-testid="db-table">
              <thead><tr><th>Date</th><th>Voucher</th><th>Reference</th><th>Ledger</th><th className="acx-num">Debit</th><th className="acx-num">Credit</th></tr></thead>
              {shown.map((e, i) => (
                <tbody key={`${e.reference}-${e.voucherType}-${i}`} className="acx-voucher">
                  <tr className="acx-grp">
                    <td className="acx-nowrap">{showDate(e.date)}</td>
                    <td><span className={`acx-pill acx-pill--${TONE[e.voucherType] || "plain"}`}>{e.voucherType}</span></td>
                    <td className="acx-ref">{e.reference}</td>
                    <td colSpan={3}>{e.narration}</td>
                  </tr>
                  {e.lines.filter((l) => Number(l.debit) !== 0 || Number(l.credit) !== 0).map((l, j) => (
                    <tr key={j}>
                      <td colSpan={3} />
                      <td className={Number(l.credit) > 0 ? "acx-indent" : ""}>{Number(l.credit) > 0 ? "To " : ""}{l.ledger}</td>
                      <td className="acx-num">{moneyOrBlank(l.debit)}</td>
                      <td className="acx-num">{moneyOrBlank(l.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot><tr><td colSpan={4}>Total</td><td className="acx-num">{money(data?.totalDebit)}</td><td className="acx-num">{money(data?.totalCredit)}</td></tr></tfoot>
            </table>
          </div>
        </>
      )}
    </>
  );
}
