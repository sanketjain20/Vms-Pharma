import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import API_BASE_URL from "../../Config/api.config";
import apiClient from "../../Config/apiClient";
import { money, showDate, isoDate, searchRows, VOUCHER_TYPES, CASH, BANK, simpleLines, voucherTotals, cashCountResult } from "../../utils/accounting";
import { Kpi, Nothing } from "./AccountingReports";

const call = async (url, body) => {
  const res = await apiClient(`${API_BASE_URL}/api/Accounting/${url}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  return res.json().catch(() => null);
};

/** Post a voucher; if it would take cash in hand below zero the server asks first, and so do we. */
export async function postVoucher(body) {
  let json = await call("Voucher", body);
  if (json?.status === 409 && window.confirm(`${json.message} Post it anyway?`)) json = await call("Voucher", { ...body, allowNegativeCash: true });
  return json;
}

/** The ledgers a voucher typed by hand can use: cash, bank, GST payable and the shop's heads that are switched on. */
export function useLedgers() {
  const [ledgers, setLedgers] = useState([]);
  const reload = useCallback(async () => {
    try {
      const json = await call("Ledgers");
      if (json?.status === 200) setLedgers(json.data || []);
    } catch { /* the lists stay empty; posting says why */ }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { ledgers, reload };
}

const TYPE_NAME = Object.fromEntries(VOUCHER_TYPES.map((t) => [t.id, t.name]));
const TONE = { RECEIPT: "in", PAYMENT: "out", CONTRA: "plain", JOURNAL: "plain" };
const GROUP_NAMES = { Asset: "Assets", Liability: "Liabilities", Equity: "Equity", Income: "Income", Expense: "Expenses" };

/** Ready-made vouchers for what a shop does most. */
export const TEMPLATES = [
  { id: "expense", name: "Expense paid", type: "PAYMENT", money: CASH, account: "" },
  { id: "capital", name: "Capital brought in", type: "RECEIPT", money: BANK, account: "Owner's Capital", narration: "Capital introduced" },
  { id: "drawings", name: "Owner's drawings", type: "PAYMENT", money: CASH, account: "Drawings", narration: "Drawings" },
  { id: "deposit", name: "Cash deposited in bank", type: "CONTRA", direction: "toBank", narration: "Cash deposited in bank" },
  { id: "withdraw", name: "Cash withdrawn from bank", type: "CONTRA", direction: "toCash", narration: "Cash withdrawn from bank" },
  { id: "charges", name: "Bank charges", type: "PAYMENT", money: BANK, account: "Bank Charges", narration: "Bank charges" },
  { id: "opening", name: "Opening balance", type: "RECEIPT", money: CASH, account: "Owner's Capital", narration: "Opening balance" },
];

const blank = (preset = {}) => ({
  type: "PAYMENT", voucherDate: isoDate(new Date()), money: CASH, account: "", amount: "", direction: "toBank", narration: "", reference: "",
  lines: [{ ledger: "", debit: "", credit: "" }, { ledger: "", debit: "", credit: "" }], ...preset,
});

function LedgerSelect({ value, onChange, options, label, placeholder = "Choose…" }) {
  const groups = ["Asset", "Liability", "Equity", "Income", "Expense"].map((g) => [g, options.filter((o) => o.group === g)]).filter(([, os]) => os.length);
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.map(([g, os]) => (
        <optgroup key={g} label={GROUP_NAMES[g]}>{os.map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}</optgroup>
      ))}
    </select>
  );
}

/** A new voucher: Receipt / Payment (cash or bank against a head), Contra (deposit / withdrawal) or Journal (any lines that balance). */
export function NewVoucher({ ledgers, preset, onPosted, onCancel, canBackdate = true }) {
  const [v, setV] = useState(() => blank(preset));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const usable = ledgers.filter((l) => l.usable);
  const accounts = usable.filter((l) => l.name !== CASH && l.name !== BANK);
  const set = (k) => (value) => { setV((x) => ({ ...x, [k]: value })); setError(""); };
  const setE = (k) => (e) => set(k)(e.target.value);
  const setLine = (i, k) => (value) => { setV((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: value } : l)) })); setError(""); };
  const journal = v.type === "JOURNAL";
  const totals = voucherTotals(v.lines);
  const today = isoDate(new Date());

  const lines = () => (journal
    ? v.lines.filter((l) => l.ledger && (Number(l.debit) > 0 || Number(l.credit) > 0)).map((l) => ({ ledger: l.ledger, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
    : simpleLines(v));

  const submit = async (e) => {
    e.preventDefault();
    if (!v.voucherDate) { setError("Enter the voucher date."); return; }
    if (!canBackdate && v.voucherDate < today) { setError("A voucher dated before today needs the Accounting “Backdate Vouchers” permission."); return; }
    if (!journal) {
      if (!(Number(v.amount) > 0)) { setError("Enter the amount."); return; }
      if (v.type !== "CONTRA" && !v.account) { setError(v.type === "RECEIPT" ? "Choose where the money came from." : "Choose what the money was for."); return; }
    } else if (!totals.balanced) { setError(`Debits (${money(totals.debit)}) and credits (${money(totals.credit)}) must be equal.`); return; }
    setSaving(true);
    try {
      const json = await postVoucher({ voucherType: v.type, voucherDate: v.voucherDate, narration: v.narration.trim() || null, reference: v.reference.trim() || null, lines: lines() });
      if (json?.status === 200) { toast.success(`${json.data.voucherNumber} posted.`); onPosted(json.data); }
      else if (json?.status !== 409) setError(json?.message || "The voucher could not be posted.");
    } catch {
      setError("The voucher could not be posted. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="acx-addform" onSubmit={submit} aria-label="New voucher" data-testid="voucher-form">
      <div className="acx-chips" role="group" aria-label="Voucher type">
        {VOUCHER_TYPES.map((t) => (
          <button key={t.id} type="button" className={`acx-chip acx-chip-primary ${v.type === t.id ? "is-on" : ""}`} aria-pressed={v.type === t.id}
            title={t.hint} onClick={() => set("type")(t.id)}>{t.name}</button>
        ))}
      </div>
      <p className="acx-hint">{VOUCHER_TYPES.find((t) => t.id === v.type).hint}</p>
      <div className="acx-fields">
        <div className="acx-field"><span className="acx-field-k">Date</span>
          <input type="date" aria-label="Voucher date" value={v.voucherDate} min={canBackdate ? undefined : today} max={today} onChange={setE("voucherDate")} />
          {!canBackdate && <span className="acx-hint">An earlier date needs “Backdate Vouchers”</span>}</div>
        {(v.type === "RECEIPT" || v.type === "PAYMENT") && <>
          <div className="acx-field"><span className="acx-field-k">{v.type === "RECEIPT" ? "Received into" : "Paid from"}</span>
            <select aria-label={v.type === "RECEIPT" ? "Received into" : "Paid from"} value={v.money} onChange={setE("money")}>
              <option value={CASH}>Cash in hand</option><option value={BANK}>Bank</option>
            </select></div>
          <div className="acx-field"><span className="acx-field-k">{v.type === "RECEIPT" ? "Received from / for" : "Paid for"}</span>
            <LedgerSelect label={v.type === "RECEIPT" ? "Received from" : "Paid for"} value={v.account} onChange={set("account")} options={accounts} /></div>
        </>}
        {v.type === "CONTRA" && (
          <div className="acx-field"><span className="acx-field-k">Move</span>
            <select aria-label="Contra direction" value={v.direction} onChange={setE("direction")}>
              <option value="toBank">Cash → Bank (deposit)</option><option value="toCash">Bank → Cash (withdrawal)</option>
            </select></div>
        )}
        {!journal && (
          <div className="acx-field"><span className="acx-field-k">Amount (₹)</span>
            <input type="number" min="0.01" step="0.01" aria-label="Voucher amount" value={v.amount} onChange={setE("amount")} /></div>
        )}
        <div className="acx-field"><span className="acx-field-k">Reference</span>
          <input type="text" maxLength={100} aria-label="Voucher reference" value={v.reference} onChange={setE("reference")} placeholder="Bill no., UTR, cheque no." /></div>
        <div className="acx-field acx-field--wide"><span className="acx-field-k">Narration</span>
          <input type="text" maxLength={500} aria-label="Voucher narration" value={v.narration} onChange={setE("narration")} placeholder="What this is for" /></div>
      </div>
      {journal && (
        <div className="acx-scroll">
          <table className="acx-tbl" data-testid="journal-lines">
            <thead><tr><th>Ledger</th><th className="acx-num">Debit (₹)</th><th className="acx-num">Credit (₹)</th><th /></tr></thead>
            <tbody>
              {v.lines.map((l, i) => (
                <tr key={i}>
                  <td><LedgerSelect label={`Line ${i + 1} ledger`} value={l.ledger} onChange={setLine(i, "ledger")} options={usable.filter((o) => o.name !== CASH && o.name !== BANK)} /></td>
                  <td className="acx-num"><input type="number" min="0" step="0.01" aria-label={`Line ${i + 1} debit`} value={l.debit} onChange={(e) => setLine(i, "debit")(e.target.value)} /></td>
                  <td className="acx-num"><input type="number" min="0" step="0.01" aria-label={`Line ${i + 1} credit`} value={l.credit} onChange={(e) => setLine(i, "credit")(e.target.value)} /></td>
                  <td className="acx-act">{v.lines.length > 2 && <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" aria-label={`Remove line ${i + 1}`}
                    onClick={() => setV((x) => ({ ...x, lines: x.lines.filter((_, j) => j !== i) }))}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td>
              <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={() => setV((x) => ({ ...x, lines: [...x.lines, { ledger: "", debit: "", credit: "" }] }))}>+ Line</button>
            </td><td className="acx-num">{money(totals.debit)}</td><td className="acx-num">{money(totals.credit)}</td>
            <td data-testid="journal-status"><span className={`acx-pill acx-pill--${totals.balanced ? "good" : "warn"}`}>{totals.balanced ? "Balanced" : "Not balanced"}</span></td></tr></tfoot>
          </table>
        </div>
      )}
      {error && <div className="acx-err" role="alert">{error}</div>}
      <div className="acx-addform-foot">
        <button type="button" className="acx-btn acx-btn-ghost-primary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="acx-btn acx-btn-primary" disabled={saving}>{saving ? "Posting…" : `Post ${TYPE_NAME[v.type].toLowerCase()}`}</button>
      </div>
    </form>
  );
}

/** GST as at a day: output collected, input to set against it, what is left to pay; post the set-off, then pay. */
function GstSetOff({ asAt, can, onPay, onPosted }) {
  const [p, setP] = useState(null);
  const [busy, setBusy] = useState(false);
  const day = asAt > isoDate(new Date()) ? isoDate(new Date()) : asAt;
  const load = useCallback(async () => {
    try {
      const json = await call("GstPosition", { toDate: day });
      setP(json?.status === 200 ? json.data : null);
    } catch { setP(null); }
  }, [day]);
  useEffect(() => { load(); }, [load]);
  if (!p) return null;
  const setOff = async () => {
    if (!window.confirm(`Set off ${money(p.setOff)} of input GST against ${money(p.outputGst)} of output GST as at ${showDate(day)}? ${money(p.payableAfterSetOff)} moves to GST Payable.`)) return;
    setBusy(true);
    try {
      const json = await call("GstSetOff", { toDate: day });
      if (json?.status === 200) { toast.success(`${json.data.voucherNumber}: GST set off.`); await load(); onPosted(); }
      else toast.error(json?.message || "The set-off could not be posted.");
    } catch { toast.error("The set-off could not be posted. Check the connection and try again."); }
    finally { setBusy(false); }
  };
  return (
    <section className="acx-panel" data-testid="gst-panel" aria-label="GST set-off">
      <h3 className="acx-side-head">GST as at {showDate(day)}</h3>
      <div className="acx-kpis acx-kpis--tight">
        <Kpi label="Output GST" figure={money(p.outputGst)} testId="gst-output" note="Collected on sales" />
        <Kpi label="Input GST" figure={money(p.inputGst)} testId="gst-input" note="Paid on purchases" />
        <Kpi label="Set-off" figure={money(p.setOff)} testId="gst-setoff" note={Number(p.inputCarriedForward) > 0 ? `${money(p.inputCarriedForward)} input carried forward` : "Input used against output"} />
        <Kpi label="GST payable" figure={money(Number(p.gstPayable) + Number(p.payableAfterSetOff))} tone="out" testId="gst-payable"
          note={Number(p.gstPayable) > 0 ? `${money(p.gstPayable)} set off, not yet paid` : "After set-off"} />
      </div>
      <p className="acx-hint">Input GST is set off only as far as it is eligible credit (check GSTR-2B before setting off).</p>
      <div className="acx-addform-foot">
        {can("Add") && Number(p.outputGst) > 0 && <button type="button" className="acx-btn acx-btn-primary" disabled={busy || (day < isoDate(new Date()) && !can("Backdate Vouchers"))}
          title={day < isoDate(new Date()) && !can("Backdate Vouchers") ? "A set-off dated before today needs “Backdate Vouchers”" : undefined} onClick={setOff}>Post GST set-off</button>}
        {can("Add") && Number(p.gstPayable) > 0 && <button type="button" className="acx-btn acx-btn-ghost-primary" onClick={() => onPay(p.gstPayable)}>Pay {money(p.gstPayable)} GST</button>}
      </div>
    </section>
  );
}

/** The shop's account heads by group: add one, or switch off one it doesn't use. */
function AccountHeads({ ledgers, can, reload }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState("Expense");
  const heads = ledgers.filter((l) => l.kind === "HEAD");
  const add = async (e) => {
    e.preventDefault();
    const json = await call("LedgerHead", { name, group }).catch(() => null);
    if (json?.status === 200) { toast.success(`${json.data.name} added.`); setName(""); reload(); }
    else toast.error(json?.message || "The head could not be added.");
  };
  const toggle = async (h) => {
    const json = await call(`LedgerHead/${h.disabled ? "Enable" : "Disable"}`, { name: h.name }).catch(() => null);
    if (json?.status === 200) reload(); else toast.error(json?.message || "The head could not be changed.");
  };
  return (
    <section className="acx-panel" aria-label="Account heads">
      <button type="button" className="acx-btn acx-btn-ghost-primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "▾" : "▸"} Account heads ({heads.filter((h) => !h.disabled).length})
      </button>
      {open && (
        <div data-testid="heads">
          {can("Add") && (
            <form className="acx-fields acx-heads-add" onSubmit={add} aria-label="Add account head">
              <div className="acx-field"><span className="acx-field-k">New head</span>
                <input type="text" aria-label="Head name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shop Insurance" /></div>
              <div className="acx-field"><span className="acx-field-k">Group</span>
                <select aria-label="Head group" value={group} onChange={(e) => setGroup(e.target.value)}>
                  {Object.entries(GROUP_NAMES).map(([g, n]) => <option key={g} value={g}>{n}</option>)}
                </select></div>
              <div className="acx-field acx-field--end"><button type="submit" className="acx-btn acx-btn-primary" disabled={name.trim().length < 2}>Add head</button></div>
            </form>
          )}
          <ul className="acx-lines">
            {heads.map((h) => (
              <li key={h.name} className={h.disabled ? "acx-off" : ""}>
                <span>{h.name} <span className={`acx-pill acx-pill--${h.group.toLowerCase()}`}>{GROUP_NAMES[h.group]}</span></span>
                {can("Edit") && <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={() => toggle(h)}>{h.disabled ? "Switch on" : "Switch off"}</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Receipt, Payment, Contra and Journal vouchers of the period, with posting, cancelling (a reversal), GST set-off and heads. */
export default function Vouchers({ range, can }) {
  const { ledgers, reload: reloadLedgers } = useLedgers();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // the preset of the open form
  const [query, setQuery] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const [gstKey, setGstKey] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const json = await call("Vouchers", range);
      if (json?.status === 200) setList(json.data || []);
      else { setList([]); setError(json?.message || "Could not load the vouchers."); }
    } catch { setList([]); setError("Could not load the vouchers. Check the connection and try again."); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => searchRows((list || []).map((x) => ({ ...x, ledgers: x.lines.map((l) => l.ledger).join(" ") })), query,
    ["voucherNumber", "narration", "reference", "ledgers", "voucherType"]), [list, query]);

  const posted = () => { setForm(null); load(); setGstKey((k) => k + 1); };
  const cancel = async (x) => {
    const json = await call(`Voucher/${x.uKey}/Cancel`, { reason }).catch(() => null);
    if (json?.status === 200) { toast.success(`${x.voucherNumber} cancelled: its reversal is posted today.`); setCancelling(null); setReason(""); load(); setGstKey((k) => k + 1); }
    else toast.error(json?.message || "The voucher could not be cancelled.");
  };
  const live = (list || []).filter((x) => !x.cancelled);

  return (
    <>
      <div className="acx-kpis">
        <Kpi label="Vouchers" figure={live.length} testId="vch-count" note={`${(list || []).length - live.length} cancelled`} />
        <Kpi label="Payments" figure={money(live.filter((x) => x.voucherType === "PAYMENT").reduce((s, x) => s + Number(x.amount), 0))} tone="out" testId="vch-payments" />
        <Kpi label="Receipts" figure={money(live.filter((x) => x.voucherType === "RECEIPT").reduce((s, x) => s + Number(x.amount), 0))} tone="in" testId="vch-receipts" />
      </div>

      {can("Add") && !form && (
        <div className="acx-tools" role="group" aria-label="New voucher">
          <button type="button" className="acx-btn acx-btn-primary" onClick={() => setForm({})}>+ New voucher</button>
          {TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="acx-chip acx-chip-primary" onClick={() => setForm(t)}>{t.name}</button>
          ))}
        </div>
      )}
      {form && <NewVoucher key={JSON.stringify(form)} ledgers={ledgers} preset={form} onPosted={posted} onCancel={() => setForm(null)} canBackdate={can("Backdate Vouchers")} />}

      <GstSetOff key={gstKey} asAt={range.toDate} can={can} onPosted={load}
        onPay={(amount) => setForm({ type: "PAYMENT", money: BANK, account: "GST Payable", amount: String(amount), narration: "GST paid" })} />

      {error ? <div className="acx-err" role="alert">{error}</div>
        : list === null ? <div className="acx-loading" aria-busy="true"><span /><span /><span /></div>
          : list.length === 0 ? <Nothing>No vouchers in this period. Expenses, capital, drawings, deposits and withdrawals are entered here.</Nothing> : (
            <>
              <div className="acx-tools">
                <input className="acx-search" type="search" placeholder="Search number, narration, ledger…" aria-label="Search vouchers"
                  value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <span className="acx-found">{shown.length} of {list.length}</span>}
              </div>
              <div className="acx-scroll">
                <table className="acx-tbl" data-testid="voucher-table">
                  <thead><tr><th>Date</th><th>Voucher</th><th>Number</th><th>Narration</th><th>Ledgers</th><th className="acx-num">Amount</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {shown.map((x) => (
                      <React.Fragment key={x.uKey}>
                        <tr className={x.cancelled ? "acx-off" : ""}>
                          <td className="acx-nowrap">{showDate(x.voucherDate)}</td>
                          <td><span className={`acx-pill acx-pill--${TONE[x.voucherType] || "plain"}`}>{x.source === "GST_SETOFF" ? "GST set-off" : TYPE_NAME[x.voucherType]}</span></td>
                          <td className="acx-ref">{x.voucherNumber}</td>
                          <td>{x.narration}{x.reference ? <span className="acx-muted"> · {x.reference}</span> : null}</td>
                          <td className="acx-small">{x.lines.map((l) => `${Number(l.debit) > 0 ? "Dr" : "Cr"} ${l.ledger}`).join(" · ")}</td>
                          <td className="acx-num acx-strong">{money(x.amount)}</td>
                          <td>{x.cancelled ? <span className="acx-pill acx-pill--warn" title={`${x.cancelReason || ""}${x.cancelledByName ? ` — ${x.cancelledByName}` : ""}`}>Cancelled</span>
                            : <span className="acx-pill acx-pill--good">Posted</span>}</td>
                          <td className="acx-act">{can("Cancel Vouchers") && !x.cancelled && (
                            <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={() => { setCancelling(x.uKey); setReason(""); }}>Cancel</button>)}</td>
                        </tr>
                        {cancelling === x.uKey && (
                          <tr className="acx-drawer"><td colSpan={8}>
                            <div className="acx-tools">
                              <input className="acx-search" type="text" aria-label="Reason for cancelling" placeholder="Why is it cancelled? (kept with the voucher)"
                                value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
                              <button type="button" className="acx-btn acx-btn-primary acx-btn-sm" disabled={reason.trim().length < 3} onClick={() => cancel(x)}>Cancel {x.voucherNumber}</button>
                              <button type="button" className="acx-btn acx-btn-ghost-primary acx-btn-sm" onClick={() => setCancelling(null)}>Keep</button>
                            </div>
                            <p className="acx-hint">Nothing is deleted: the voucher stays, and its reversal is posted today.</p>
                          </td></tr>
                        )}
                      </React.Fragment>
                    ))}
                    {shown.length === 0 && <tr><td colSpan={8} className="acx-none-cell">Nothing matches “{query}”.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

      <AccountHeads ledgers={ledgers} can={can} reload={reloadLedgers} />
    </>
  );
}

/** Count the cash in the drawer against the cash book; post the shortage or excess with a reason. */
export function CashCount({ closing, asAt, onPosted }) {
  const [counted, setCounted] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const r = cashCountResult(counted, closing);
  const day = asAt > isoDate(new Date()) ? isoDate(new Date()) : asAt;
  const post = async () => {
    const amount = Math.abs(r.diff);
    const short = r.kind === "short";
    setBusy(true);
    try {
      const json = await postVoucher({
        voucherType: short ? "PAYMENT" : "RECEIPT", voucherDate: day, allowNegativeCash: true,
        narration: `Cash ${short ? "short" : "excess"} on count${why.trim() ? ` · ${why.trim()}` : ""}`,
        lines: short ? [{ ledger: "Cash Short / Excess", debit: amount, credit: 0 }, { ledger: CASH, debit: 0, credit: amount }]
          : [{ ledger: CASH, debit: amount, credit: 0 }, { ledger: "Cash Short / Excess", debit: 0, credit: amount }],
      });
      if (json?.status === 200) { toast.success(`${json.data.voucherNumber}: cash ${short ? "shortage" : "excess"} posted.`); setCounted(""); setWhy(""); onPosted(); }
      else toast.error(json?.message || "The adjustment could not be posted.");
    } catch { toast.error("The adjustment could not be posted. Check the connection and try again."); }
    finally { setBusy(false); }
  };
  return (
    <section className="acx-panel" aria-label="Cash count" data-testid="cash-count">
      <div className="acx-fields">
        <div className="acx-field"><span className="acx-field-k">Cash counted on {showDate(day)} (₹)</span>
          <input type="number" min="0" step="0.01" aria-label="Cash counted" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
        <div className="acx-field"><span className="acx-field-k">Cash book says</span><strong className="acx-strong">{money(closing)}</strong></div>
        {r && <div className="acx-field"><span className="acx-field-k">Difference</span>
          <strong data-testid="cash-diff" className={r.kind === "match" ? "acx-in" : "acx-out"}>
            {r.kind === "match" ? "Matches the book" : `${r.kind === "short" ? "Short" : "Excess"} ${money(Math.abs(r.diff))}`}</strong></div>}
      </div>
      {r && r.kind !== "match" && (
        <div className="acx-tools">
          <input className="acx-search" type="text" aria-label="Reason for the difference" placeholder="Reason (kept on the voucher)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} />
          <button type="button" className="acx-btn acx-btn-primary acx-btn-sm" disabled={busy} onClick={post}>Post {r.kind === "short" ? "shortage" : "excess"}</button>
        </div>
      )}
    </section>
  );
}
