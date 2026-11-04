import React, { useState } from "react";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { money, showDate, isoDate } from "../../utils/accounting";
import { Kpi, Nothing } from "./AccountingReports";
import { StatementImport } from "./BooksAdmin";

const blankLine = () => ({ transactionDate: isoDate(new Date()), transactionType: "CREDIT", amount: "", referenceNumber: "", narration: "" });

const post = async (url, body) => {
  const res = await apiClient(`${API_BASE_URL}/api/Accounting/${url}`, { method: "POST", body: JSON.stringify(body) });
  return res.json().catch(() => null);
};

/** Add a line from the bank statement: date, money in or out, amount, reference and narration. */
function AddLine({ onAdded, onCancel }) {
  const [line, setLine] = useState(blankLine);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => { setLine({ ...line, [k]: e.target.value }); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    const amount = Math.round(parseFloat(line.amount) * 100) / 100;
    if (!line.transactionDate) { setError("Enter the date on the statement."); return; }
    if (!(amount > 0)) { setError("Enter the amount on the statement."); return; }
    setSaving(true);
    try {
      const json = await post("BankStatement", { ...line, amount, referenceNumber: line.referenceNumber.trim() || null, narration: line.narration.trim() || null });
      if (json?.status === 200) { toast.success("Statement line added."); onAdded(); }
      else setError(json?.message || "The statement line could not be added.");
    } catch {
      setError("The statement line could not be added. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="acx-addform" onSubmit={submit} aria-label="Add statement line">
      <div className="acx-fields">
        <div className="acx-field"><span className="acx-field-k">Date</span>
          <input type="date" aria-label="Statement date" value={line.transactionDate} max={isoDate(new Date())} onChange={set("transactionDate")} /></div>
        <div className="acx-field"><span className="acx-field-k">Money</span>
          <select aria-label="Money in or out" value={line.transactionType} onChange={set("transactionType")}>
            <option value="CREDIT">In (credit)</option>
            <option value="DEBIT">Out (debit)</option>
          </select></div>
        <div className="acx-field"><span className="acx-field-k">Amount (₹)</span>
          <input type="number" min="0.01" step="0.01" aria-label="Statement amount" value={line.amount} onChange={set("amount")} /></div>
        <div className="acx-field"><span className="acx-field-k">Reference / UTR</span>
          <input type="text" maxLength={100} aria-label="Statement reference" value={line.referenceNumber} onChange={set("referenceNumber")} /></div>
        <div className="acx-field acx-field--wide"><span className="acx-field-k">Narration</span>
          <input type="text" maxLength={500} aria-label="Statement narration" value={line.narration} onChange={set("narration")} placeholder="As printed on the statement" /></div>
      </div>
      {error && <div className="acx-err" role="alert">{error}</div>}
      <div className="acx-addform-foot">
        <button type="button" className="acx-btn acx-btn-ghost-primary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="acx-btn acx-btn-primary" disabled={saving}>{saving ? "Adding…" : "Add line"}</button>
      </div>
    </form>
  );
}

/** The payments a statement line could be: same amount, same direction. */
function Suggestions({ row, onMatched, canMatch }) {
  const [busy, setBusy] = useState("");
  const list = row.suggestions || [];
  if (!list.length) return <p className="acx-nomatch">No bank {row.type === "CREDIT" ? "receipt" : "payment"} of {money(row.amount)} is waiting to be matched.</p>;
  const match = async (s) => {
    setBusy(s.paymentUKey);
    try {
      const json = await post(`BankReconciliation/${row.statementUKey}/Match`, { paymentUKey: s.paymentUKey });
      if (json?.status === 200) { toast.success("Matched — the line is reconciled."); onMatched(); }
      else toast.error(json?.message || "The line could not be matched.");
    } catch {
      toast.error("The line could not be matched. Check the connection and try again.");
    } finally {
      setBusy("");
    }
  };
  return (
    <ul className="acx-sugg" data-testid="recon-suggestions">
      {list.map((s) => (
        <li key={s.paymentUKey}>
          <span className="acx-sugg-what">
            <strong>{s.party || s.kind}</strong>
            <span>{s.kind} · {showDate(s.date)} · {s.mode}{s.reference ? ` · ${s.reference}` : ""}</span>
          </span>
          <span className="acx-num acx-strong">{money(s.amount)}</span>
          {canMatch && (
            <button type="button" className="acx-btn acx-btn-primary acx-btn-sm" disabled={!!busy}
              aria-label={`Match to ${s.party || s.kind} ${showDate(s.date)}`} onClick={() => match(s)}>
              {busy === s.paymentUKey ? "Matching…" : "Match"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The bank book against the bank statement: add statement lines, match each to its payment, see what is left. */
export default function BankReconciliation({ data, can, reload, range }) {
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState(false);
  /** Match what is certain: a line with exactly one receipt / payment of the same amount within 3 days that no other line wants. */
  const autoMatch = async () => {
    setMatching(true);
    try {
      const json = await post("BankReconciliation/AutoMatch", range || {});
      if (json?.status === 200) {
        const m = json.data;
        if (m.matched) toast.success(`${m.matched} of ${m.checked} line${m.checked === 1 ? "" : "s"} matched.`);
        else toast.info(m.checked ? "Nothing could be matched for certain: match the rest by hand." : "There are no lines to match.");
        reload();
      } else toast.error(json?.message || "Auto-match failed.");
    } catch { toast.error("Auto-match failed. Check the connection and try again."); }
    finally { setMatching(false); }
  };
  const [open, setOpen] = useState(null); // the statement line whose matches are shown
  const rows = data?.rows || [];
  const unmatched = rows.filter((r) => r.status === "UNMATCHED").length;
  const diff = Number(data?.unreconciledDifference || 0);

  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Bank book balance" figure={money(data?.bankBookBalance)} testId="recon-book" />
        <Kpi label="Statement balance" figure={money(data?.statementBalance)} testId="recon-statement" />
        <Kpi label="Difference" figure={money(diff)} tone={Math.abs(diff) < 0.005 ? "good" : "bad"} testId="recon-diff"
          note={Math.abs(diff) < 0.005 ? "Book and statement agree" : "Still to explain"} />
        <Kpi label="Lines to match" figure={unmatched} tone={unmatched ? "bad" : "good"} note={`${rows.length} on the statement`} testId="recon-unmatched" />
      </div>

      <div className="acx-tools">
        <p className="acx-lead">Add each line of your bank statement, then match it to the receipt or payment it is.</p>
        {can("Add") && !adding && !importing && (
          <button type="button" className="acx-btn acx-btn-primary" onClick={() => setAdding(true)}>+ Add statement line</button>
        )}
        {can("Add") && !adding && !importing && (
          <button type="button" className="acx-btn acx-btn-ghost-primary" onClick={() => setImporting(true)}>⇧ Import statement (CSV)</button>
        )}
        {can("Edit") && unmatched > 0 && (
          <button type="button" className="acx-btn acx-btn-ghost-primary" disabled={matching} onClick={autoMatch}>{matching ? "Matching…" : "Auto-match"}</button>
        )}
      </div>
      {adding && <AddLine onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); reload(); }} />}
      {importing && <StatementImport onCancel={() => setImporting(false)} onDone={() => { setImporting(false); reload(); }} />}

      {rows.length === 0 ? <Nothing>No bank statement lines in this period{can("Add") ? " — add the first one above." : "."}</Nothing> : (
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="recon-table">
            <thead><tr><th>Date</th><th>Narration</th><th>Reference</th><th className="acx-num">Money in</th><th className="acx-num">Money out</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = open === r.statementUKey;
                const done = r.status !== "UNMATCHED";
                return (
                  <React.Fragment key={r.statementUKey}>
                    <tr className={isOpen ? "acx-open" : ""}>
                      <td className="acx-nowrap">{showDate(r.date)}</td>
                      <td>{r.narration || "—"}</td>
                      <td className="acx-ref">{r.referenceNumber || "—"}</td>
                      <td className="acx-num acx-in">{r.type === "CREDIT" ? money(r.amount) : ""}</td>
                      <td className="acx-num acx-out">{r.type === "DEBIT" ? money(r.amount) : ""}</td>
                      <td><span className={`acx-pill ${done ? "acx-pill--good" : "acx-pill--warn"}`}>{done ? "Matched" : "To match"}</span></td>
                      <td className="acx-act">
                        {!done && (
                          <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : r.statementUKey)}>
                            {isOpen ? "Hide" : `Find match${(r.suggestions || []).length ? ` (${r.suggestions.length})` : ""}`}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="acx-drawer"><td colSpan={7}>
                        <Suggestions row={r} canMatch={can("Edit")} onMatched={() => { setOpen(null); reload(); }} />
                        {!can("Edit") && <p className="acx-nomatch">Matching needs the Accounting “Edit” permission.</p>}
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
