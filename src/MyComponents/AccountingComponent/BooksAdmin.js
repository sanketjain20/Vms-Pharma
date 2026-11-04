import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { money, showDate, isoDate, searchRows, parseStatementCsv, AUDIT_ACTIONS, CASH, BANK } from "../../utils/accounting";
import { Kpi, Nothing } from "./AccountingReports";

const call = async (url, body) => {
  const res = await apiClient(`${API_BASE_URL}/api/Accounting/${url}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  return res.json().catch(() => null);
};

/** Download a report as Excel or PDF, worked out on the server exactly as the screen shows it. */
export function ExportButtons({ report, params }) {
  const [busy, setBusy] = useState("");
  const go = async (format) => {
    setBusy(format);
    try {
      const res = await apiClient(`${API_BASE_URL}/api/Accounting/Export`, { method: "POST", body: JSON.stringify({ ...params, report, format }) });
      const type = res.headers?.get?.("Content-Type") || "";
      if (!res.ok || type.includes("json")) {
        const json = await res.json().catch(() => null);
        toast.error(json?.message?.startsWith("Access denied") ? "Exporting needs the Accounting “Download” permission." : json?.message || "The export failed.");
        return;
      }
      const blob = await res.blob();
      const name = (res.headers?.get?.("Content-Disposition") || "").match(/filename=([^;]+)/)?.[1] || `accounting-${report}.${format === "PDF" ? "pdf" : "xlsx"}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`${format === "PDF" ? "PDF" : "Excel file"} downloaded.`);
    } catch {
      toast.error("The export failed. Check the connection and try again.");
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="acx-export" role="group" aria-label="Export this report">
      <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" disabled={!!busy} onClick={() => go("XLSX")}>{busy === "XLSX" ? "…" : "⇩ Excel"}</button>
      <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" disabled={!!busy} onClick={() => go("PDF")}>{busy === "PDF" ? "…" : "⇩ PDF"}</button>
    </div>
  );
}

/** A bank statement exported as CSV from net banking: read on the screen, checked, then added in one go. */
export function StatementImport({ onDone, onCancel }) {
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const read = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setParsed(parseStatementCsv(String(reader.result || "")));
    reader.readAsText(file);
  };
  const lines = parsed?.lines || [];
  const totalIn = lines.filter((l) => l.transactionType === "CREDIT").reduce((s, l) => s + l.amount, 0);
  const totalOut = lines.filter((l) => l.transactionType === "DEBIT").reduce((s, l) => s + l.amount, 0);
  const upload = async () => {
    setBusy(true);
    try {
      const json = await call("BankStatement/Import", { lines });
      if (json?.status === 200) {
        const r = json.data;
        toast.success(`${r.added} line${r.added === 1 ? "" : "s"} added${r.duplicates ? `, ${r.duplicates} already there` : ""}${r.rejected?.length ? `, ${r.rejected.length} rejected` : ""}.`);
        onDone(r);
      } else toast.error(json?.message || "The statement could not be imported.");
    } catch { toast.error("The statement could not be imported. Check the connection and try again."); }
    finally { setBusy(false); }
  };
  return (
    <section className="acx-addform" aria-label="Import bank statement" data-testid="statement-import">
      <div className="acx-fields">
        <div className="acx-field acx-field--wide"><span className="acx-field-k">Statement file (CSV from net banking; save an Excel statement as CSV first)</span>
          <input type="file" accept=".csv,text/csv" aria-label="Statement file" onChange={read} /></div>
      </div>
      {parsed && (
        <>
          {lines.length > 0 ? (
            <p className="acx-hint" data-testid="import-summary">{fileName}: {lines.length} line{lines.length === 1 ? "" : "s"} · money in {money(totalIn)} · money out {money(totalOut)} · {showDate(lines[0].transactionDate)} – {showDate(lines[lines.length - 1].transactionDate)}</p>
          ) : <div className="acx-err" role="alert">No statement lines could be read from this file.</div>}
          {parsed.problems.length > 0 && <ul className="acx-hint" data-testid="import-problems">{parsed.problems.slice(0, 5).map((p) => <li key={p}>{p}</li>)}{parsed.problems.length > 5 && <li>… and {parsed.problems.length - 5} more</li>}</ul>}
          {lines.length > 0 && (
            <div className="acx-scroll">
              <table className="acx-tbl acx-subtbl" data-testid="import-preview">
                <thead><tr><th>Date</th><th>Narration</th><th>Reference</th><th className="acx-num">Money in</th><th className="acx-num">Money out</th></tr></thead>
                <tbody>{lines.slice(0, 8).map((l, i) => (
                  <tr key={i}><td className="acx-nowrap">{showDate(l.transactionDate)}</td><td>{l.narration || "—"}</td><td className="acx-ref">{l.referenceNumber || "—"}</td>
                    <td className="acx-num acx-in">{l.transactionType === "CREDIT" ? money(l.amount) : ""}</td><td className="acx-num acx-out">{l.transactionType === "DEBIT" ? money(l.amount) : ""}</td></tr>
                ))}</tbody>
              </table>
              {lines.length > 8 && <p className="acx-hint">… and {lines.length - 8} more</p>}
            </div>
          )}
        </>
      )}
      <p className="acx-hint">Lines already on the statement (same date, amount, direction and reference) are skipped, so the same file can be imported again safely.</p>
      <div className="acx-addform-foot">
        <button type="button" className="acx-btn acx-btn-ghost-primary" onClick={onCancel}>Cancel</button>
        <button type="button" className="acx-btn acx-btn-primary" disabled={busy || lines.length === 0} onClick={upload}>{busy ? "Importing…" : `Import ${lines.length || ""} line${lines.length === 1 ? "" : "s"}`}</button>
      </div>
    </section>
  );
}

const blankLine = () => ({ ledger: "", debit: "", credit: "" });
const round2 = (v) => Math.round(Number(v || 0) * 100) / 100;

/** The day the books start, with what each ledger and each customer / supplier stood at then (migrating from MARG). */
export function OpeningBalances({ can, range }) {
  const [view, setView] = useState(null);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState("");
  const [lines, setLines] = useState([]);
  const [parties, setParties] = useState([]);
  const [busy, setBusy] = useState(false);
  const editable = can("Add");

  const take = useCallback((v) => {
    setView(v);
    setAsOf(v.asOf || `${Number(range?.fromDate?.slice(0, 4) || new Date().getFullYear())}-04-01`);
    setLines(v.lines.filter((l) => !l.partyType).map((l) => ({ ledger: l.ledger, debit: Number(l.debit) ? String(l.debit) : "", credit: Number(l.credit) ? String(l.credit) : "" })));
    setParties(v.lines.filter((l) => l.partyType).map((l) => ({ partyType: l.partyType, partyId: l.partyId, partyName: l.partyName, amount: String(Number(l.debit) || Number(l.credit)) })));
  }, [range]);

  const load = useCallback(async () => {
    try {
      const json = await call("OpeningBalances");
      if (json?.status === 200) { take(json.data); setError(""); } else setError(json?.message || "Could not load the opening balances.");
    } catch { setError("Could not load the opening balances. Check the connection and try again."); }
  }, [take]);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    let dr = 0, cr = 0;
    lines.forEach((l) => { dr += round2(l.debit); cr += round2(l.credit); });
    parties.forEach((p) => { if (p.partyType === "RETAILER") dr += round2(p.amount); else cr += round2(p.amount); });
    return { dr: round2(dr), cr: round2(cr), equity: round2(dr - cr) };
  }, [lines, parties]);

  if (error) return <div className="acx-err" role="alert">{error}</div>;
  if (!view) return <div className="acx-loading" aria-busy="true"><span /><span /><span /></div>;

  const included = new Set(parties.map((p) => `${p.partyType}:${p.partyId}`));
  const offered = (view.suggestions || []).filter((s) => !included.has(`${s.partyType}:${s.partyId}`));
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const save = async () => {
    setBusy(true);
    try {
      const body = { asOf, lines: [
        ...lines.filter((l) => l.ledger && (round2(l.debit) || round2(l.credit))).map((l) => ({ ledger: l.ledger, debit: round2(l.debit), credit: round2(l.credit) })),
        ...parties.filter((p) => round2(p.amount)).map((p) => ({ partyType: p.partyType, partyId: p.partyId, debit: p.partyType === "RETAILER" ? round2(p.amount) : 0, credit: p.partyType === "SUPPLIER" ? round2(p.amount) : 0 })),
      ] };
      const json = await call("OpeningBalances", body);
      if (json?.status === 200) { take(json.data); toast.success("Opening balances saved."); } else toast.error(json?.message || "The opening balances could not be saved.");
    } catch { toast.error("The opening balances could not be saved. Check the connection and try again."); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Books start" figure={view.asOf ? showDate(view.asOf) : "Not set"} testId="ob-asof" note="Opening balances are posted on this day" />
        <Kpi label="Debits" figure={money(totals.dr)} testId="ob-debit" note="Cash, bank, stock, assets, what customers owe" />
        <Kpi label="Credits" figure={money(totals.cr)} testId="ob-credit" note="Capital, loans, what suppliers are owed" />
        <Kpi label="Opening Balance Equity" figure={money(totals.equity)} testId="ob-equity" tone={totals.equity === 0 ? "good" : undefined}
          note={totals.equity === 0 ? "Debits equal credits" : "The difference: move it to Owner's Capital once the figures are final"} />
      </div>
      <section className="acx-panel" aria-label="Ledger opening balances">
        <h3 className="acx-side-head">Ledgers</h3>
        <div className="acx-fields">
          <div className="acx-field"><span className="acx-field-k">Books start on</span>
            <input type="date" aria-label="Books start on" value={asOf} max={isoDate(new Date())} disabled={!editable} onChange={(e) => setAsOf(e.target.value)} /></div>
        </div>
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="ob-lines">
            <thead><tr><th>Ledger</th><th className="acx-num">Debit (₹)</th><th className="acx-num">Credit (₹)</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><select aria-label={`Opening line ${i + 1} ledger`} value={l.ledger} disabled={!editable} onChange={(e) => setLine(i, "ledger", e.target.value)}>
                    <option value="">Choose…</option>{view.ledgers.map((n) => <option key={n} value={n}>{n}</option>)}</select></td>
                  <td className="acx-num"><input type="number" min="0" step="0.01" aria-label={`Opening line ${i + 1} debit`} value={l.debit} disabled={!editable} onChange={(e) => setLine(i, "debit", e.target.value)} /></td>
                  <td className="acx-num"><input type="number" min="0" step="0.01" aria-label={`Opening line ${i + 1} credit`} value={l.credit} disabled={!editable} onChange={(e) => setLine(i, "credit", e.target.value)} /></td>
                  <td className="acx-act">{editable && <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" aria-label={`Remove opening line ${i + 1}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>}</td>
                </tr>
              ))}
              {lines.length === 0 && <tr><td colSpan={4} className="acx-none-cell">No ledger openings yet: add cash in hand, bank, stock, fixed assets, capital, loans…</td></tr>}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="acx-tools">
            <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>+ Ledger</button>
            {!lines.some((l) => l.ledger === CASH) && <button type="button" className="acx-chip acx-chip-primary" onClick={() => setLines((ls) => [...ls, { ledger: CASH, debit: "", credit: "" }])}>Cash in hand</button>}
            {!lines.some((l) => l.ledger === BANK) && <button type="button" className="acx-chip acx-chip-primary" onClick={() => setLines((ls) => [...ls, { ledger: BANK, debit: "", credit: "" }])}>Bank</button>}
          </div>
        )}
      </section>
      <section className="acx-panel" aria-label="Customer and supplier opening balances">
        <h3 className="acx-side-head">Customers and suppliers</h3>
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="ob-parties">
            <thead><tr><th>Party</th><th>Kind</th><th className="acx-num">Owed (₹)</th><th /></tr></thead>
            <tbody>
              {parties.map((p, i) => (
                <tr key={`${p.partyType}:${p.partyId}`}>
                  <td>{p.partyName}</td>
                  <td><span className={`acx-pill acx-pill--${p.partyType === "RETAILER" ? "in" : "out"}`}>{p.partyType === "RETAILER" ? "Customer owes" : "Owed to supplier"}</span></td>
                  <td className="acx-num"><input type="number" min="0" step="0.01" aria-label={`${p.partyName} opening`} value={p.amount} disabled={!editable}
                    onChange={(e) => setParties((ps) => ps.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></td>
                  <td className="acx-act">{editable && <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" aria-label={`Remove ${p.partyName}`} onClick={() => setParties((ps) => ps.filter((_, j) => j !== i))}>✕</button>}</td>
                </tr>
              ))}
              {parties.length === 0 && <tr><td colSpan={4} className="acx-none-cell">No customer or supplier openings.</td></tr>}
            </tbody>
          </table>
        </div>
        {editable && offered.length > 0 && (
          <div data-testid="ob-offered">
            <p className="acx-hint">Balances in VMS not tied to any bill (usually the outstanding imported from MARG):</p>
            <div className="acx-tools">
              <button type="button" className="acx-btn acx-btn-primary acx-btn-sm" onClick={() => setParties((ps) => [...ps, ...offered.map((s) => ({ ...s, amount: String(s.amount) }))])}>Add all {offered.length}</button>
              {offered.slice(0, 12).map((s) => (
                <button key={`${s.partyType}:${s.partyId}`} type="button" className="acx-chip acx-chip-primary" onClick={() => setParties((ps) => [...ps, { ...s, amount: String(s.amount) }])}>
                  {s.partyName} · {money(s.amount)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {editable ? (
        <div className="acx-addform-foot">
          <button type="button" className="acx-btn acx-btn-primary" disabled={busy || !asOf} onClick={save}>{busy ? "Saving…" : "Save opening balances"}</button>
        </div>
      ) : <p className="acx-hint">Entering opening balances needs the Accounting “Add” permission.</p>}
    </>
  );
}

/** Who did what in the books, and when. */
export function AuditTrail({ data }) {
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const rows = (data || []).map((r) => ({ ...r, what: AUDIT_ACTIONS[r.action] || r.action }));
  const shown = searchRows(rows.filter((r) => !action || r.action === action), query, ["what", "reference", "details", "byName"]);
  const actions = [...new Set(rows.map((r) => r.action))];
  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Entries" figure={rows.length} testId="au-count" />
        <Kpi label="Vouchers cancelled" figure={rows.filter((r) => r.action === "VOUCHER_CANCELLED").length} testId="au-cancelled" />
        <Kpi label="Books closed / reopened" figure={rows.filter((r) => r.action === "BOOKS_CLOSED" || r.action === "BOOKS_REOPENED").length} testId="au-closing" />
      </div>
      {rows.length === 0 ? <Nothing>Nothing was done in the books in this period.</Nothing> : (
        <>
          <div className="acx-tools">
            <input className="acx-search" type="search" placeholder="Search reference, detail, person…" aria-label="Search audit trail" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select aria-label="Action" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Every action</option>
              {actions.map((a) => <option key={a} value={a}>{AUDIT_ACTIONS[a] || a}</option>)}
            </select>
            {(query || action) && <span className="acx-found">{shown.length} of {rows.length}</span>}
          </div>
          <div className="acx-scroll">
            <table className="acx-tbl" data-testid="au-table">
              <thead><tr><th>When</th><th>By</th><th>Action</th><th>Reference</th><th>Details</th></tr></thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i}>
                    <td className="acx-nowrap">{showDate(r.at)} {String(r.at || "").slice(11, 16)}</td>
                    <td>{r.byName || "—"}</td>
                    <td><span className={`acx-pill acx-pill--${/CANCEL|REOPEN/.test(r.action) ? "warn" : "plain"}`}>{r.what}</span></td>
                    <td className="acx-ref">{r.reference || "—"}</td>
                    <td>{r.details}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={5} className="acx-none-cell">Nothing matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
